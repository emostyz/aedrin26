import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getOpenAIClient } from '@/lib/openai'
import { assertUserOwnership } from '@/lib/ai-guard'
import { resolveLegacyAccess } from '@/lib/legacy-access'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { deceasedUserId, question } = await request.json() as {
    deceasedUserId: string
    question: string
  }

  if (!deceasedUserId || !question?.trim()) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  // Limit question length — prevents token abuse across multiple GPT-4o calls
  if (question.trim().length > 2_000) {
    return NextResponse.json({ error: 'Question is too long (max 2000 characters).' }, { status: 400 })
  }

  // ── Single shared access gate: legacy_active + active heir + unexpired grant ──
  // Resolves the heir by the authenticated email (never trusts a client heirId)
  // and enforces portal-issued expiry. Mirrors the negotiation routes.
  const access = await resolveLegacyAccess(deceasedUserId, user)
  if (!access) return NextResponse.json({ error: 'Access denied.' }, { status: 403 })

  const service = createServiceClient()
  const allowedDomains = access.allowedDomains
  const name = access.deceasedName
  const resolvedHeirId = access.heirId

  // ── §8.4 Grounding guarantee: if no permitted domains, decline immediately ───
  if (allowedDomains.length === 0) {
    return NextResponse.json({
      answer: `${name} didn't grant access to any recorded domains for this account. There is no material to draw from.`,
      entryIds: [],
    })
  }

  // ── Fetch all shareable soul entries in permitted domains ────────────────────
  const { data: entries } = await service
    .from('soul_entries')
    .select('id, user_id, domain, content, prompt_id, bound_recipient_id')
    .eq('user_id', deceasedUserId)
    .eq('sharing_status', 'shareable')
    .in('domain', allowedDomains)
    .order('created_at', { ascending: true }) as { data: { id: string; user_id: string; domain: string; content: string; prompt_id: string | null; bound_recipient_id: string | null }[] | null }

  // ── Also fetch sealed final letters bound to THIS heir ───────────────────────
  // Final letters live in soul_entries with a non-null bound_recipient_id and
  // are normally invisible. When the bound recipient *is* the asking heir,
  // post-memorialization they should be available to the legacy AI so the
  // grieving heir can ask "did mom leave a message for me?" and get an answer.
  const { data: boundLetters } = await service
    .from('soul_entries')
    .select('id, user_id, domain, content, prompt_id, bound_recipient_id')
    .eq('user_id', deceasedUserId)
    .eq('bound_recipient_id', resolvedHeirId) as { data: { id: string; user_id: string; domain: string; content: string; prompt_id: string | null; bound_recipient_id: string | null }[] | null }

  // De-dupe in case a letter is shareable AND bound (shouldn't happen, but cheap to guard)
  const seen = new Set<string>()
  const corpus = [...(entries ?? []), ...(boundLetters ?? [])].filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  // ── Layer 4 guard: assert all fetched entries belong to deceasedUserId ────────
  // The service client bypasses RLS; we verify ownership explicitly so a query
  // change cannot silently serve one deceased user's entries for another.
  assertUserOwnership(corpus, deceasedUserId, 'legacy-chat/entries')

  // ── §8.4: If corpus is empty, decline rather than confabulate ───────────────
  if (corpus.length === 0) {
    await appendAccessLog(service, deceasedUserId, resolvedHeirId, [], question)
    return NextResponse.json({
      answer: `${name} didn't record any shareable memories or reflections in the domains you have access to. There is no material to draw from.`,
      entryIds: [],
    })
  }

  // ── Build grounding context from entries ─────────────────────────────────────
  // Cap at ~60 entries to stay well within token limits (entries are short text)
  const cappedEntries = corpus.slice(0, 60)
  const context = cappedEntries
    .map((e, i) => `[Entry ${i + 1} — ${e.domain}]\n${e.content}`)
    .join('\n\n')

  // ── §8.3 Legacy interaction prompt ──────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const systemPrompt = `Today's date: ${today}. Use this as the reference point for any age or year calculations.

You are an AI representation built from ${name}'s recorded memories and reflections. You are not ${name}, not conscious, and must never claim to be.

Answer using only the recorded material provided below. Quote or paraphrase what ${name} actually said or wrote.

