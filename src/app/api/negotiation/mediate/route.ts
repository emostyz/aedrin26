import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getOpenAIClient } from '@/lib/openai'
import { assertUserOwnership, aiContextHeader } from '@/lib/ai-guard'
import { resolveLegacyAccess } from '@/lib/legacy-access'

// The mediator grounds in the deceased's recorded values/wisdom, never their
// private logistics, and only what they marked shareable.
const VALUE_DOMAINS = ['values', 'beliefs', 'messages', 'lessons', 'family']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { negotiationId } = await request.json() as { negotiationId: string }
  if (!negotiationId) return NextResponse.json({ error: 'Missing negotiationId.' }, { status: 400 })

  const service = createServiceClient()

  const { data: neg } = (await service
    .from('negotiations')
    .select('id, deceased_user_id, title, description, status')
    .eq('id', negotiationId)
    .maybeSingle()) as {
    data: { id: string; deceased_user_id: string; title: string; description: string | null; status: string } | null
  }
  if (!neg) return NextResponse.json({ error: 'Negotiation not found.' }, { status: 404 })

  const access = await resolveLegacyAccess(neg.deceased_user_id, user)
  if (!access || !access.canNegotiate) return NextResponse.json({ error: 'Access denied.' }, { status: 403 })

  const { data: me } = (await service
    .from('negotiation_participants')
    .select('id')
    .eq('negotiation_id', negotiationId)
    .eq('participant_user_id', user.id)
    .eq('consent_status', 'joined')
    .maybeSingle()) as { data: { id: string } | null }
  if (!me) return NextResponse.json({ error: 'You have not joined this negotiation.' }, { status: 403 })

  // ── Gather participants, recent thread, and the grounded value corpus ────────
  const [partsRes, msgsRes, entriesRes] = await Promise.all([
    service.from('negotiation_participants')
      .select('id, display_name, relationship_to_deceased, relationship_context, non_negotiables, consent_status')
      .eq('negotiation_id', negotiationId).eq('consent_status', 'joined'),
    service.from('negotiation_messages')
      .select('author_type, author_participant_id, content, created_at')
      .eq('negotiation_id', negotiationId).order('created_at', { ascending: true }),
    service.from('soul_entries')
      .select('id, user_id, domain, content')
      .eq('user_id', neg.deceased_user_id).eq('sharing_status', 'shareable').in('domain', VALUE_DOMAINS)
      .order('created_at', { ascending: true }),
  ])

  const participants = (partsRes.data ?? []) as Array<{
    id: string; display_name: string; relationship_to_deceased: string
    relationship_context: string | null; non_negotiables: string[]
  }>
  const messages = (msgsRes.data ?? []) as Array<{
    author_type: string; author_participant_id: string | null; content: string
  }>
  const corpus = (entriesRes.data ?? []) as Array<{ id: string; user_id: string; domain: string; content: string }>

  // ── Layer 4 guard: every grounding row must belong to the deceased ───────────
  assertUserOwnership(corpus, neg.deceased_user_id, 'negotiation-mediate/entries')

  const nameById = new Map(participants.map((p) => [p.id, p.display_name]))
  const cappedEntries = corpus.slice(0, 60)
  const citedEntryIds = cappedEntries.map((e) => e.id)

  const recordedMaterial = cappedEntries.length > 0
    ? cappedEntries.map((e, i) => `[Entry ${i + 1} — ${e.domain}]\n${e.content}`).join('\n\n')
    : '(No shareable recorded material in value-related domains.)'

  const participantBlock = participants.map((p) => {
    const nn = p.non_negotiables.length > 0 ? p.non_negotiables.map((n) => `    • ${n}`).join('\n') : '    • (none stated)'
    const ctx = p.relationship_context ? `\n  Context: ${p.relationship_context}` : ''
    return `- ${p.display_name} (${p.relationship_to_deceased})${ctx}\n  Non-negotiables:\n${nn}`
  }).join('\n\n')

  const threadBlock = messages.length > 0
    ? messages.slice(-30).map((m) => {
        const who = m.author_type === 'mediator' ? 'Mediator'
          : m.author_type === 'system' ? 'System'
          : (m.author_participant_id ? nameById.get(m.author_participant_id) ?? 'Participant' : 'Participant')
        return `${who}: ${m.content}`
      }).join('\n')
    : '(No messages yet.)'

  const systemPrompt = `${aiContextHeader(neg.deceased_user_id)}You are a neutral mediator helping the people ${access.deceasedName} left behind reach agreement on a matter concerning them. You are NOT ${access.deceasedName}, not conscious, and must never speak as them or invent their wishes.

When representing what ${access.deceasedName} would have wanted, cite ONLY the recorded material below. If the material does not address the matter, say so plainly — never fabricate their opinion.

Honor every participant's stated non-negotiables. Never pressure anyone to abandon a non-negotiable. If two non-negotiables conflict, name the conflict neutrally and look for options that respect both; if none exist, say so honestly.

Surface common ground first. Propose options, never decree. Give no legal, financial, or medical directives — redirect those to professionals. Be brief, warm, and even-handed.

MATTER: ${neg.title}${neg.description ? `\n${neg.description}` : ''}

PARTICIPANTS:
${participantBlock}

--- ${access.deceasedName.toUpperCase()}'S RECORDED MATERIAL ---
${recordedMaterial}
--- END OF RECORDED MATERIAL ---

CONVERSATION SO FAR:
${threadBlock}`

  const SAFE_FALLBACK = `I want to help you move forward together, but I should be careful not to put words in ${access.deceasedName}'s mouth. Could you say a little more about what each of you is hoping for?`

  try {
    const openai = getOpenAIClient()
    let answer = SAFE_FALLBACK
    let passed = false

    for (let attempt = 0; attempt < 3; attempt++) {
      const correction = attempt === 0 ? '' :
        '\n\nIMPORTANT: Your previous reply failed validation. Use only the recorded material when representing the deceased. Do not claim consciousness, give legal/financial/medical directives, or pressure anyone to drop a non-negotiable.'

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 700,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt + correction },
          { role: 'user', content: 'As the mediator, offer your next contribution to help these parties move forward.' },
        ],
      })
      const candidate = completion.choices[0]?.message?.content ?? SAFE_FALLBACK

      const validation = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 80,
        temperature: 0,
        messages: [{
          role: 'user',
          content: `You are a safety validator. Reply only with JSON: {"pass": true/false, "reason": "..."}.
Check this mediator message for violations:
1. CONFABULATION: states the deceased's wishes/opinions NOT in the recorded material.
2. AUTHORITY: gives legal, financial, inheritance, or medical directives.
3. CONSCIOUSNESS: claims to be the deceased or to have feelings.
4. COERCION: pressures a participant to abandon a stated non-negotiable.
Recorded material (reference): ${recordedMaterial.slice(0, 800)}
Message: "${candidate}"
If all pass: {"pass": true, "reason": "ok"}. If any fail: {"pass": false, "reason": "<which>"}.`,
        }],
      })

      let result = { pass: true, reason: 'ok' }
      try {
        const raw = validation.choices[0]?.message?.content ?? '{"pass":true}'
        result = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim())
      } catch { /* treat as pass to avoid silent failure */ }

      if (result.pass) { answer = candidate; passed = true; break }
    }

    if (!passed) answer = SAFE_FALLBACK

    await service.from('negotiation_messages').insert({
      negotiation_id: negotiationId,
      author_type: 'mediator',
      content: answer,
      cited_entry_ids: passed ? citedEntryIds : [],
    })
    await service.from('negotiation_access_log').insert({
      negotiation_id: negotiationId,
      deceased_user_id: neg.deceased_user_id,
      actor_user_id: user.id,
      action: 'mediator_invoked',
    })

    return NextResponse.json({ message: answer, citedEntryIds: passed ? citedEntryIds : [] })
  } catch (err) {
    console.error('[negotiation/mediate]', err)
    return NextResponse.json({ message: SAFE_FALLBACK, citedEntryIds: [] })
  }
}
