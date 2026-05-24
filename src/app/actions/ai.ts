'use server'

import { getOpenAIClient } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import { createLifeEvent } from '@/app/actions/life-events'
import type { Domain, FollowUpQuestion } from '@/lib/supabase/types'

// ── Suggested life event (returned by AI) ─────────────────────────────────────
export interface SuggestedLifeEvent {
  title: string
  year: number | null
  description: string | null
}

const LIFE_EVENT_SCHEMA = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      description: 'Key life events extracted from the entries. 3–15 events ordered chronologically.',
      minItems: 0,
      maxItems: 15,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title for the life event (3–8 words).' },
          year:  { type: ['integer', 'null'], description: 'Year the event occurred, or null if unknown.' },
          description: { type: ['string', 'null'], description: 'One sentence describing the event and its significance, or null.' },
        },
        required: ['title', 'year', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['events'],
  additionalProperties: false,
}

export async function suggestLifeEvents(): Promise<SuggestedLifeEvent[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Pull up to 40 entries (prioritise childhood, career, family — most event-rich)
    const { data } = await supabase
      .from('soul_entries')
      .select('domain, content')
      .eq('user_id', user.id)
      .in('domain', ['childhood', 'career', 'family', 'lessons', 'other', 'values'])
      .order('created_at', { ascending: true })
      .limit(40)

    if (!data || data.length === 0) return []

    const entriesText = data
      .map((e) => `[${e.domain}] ${e.content}`)
      .join('\n\n---\n\n')

    const client = getOpenAIClient()
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'life_events',
          strict: true,
          schema: LIFE_EVENT_SCHEMA,
        },
      },
      messages: [
        {
          role: 'system',
          content: `You are reading someone's personal life-story entries and extracting the specific, datable events they mention — births, moves, milestones, relationships, jobs, losses, achievements.

Rules:
- Only extract events that are clearly stated or strongly implied
- Each event should be meaningful and distinct (not vague moods or opinions)
- Title should be concise and specific: "Moved to New York" not "Made a big move"
- Estimate the year when possible; null if genuinely unknown
- Order chronologically
- Do not duplicate or summarise the same event twice`,
        },
        {
          role: 'user',
          content: `Here are my life-story entries:\n\n${entriesText}\n\nExtract the key life events.`,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) return []
    const parsed = JSON.parse(raw) as { events: SuggestedLifeEvent[] }
    return Array.isArray(parsed.events) ? parsed.events : []
  } catch {
    return []
  }
}

export async function acceptLifeEvent(event: SuggestedLifeEvent): Promise<{ error?: string }> {
  const fd = new FormData()
  fd.set('title', event.title)
  if (event.year) fd.set('event_date', `${event.year}-01-01`)
  if (event.description) fd.set('description', event.description)
  return createLifeEvent(fd)
}

const DOMAIN_CONTEXT: Record<Domain, string> = {
  childhood: 'early memories, home life, formative experiences',
  family:    'parents, siblings, family relationships and traditions',
  career:    'professional life, work experiences, achievements and failures',
  values:    'core beliefs, principles, and how they changed over time',
  beliefs:   'views on mortality, faith, spirituality, and how to treat people',
  lessons:   'life wisdom, mistakes, advice to pass on',
  messages:  'personal messages to loved ones',
  other:     'personal reflections',
}

const FOLLOW_UP_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      description: 'Between 0 and 7 follow-up questions. Only include questions that genuinely deepen the response — fewer is better.',
      minItems: 0,
      maxItems: 7,
      items: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The follow-up question. Under 35 words. Warm, open, specific to what they shared.',
          },
          type: {
            type: 'string',
            enum: ['freeform', 'choice'],
            description: 'freeform = open text. choice = present 2–5 specific options.',
          },
          options: {
            type: 'array',
            description: 'Only present when type is "choice". 2–5 concise, distinct answer options.',
            items: { type: 'string' },
            minItems: 2,
            maxItems: 5,
          },
          placeholder: {
            type: 'string',
            description: 'Optional hint text for freeform inputs only. 5–10 words.',
          },
        },
        required: ['text', 'type'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
}

export async function suggestFollowUps(
  domain: Domain,
  entryContent: string,
  userProfile?: {
    life_description?: string | null
    life_purpose?: string | null
    relationship_status?: string | null
  }
): Promise<FollowUpQuestion[]> {
  try {
    const client = getOpenAIClient()

    const profileContext = userProfile
      ? [
          userProfile.life_description ? `Their life: "${userProfile.life_description}"` : '',
          userProfile.life_purpose ? `Their sense of purpose: "${userProfile.life_purpose}"` : '',
          userProfile.relationship_status ? `Relationship: ${userProfile.relationship_status}` : '',
        ].filter(Boolean).join('\n')
      : ''

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'follow_up_questions',
          strict: true,
          schema: FOLLOW_UP_SCHEMA,
        },
      },
      messages: [
        {
          role: 'system',
          content: `You are a master life-story interviewer helping someone capture their memories and wisdom in the domain of ${DOMAIN_CONTEXT[domain]}.

${profileContext ? `## About this person\n${profileContext}\n` : ''}
## Your task
Read what they wrote. Generate 0–7 follow-up questions that will help them go DEEPER — uncovering details, emotions, and meaning they haven't said yet.

Rules:
- Only ask questions if they genuinely add value. 0 questions is valid.
- Mix freeform and choice questions strategically:
  - Use "choice" when presenting options helps them locate a feeling or memory they might not articulate on their own (e.g. "Who was most affected?" → [You, A family member, A colleague, Everyone equally])
  - Use "freeform" for open emotional territory where options would feel constraining
- Never be generic. Every question must be visibly informed by what they wrote.
- Questions should feel like a conversation, not a form. Warm. Human. Specific.`,
        },
        {
          role: 'user',
          content: `They wrote:\n"${entryContent}"\n\nGenerate follow-up questions.`,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) return []

    const parsed = JSON.parse(raw) as { questions: FollowUpQuestion[] }
    return Array.isArray(parsed.questions) ? parsed.questions.slice(0, 7) : []
  } catch {
    return []
  }
}
