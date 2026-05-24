'use server'

import { getOpenAIClient } from '@/lib/openai'
import type { Domain, FollowUpQuestion } from '@/lib/supabase/types'

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
