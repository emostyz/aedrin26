'use server'

import { getOpenAIClient } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { assertUserOwnership, aiContextHeader } from '@/lib/ai-guard'
import type { Domain } from '@/lib/supabase/types'

// ─────────────────────────────────────────────────────────────────────────────
// Topic taxonomy
//
// 64 distinct sub-topics covering the full life-story space. Each daily prompt
// is assigned ONE topic. Topics are blocked for 30 days, so no theme repeats
// within a month. With 64 topics and a 30-day window, 34+ choices are always
// available — GPT only picks the *phrasing*, never the topic.
// ─────────────────────────────────────────────────────────────────────────────

interface Topic {
  id: string          // e.g. 'family_mother' — stored in daily_prompts.theme_tag
  label: string       // e.g. 'Your mother'  — shown in the AI prompt
  description: string // what this topic covers — the AI's brief for writing the question
  domain: Domain      // which DB domain this maps to
  weight: number      // 1 = normal, 2 = high-value (more personal/important)
}

const TOPICS: Topic[] = [
  // ── CHILDHOOD ───────────────────────────────────────────────────────────────
  {
    id: 'childhood_place', label: 'The place you grew up',
    description: 'the physical home, neighborhood, town — the sensory world of childhood',
    domain: 'childhood', weight: 1,
  },
  {
    id: 'childhood_school', label: 'School experiences',
    description: 'teachers, classmates, learning, the social world of school, what you dreaded and loved',
    domain: 'childhood', weight: 1,
  },
  {
    id: 'childhood_friendship', label: 'Childhood friends',
    description: 'close friendships formed in childhood, what you did together, what happened to them',
    domain: 'childhood', weight: 1,
  },
  {
    id: 'childhood_play', label: 'How you played',
    description: 'games, hobbies, imagination, how you spent free time as a child',
    domain: 'childhood', weight: 1,
  },
  {
    id: 'childhood_milestones', label: 'Pivotal childhood moments',
    description: 'specific events, firsts, or turning points that stand out from growing up',
    domain: 'childhood', weight: 2,
  },
  {
    id: 'childhood_culture', label: 'Culture and traditions growing up',
    description: 'food, holidays, cultural or religious traditions, the rhythms of family life year to year',
    domain: 'childhood', weight: 1,
  },
  {
    id: 'childhood_emotions', label: 'What childhood felt like',
    description: 'the emotional texture of growing up — the fears, joys, what made you feel safe or scared',
    domain: 'childhood', weight: 2,
  },
  {
    id: 'childhood_discovery', label: 'Things you first discovered',
    description: 'ideas, experiences, or truths you first encountered as a child that changed how you saw the world',
    domain: 'childhood', weight: 1,
  },

  // ── FAMILY ──────────────────────────────────────────────────────────────────
  {
    id: 'family_mother', label: 'Your mother',
    description: 'who your mother was as a person, your relationship with her, what she gave you or couldn\'t give you',
    domain: 'family', weight: 2,
  },
  {
    id: 'family_father', label: 'Your father',
    description: 'who your father was as a person, your relationship with him, his influence on who you became',
    domain: 'family', weight: 2,
  },
  {
    id: 'family_siblings', label: 'Siblings',
    description: 'brothers and sisters — the relationships, rivalries, bonds, and how they shaped you',
    domain: 'family', weight: 1,
  },
  {
    id: 'family_grandparents', label: 'Grandparents',
    description: 'who your grandparents were, stories about them, what you carry from them',
    domain: 'family', weight: 1,
  },
  {
    id: 'family_extended', label: 'Extended family',
    description: 'aunts, uncles, cousins, family lore, stories that got handed down',
    domain: 'family', weight: 1,
  },
  {
    id: 'family_traditions', label: 'Family traditions and rituals',
    description: 'recurring rituals, holiday traditions, the rhythms that made your family feel like your family',
    domain: 'family', weight: 1,
  },
  {
    id: 'family_dynamics', label: 'Family dynamics',
    description: 'tensions, unspoken rules, roles people played, what went unsaid for years',
    domain: 'family', weight: 2,
  },
  {
    id: 'family_parenting', label: 'Raising your children',
    description: 'your experience as a parent — what you hoped for, what surprised you, what you got right and wrong',
    domain: 'family', weight: 2,
  },
  {
    id: 'family_home_place', label: 'The family home',
    description: 'the physical places — houses, apartments, towns — that your family called home over the years',
    domain: 'family', weight: 1,
  },
  {
    id: 'family_inheritance', label: 'What you inherited from family',
    description: 'values, habits, beliefs, or patterns passed down — for better and worse',
    domain: 'family', weight: 2,
  },

  // ── CAREER ──────────────────────────────────────────────────────────────────
  {
    id: 'career_first_steps', label: 'First job and early career',
    description: 'how you started working, your first real job, what you were like professionally when young',
    domain: 'career', weight: 1,
  },
  {
    id: 'career_defining_work', label: 'Work that defined you',
    description: 'the role, project, or period of work that mattered most to you professionally',
    domain: 'career', weight: 2,
  },
  {
    id: 'career_failure', label: 'Professional failure',
    description: 'a significant work failure, setback, or loss — what happened and what it cost',
    domain: 'career', weight: 2,
  },
  {
    id: 'career_mentors', label: 'Mentors and teachers',
    description: 'people who guided, taught, or shaped your professional path',
    domain: 'career', weight: 1,
  },
  {
    id: 'career_success_meaning', label: 'What success meant to you',
    description: 'how your definition of professional success changed or held steady over time',
    domain: 'career', weight: 2,
  },
  {
    id: 'career_pivot', label: 'Career changes',
    description: 'pivots, reinventions, the moments you chose a different professional path',
    domain: 'career', weight: 1,
  },
  {
    id: 'career_colleagues', label: 'People you worked with',
    description: 'colleagues, partners, employees, or clients who were important to you',
    domain: 'career', weight: 1,
  },
  {
    id: 'career_ambition', label: 'Ambition and what you were chasing',
    description: 'what drove you professionally, what you wanted to achieve and why',
    domain: 'career', weight: 2,
  },
  {
    id: 'career_craft', label: 'Skills and craft you developed',
    description: 'the specific expertise or craft you built across your working life',
    domain: 'career', weight: 1,
  },

  // ── VALUES ──────────────────────────────────────────────────────────────────
  {
    id: 'values_principles', label: 'Core principles you live by',
    description: 'the foundational beliefs that guide your decisions, in your own words',
    domain: 'values', weight: 2,
  },
  {
    id: 'values_money', label: 'Your relationship with money',
    description: 'how you think about money, what it represents, how it has shaped choices',
    domain: 'values', weight: 1,
  },
  {
    id: 'values_fairness', label: 'Justice and fairness',
    description: 'what you believe about fairness, right and wrong, what outrages you and why',
    domain: 'values', weight: 1,
  },
  {
    id: 'values_courage', label: 'Courage',
    description: 'times that required courage — when you found it and when you didn\'t',
    domain: 'values', weight: 2,
  },
  {
    id: 'values_integrity', label: 'Integrity under pressure',
    description: 'times your integrity was tested — choices you had to make about who you wanted to be',
    domain: 'values', weight: 2,
  },
  {
    id: 'values_evolution', label: 'How your values have changed',
    description: 'beliefs you once held strongly that evolved or reversed — what changed them',
    domain: 'values', weight: 1,
  },
  {
    id: 'values_tradeoffs', label: 'What you\'ve chosen to put first',
    description: 'the real tradeoffs you made — what you sacrificed and what you protected',
    domain: 'values', weight: 2,
  },

  // ── BELIEFS ─────────────────────────────────────────────────────────────────
  {
    id: 'beliefs_faith', label: 'Faith and spirituality',
    description: 'your religious or spiritual beliefs — what you believe, how it evolved, what it means to you',
    domain: 'beliefs', weight: 2,
  },
  {
    id: 'beliefs_mortality', label: 'Thoughts on death',
    description: 'your relationship with mortality — your own death, death of others, what you believe comes after',
    domain: 'beliefs', weight: 2,
  },
  {
    id: 'beliefs_purpose', label: 'Why we\'re here',
    description: 'your sense of life\'s meaning or purpose — what you\'ve concluded or what you\'re still wrestling with',
    domain: 'beliefs', weight: 2,
  },
  {
    id: 'beliefs_world_view', label: 'Your view of the world',
    description: 'society, politics, humanity — how you understand the world we\'re all living in',
    domain: 'beliefs', weight: 1,
  },
  {
    id: 'beliefs_curiosity', label: 'What fascinates you',
    description: 'your intellectual curiosity — what you find endlessly interesting, how you seek to understand things',
    domain: 'beliefs', weight: 1,
  },
  {
    id: 'beliefs_regret_forgiveness', label: 'Regret and forgiveness',
    description: 'your beliefs about regret, mistakes, and forgiveness — for yourself and for others',
    domain: 'beliefs', weight: 2,
  },
  {
    id: 'beliefs_chance', label: 'The role of luck and chance',
    description: 'how much of your life was luck vs. choice — what you believe about fate, chance, and agency',
    domain: 'beliefs', weight: 1,
  },

  // ── LESSONS ─────────────────────────────────────────────────────────────────
  {
    id: 'lessons_mistakes', label: 'Your biggest mistakes',
    description: 'the significant mistakes you\'ve made, what they cost, and what they ultimately taught you',
    domain: 'lessons', weight: 2,
  },
  {
    id: 'lessons_younger_self', label: 'Advice to your younger self',
    description: 'what you would tell the younger version of yourself if you could sit across from them',
    domain: 'lessons', weight: 2,
  },
  {
    id: 'lessons_hard_won', label: 'Things you know now',
    description: 'wisdom earned through experience — things you understand now that you wish you\'d known sooner',
    domain: 'lessons', weight: 2,
  },
  {
    id: 'lessons_resilience', label: 'How you got through hard times',
    description: 'the difficult periods and what carried you through — what you found in yourself',
    domain: 'lessons', weight: 2,
  },
  {
    id: 'lessons_failure_lessons', label: 'What failure taught you',
    description: 'the specific insights that only came from failing — things success couldn\'t have given you',
    domain: 'lessons', weight: 1,
  },
  {
    id: 'lessons_people', label: 'What you\'ve learned about people',
    description: 'hard-won understanding of human nature — what you\'ve come to know about how people work',
    domain: 'lessons', weight: 1,
  },
  {
    id: 'lessons_time', label: 'Your relationship with time',
    description: 'how you relate to time — urgency, patience, regret, the seasons of a life',
    domain: 'lessons', weight: 1,
  },

  // ── MESSAGES ────────────────────────────────────────────────────────────────
  {
    id: 'messages_love', label: 'What you want loved ones to know',
    description: 'the things you most want the people closest to you to truly understand about your love for them',
    domain: 'messages', weight: 2,
  },
  {
    id: 'messages_legacy', label: 'What you want to leave behind',
    description: 'not the material things — the ideas, values, and examples you hope outlast you',
    domain: 'messages', weight: 2,
  },
  {
    id: 'messages_unsaid', label: 'Things you\'ve never said',
    description: 'important things you\'ve never quite managed to say to people who matter — what and why',
    domain: 'messages', weight: 2,
  },
  {
    id: 'messages_gratitude', label: 'Gratitude',
    description: 'what and who you are most grateful for — specific, deep gratitude, not the obvious things',
    domain: 'messages', weight: 1,
  },
  {
    id: 'messages_forgiveness', label: 'Forgiveness you want to give',
    description: 'forgiveness you\'ve given, forgiveness you still owe, and forgiveness you\'re still working toward',
    domain: 'messages', weight: 2,
  },
  {
    id: 'messages_hopes', label: 'Hopes for those you love',
    description: 'your hopes for the people who will go on after you — what you most want for them',
    domain: 'messages', weight: 1,
  },

  // ── RELATIONSHIPS (mapped to nearest domain) ─────────────────────────────
  {
    id: 'relationships_friendship', label: 'Important friendships',
    description: 'the deep friendships that have mattered most — who they were, what the friendship gave you',
    domain: 'family', weight: 1,
  },
  {
    id: 'relationships_romance_early', label: 'Early romantic life',
    description: 'early relationships, dating, heartbreak — the loves that shaped you before you settled into yourself',
    domain: 'family', weight: 1,
  },
  {
    id: 'relationships_partner', label: 'Your long-term partnership',
    description: 'your primary partnership or marriage — what it has meant, what you\'ve learned, what makes it work',
    domain: 'family', weight: 2,
  },
  {
    id: 'relationships_loss_grief', label: 'Loss and grief',
    description: 'significant losses — people, relationships, versions of yourself — and how you\'ve carried them',
    domain: 'lessons', weight: 2,
  },
  {
    id: 'relationships_community', label: 'Community and belonging',
    description: 'the groups, places, or communities where you\'ve felt you truly belonged',
    domain: 'values', weight: 1,
  },

  // ── SELF ────────────────────────────────────────────────────────────────────
  {
    id: 'self_identity', label: 'How you see yourself',
    description: 'your sense of identity — who you are, who you\'ve been, how that self-image has evolved',
    domain: 'beliefs', weight: 2,
  },
  {
    id: 'self_joy', label: 'What brings you joy',
    description: 'the specific things, activities, and moments that give you genuine, uncomplicated joy',
    domain: 'values', weight: 1,
  },
  {
    id: 'self_creativity', label: 'Creative expression',
    description: 'the creative or intellectual pursuits that matter to you — art, music, writing, building, thinking',
    domain: 'beliefs', weight: 1,
  },
  {
    id: 'self_body', label: 'Your body and health over time',
    description: 'your relationship with your body — health, aging, physical experience, how you\'ve inhabited your physical self',
    domain: 'beliefs', weight: 1,
  },
  {
    id: 'self_sense_of_place', label: 'Places that shaped you',
    description: 'specific places — cities, landscapes, rooms — that have been important in your life and why',
    domain: 'childhood', weight: 1,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Topic selection
//
// Deterministically picks a topic that wasn't used in the last 30 days.
// Domain coverage and topic weight bias the selection; a date-seeded shuffle
// prevents predictability while keeping the same topic stable within a day.
// ─────────────────────────────────────────────────────────────────────────────

function selectTopic(
  recentThemeTags: string[],    // topic IDs used in the last 30 days
  domainCounts: Record<string, number>, // entries + prompts per domain
  todaySeed: number,            // date-based seed for stable intra-day selection
): Topic {
  const blocked = new Set(recentThemeTags)

  // Available = not blocked by 30-day window
  const available = TOPICS.filter((t) => !blocked.has(t.id))

  // If somehow everything is blocked (shouldn't happen with 64 topics + 30-day window),
  // reset and use all topics
  const pool = available.length > 0 ? available : TOPICS

  // Score: favour under-explored domains + higher-weight topics
  const maxDomainCount = Math.max(...Object.values(domainCounts), 1)
  const scored = pool.map((t) => {
    const domainUse   = domainCounts[t.domain] ?? 0
    const domainScore = 1 - domainUse / maxDomainCount   // 0-1, higher = less covered
    const weightScore = (t.weight - 1) * 0.3              // 0 or 0.3
    return { topic: t, score: domainScore + weightScore }
  })

  // Sort descending, take the top 6 candidates, pick one deterministically
  scored.sort((a, b) => b.score - a.score)
  const candidates = scored.slice(0, Math.min(6, scored.length))
  return candidates[Math.abs(todaySeed) % candidates.length]!.topic
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt builder
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(
  profile: Record<string, string | null>,
  topic: Topic,
  firstName: string,
  recentPromptTexts: string[],
): string {
  const today = new Date().toISOString().slice(0, 10)
  const age = profile.dob
    ? Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null

  const profileLines: string[] = [
    `Name: ${profile.display_name ?? profile.legal_name ?? 'Unknown'}`,
    age                           ? `Age: ${age}`                                                     : '',
    profile.relationship_status   ? `Relationship status: ${profile.relationship_status}`             : '',
    profile.location              ? `Lives in: ${profile.location}`                                   : '',
    profile.life_description      ? `About their life: "${profile.life_description}"`                : '',
    profile.biggest_regret        ? `Their biggest regret: "${profile.biggest_regret}"`              : '',
    profile.life_purpose          ? `Their sense of purpose: "${profile.life_purpose}"`              : '',
  ].filter(Boolean)

  const recentPhrasingSection = recentPromptTexts.length > 0
    ? `\n## RECENT QUESTIONS (avoid similar phrasing or framing)\n` +
      recentPromptTexts.map((t, i) => `${i + 1}. "${t}"`).join('\n')
    : ''

  return [
    `Today's date: ${today}. Use this as the authoritative reference for any age or year calculations.`,
    '',
    'You are the world\'s most thoughtful life-story interviewer. Your job is to write ONE perfect reflection question for a specific person about a specific topic.',
    '',
    '## THE PERSON',
    ...profileLines,
    '',
    `## TODAY'S TOPIC — write specifically and ONLY about this`,
    `Topic: ${topic.label}`,
    `This covers: ${topic.description}`,
    '',
    `Write one question that helps ${firstName} reflect on "${topic.label}". The question must:`,
    '- Be specific to WHO THEY ARE based on their profile — not generic',
    '- Stay tightly focused on the topic — don\'t drift into related areas',
    '- Feel like a wise, warm friend asking — not a survey or therapy intake',
    '- Be under 60 words, open-ended, emotionally resonant',
    '- Invite a story or a specific memory, not a yes/no answer',
    recentPhrasingSection,
  ].filter((l) => l !== undefined).join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON schema — simplified now that the AI only writes the question
// ─────────────────────────────────────────────────────────────────────────────

const PROMPT_SCHEMA = {
  type: 'object',
  properties: {
    prompt_text: {
      type: 'string',
      description: 'The single reflection question. Under 60 words. Personal, specific, warm. Does NOT start with "Can you..." or "Would you...".',
    },
    rationale: {
      type: 'string',
      description: 'One sentence on why this specific angle on the topic fits this person today. Internal only, never shown.',
    },
  },
  required: ['prompt_text', 'rationale'],
  additionalProperties: false,
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrCreateTodaysPrompt(): Promise<{
  prompt: { id: string; prompt_text: string; domain: Domain; delivered_date: string } | null
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { prompt: null, error: 'Not authenticated' }

    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    // 1. Return today's prompt if it already exists
    const { data: existing } = await supabase
      .from('daily_prompts')
      .select('id, prompt_text, domain, delivered_date')
      .eq('user_id', user.id)
      .eq('delivered_date', today)
      .single()

    if (existing) {
      return { prompt: existing as { id: string; prompt_text: string; domain: Domain; delivered_date: string } }
    }

    // 2. Collect data needed for generation
    const service = createServiceClient()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)

    const [profileResult, recentPromptsResult, entriesResult] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      // Last 30 days of prompts — we only need theme_tags + recent texts for phrasing reference
      service.from('daily_prompts')
        .select('user_id, prompt_text, domain, theme_tag')
        .eq('user_id', user.id)
        .gte('delivered_date', thirtyDaysAgo)
        .order('delivered_date', { ascending: false })
        .limit(30),
      supabase.from('soul_entries')
        .select('user_id, domain, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    const profile = (profileResult.data ?? {}) as Record<string, string | null>
    const recentPrompts = (recentPromptsResult.data ?? []) as {
      user_id: string; prompt_text: string; domain: string; theme_tag: string | null
    }[]
    const entries = (entriesResult.data ?? []) as {
      user_id: string; domain: string; content: string; created_at: string
    }[]

    // Layer 4 guard: assert ownership before data enters AI context
    assertUserOwnership(recentPrompts, user.id, 'daily-prompt/recentPrompts')
    assertUserOwnership(entries, user.id, 'daily-prompt/entries')

    const firstName = (
      (profile.display_name ?? profile.legal_name ?? '') as string
    ).split(' ')[0] || 'there'

    // 3. Determine which topics are blocked (used in last 30 days)
    const recentThemeTags = recentPrompts
      .map((p) => p.theme_tag)
      .filter((t): t is string => !!t)

    // 4. Build domain usage counts for coverage-aware topic selection
    const domainCounts = [...recentPrompts, ...entries].reduce<Record<string, number>>(
      (acc, item) => { acc[item.domain] = (acc[item.domain] ?? 0) + 1; return acc },
      {},
    )

    // 5. Select topic — date-seeded so the same topic is stable within a day
    const todaySeed = parseInt(today.replace(/-/g, ''), 10) % 9973 // prime mod for better spread
    const topic = selectTopic(recentThemeTags, domainCounts, todaySeed)

    // 6. Recent prompt texts for phrasing reference (last 5 only — enough to avoid echo)
    const recentPromptTexts = recentPrompts.slice(0, 5).map((p) => p.prompt_text)

    // 7. Build entry context so the question doesn't tread ground already covered
    const entrySummary = entries.length > 0
      ? '\n\n## WHAT THEY HAVE ALREADY SHARED (never ask about these specific topics)\n' +
        entries.slice(0, 15).map(
          (e) => `- [${e.domain}] "${e.content.slice(0, 100)}${e.content.length > 100 ? '…' : ''}"`
        ).join('\n')
      : ''

    const systemPrompt =
      aiContextHeader(user.id) +
      buildSystemPrompt(profile, topic, firstName, recentPromptTexts) +
      entrySummary

    // 8. Generate
    const client = getOpenAIClient()
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.88,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'daily_prompt',
          strict: true,
          schema: PROMPT_SCHEMA,
        },
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Write today's reflection question about "${topic.label}".` },
      ],
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) throw new Error('No response from AI')

    const result = JSON.parse(raw) as { prompt_text: string; rationale: string }

    // 9. Store — domain and theme_tag come from the selected topic, not the AI
    const { data: inserted, error: insertError } = await service
      .from('daily_prompts')
      .upsert(
        {
          user_id:        user.id,
          prompt_text:    result.prompt_text,
          domain:         topic.domain,
          rationale:      result.rationale,
          theme_tag:      topic.id,
          delivered_date: today,
        },
        { onConflict: 'user_id,delivered_date', ignoreDuplicates: false },
      )
      .select('id, prompt_text, domain, delivered_date')
      .single()

    if (insertError) throw insertError

    return {
      prompt: inserted as { id: string; prompt_text: string; domain: Domain; delivered_date: string },
    }
  } catch (err) {
    console.error('[daily-prompt] generation failed:', err)

    // ── Static fallback: pull a curated interview prompt so the dashboard never shows nothing
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const today = new Date().toISOString().slice(0, 10)
        const seed = parseInt(today.replace(/-/g, ''), 10) % 1000
        const { data: staticPrompts } = await supabase
          .from('interview_prompts')
          .select('id, text, domain')
          .eq('active', true)
          .order('ord')
          .limit(50)

        if (staticPrompts && staticPrompts.length > 0) {
          const picked = staticPrompts[seed % staticPrompts.length]!
          return {
            prompt: {
              id:             `static-${picked.id}`,
              prompt_text:    picked.text,
              domain:         picked.domain as Domain,
              delivered_date: today,
            },
          }
        }
      }
    } catch {
      // Ignore fallback errors — caller handles null gracefully
    }

    return { prompt: null, error: 'Could not generate today\'s prompt' }
  }
}