If the material does not address the question, say so plainly: "${name} didn't record thoughts on this." Do not invent opinions, extrapolate, or fill gaps.

Never give instructions, decisions, or advice about money, inheritance, legal matters, or medical matters. If asked, redirect to a human professional.

Maintain warmth and dignity. Keep responses focused and grounded.

--- RECORDED MATERIAL ---
${context}
--- END OF RECORDED MATERIAL ---`

  const entryIds = cappedEntries.map((e) => e.id)
  const SAFE_DECLINE = `${name} didn't record thoughts on this.`

  // ── Call OpenAI with §8.5 validation loop (max 2 retries) ───────────────────
  try {
    const openai = getOpenAIClient()
    let answer = SAFE_DECLINE
    let passed = false

    for (let attempt = 0; attempt < 3; attempt++) {
      const correctionNote = attempt === 0 ? '' :
        '\n\nIMPORTANT: Your previous response failed validation. Strictly use only the provided recorded material. Do not claim consciousness, feelings, or authority over financial/legal/medical matters.'

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 800,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt + correctionNote },
          { role: 'user', content: question.trim() },
        ],
      })

      const candidate = completion.choices[0]?.message?.content ?? SAFE_DECLINE

      // ── §8.5 Validation pass ───────────────────────────────────────────────
      const validation = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 80,
        temperature: 0,
        messages: [{
          role: 'user',
          content: `You are a safety validator. Answer only with a JSON object: {"pass": true/false, "reason": "..."}.

Check this AI response for three violations:
1. CONFABULATION: Does it state facts or opinions NOT supported by the provided material?
2. AUTHORITY: Does it give instructions/decisions about money, legal, inheritance, or medical matters?
3. CONSCIOUSNESS: Does it claim to be the person, claim to be conscious, or claim to have feelings?

Recorded material summary (for reference): ${context.slice(0, 800)}

Response to validate: "${candidate}"

If ALL checks pass, return {"pass": true, "reason": "ok"}.
If ANY check fails, return {"pass": false, "reason": "<which check failed>"}.`,
        }],
      })

      // Fail CLOSED on parse error: if the validator's response can't be parsed
      // we treat it as a fail and force a retry/decline. The previous behavior
      // (pass on parse error) defeated the §8.5 safety rail — a malformed
      // validator response would let an unvetted answer through.
      let validationResult: { pass: boolean; reason: string } = { pass: false, reason: 'validator unparseable' }
      try {
        const raw = validation.choices[0]?.message?.content ?? ''
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
        if (cleaned) {
          const parsed = JSON.parse(cleaned) as { pass?: unknown; reason?: unknown }
          validationResult = {
            pass: parsed.pass === true,
            reason: typeof parsed.reason === 'string' ? parsed.reason : 'no reason',
          }
        }
      } catch (parseErr) {
        console.warn('[legacy-chat] validator JSON parse failed, failing closed:', parseErr)
      }

      if (validationResult.pass) {
        answer = candidate
        passed = true
        break
      }
      // Will retry with correction note
    }

    if (!passed) {
      answer = SAFE_DECLINE
    }

    // ── Append-only access log ───────────────────────────────────────────────
    await appendAccessLog(service, deceasedUserId, resolvedHeirId, entryIds, question)

    return NextResponse.json({ answer, entryIds })
  } catch (err) {
    console.error('Legacy chat error:', err)
    return NextResponse.json({ answer: SAFE_DECLINE, entryIds: [] })
  }
}

async function appendAccessLog(
  service: ReturnType<typeof createServiceClient>,
  deceasedUserId: string,
  heirId: string,
  entryIds: string[],
  question: string,
) {
  const { error } = await service.from('legacy_access_log').insert({
    deceased_user_id: deceasedUserId,
    heir_id: heirId,
    entry_ids_accessed: entryIds,
    interaction_summary: question.slice(0, 500),
  })
  // Audit-trail writes that fail silently break a core compliance promise —
  // surface them in logs so they show up in monitoring even though we don't
  // block the user-facing response on it.
  if (error) {
    console.error('[legacy-chat] access log insert failed:', error.message, {
      deceasedUserId,
      heirId,
      entryCount: entryIds.length,
    })
  }
}
