'use server'

import { getOpenAIClient } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { assertUserOwnership, aiContextHeader } from '@/lib/ai-guard'

export interface LifeReviewQuestion {
  id: string
  text: string
  hint: string
}

export type LifeReviewChapterId = 'early' | 'teen' | 'young' | 'middle' | 'later' | 'reflection'

interface ChapterMeta {
  id: LifeReviewChapterId
  label: string
  years: string
  ageRange: [number, number] | null  // null = open-ended (reflection)
  domain: string
  description: string
}

const CHAPTERS: ChapterMeta[] = [
  {
    id: 'early',
    label: 'Early life',
    years: '0–12',
    ageRange: [0, 12],
    domain: 'childhood',
    description: 'childhood years, earliest memories, family home, the texture of growing up before adolescence',
  },
  {
    id: 'teen',
    label: 'Teen years',
    years: '13–18',
    ageRange: [13, 18],
    domain: 'childhood',
    description: 'adolescence, school, friendships, first loves, identity formation, the urgency of those years',
  },
  {
    id: 'young',
    label: 'Early adulthood',
    years: '19–30',
    ageRange: [19, 30],
    domain: 'career',
    description: 'leaving home, early career, relationships, independence, mistakes and discoveries, who you were becoming',
  },
  {
    id: 'middle',
    label: 'Middle years',
    years: '31–50',
    ageRange: [31, 50],
    domain: 'family',
    description: 'what you built, the people you committed to, career peak, family life, what mattered most and why',
  },
  {
    id: 'later',
    label: 'Later life',
    years: '51–70',
    ageRange: [51, 70],
    domain: 'lessons',
    description: 'wisdom accumulated, children grown, career winding down, the view from here, what came into focus',
  },
  {
    id: 'reflection',
    label: 'Reflection',
    years: 'Looking back',
    ageRange: null,
    domain: 'values',
    description: 'looking back across the whole life, what it all adds up to, what you would say to your younger self, what you want to leave behind',
  },
]

const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id:   { type: 'string' },
          text: { type: 'string' },
          hint: { type: 'string' },
        },
        required: ['id', 'text', 'hint'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
}

function buildSystemPrompt(
  chapter: ChapterMeta,
  profile: Record<string, string | null>,
  entrySummary: string,
): string {
  const today = new Date().toISOString().slice(0, 10)
  const age = profile.dob
    ? Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null

  // Work out the calendar years for this chapter based on birth year
  let chapterYearRange = ''
  if (chapter.ageRange && profile.dob) {
    const birthYear = new Date(profile.dob).getFullYear()
    const fromYear = birthYear + chapter.ageRange[0]
    const toYear = birthYear + chapter.ageRange[1]
    chapterYearRange = ` (approximately ${fromYear}–${toYear})`
  }

  const lines: string[] = [
    `Today's date: ${today}. Use this as the authoritative reference for any year calculations — never guess the current year from training data.`,
    '',
    'You are a master biographer and life-story interviewer. Your job is to generate exactly 5 deeply personal, era-specific questions for a structured life-review chapter.',
    '',
    '## THE PERSON',
    `Name: ${profile.display_name ?? profile.legal_name ?? 'Unknown'}`,
    age ? `Current age: ${age}` : '',
    profile.dob ? `Born: ${profile.dob}` : '',
    profile.relationship_status ? `Relationship status: ${profile.relationship_status}` : '',
    profile.location ? `Lives in: ${profile.location}` : '',
    profile.life_description ? `About their life: "${profile.life_description}"` : '',
    '',
    '## THE CHAPTER',
    `Chapter: ${chapter.label} (${chapter.years})${chapterYearRange}`,
    `Focus: ${chapter.description}`,
    '',
    '## YOUR MISSION',
    `Generate exactly 5 reflection questions for the "${chapter.label}" chapter of this person's life. These questions should:`,
    '- Be specific to the ERA and AGE RANGE of this chapter — reference the actual decades and what was happening in the world then if relevant',
    '- Build a COMPLETE picture of that life period when answered together',
    '- Be deeply personal, not generic — tailored to who this person is',
    '- Progress from concrete memories to deeper meaning',
    '- Each question should open a different door: one about place/environment, one about people/relationships, one about identity/feelings, one about events/turning-points, one about meaning/legacy',
    '- Be worded with warmth and elegant simplicity — the kind of question a great biographer or wise elder would ask',
    '',
    '## EACH QUESTION MUST HAVE',
    '- id: a short snake_case identifier (e.g. "early_home", "teen_first_love")',
    '- text: the question itself (under 80 words, open-ended, specific)',
    '- hint: a gentle one-sentence prompt if they get stuck (e.g. "Think about a specific afternoon — a smell, a sound, a feeling.")',
    '',
    '## ABSOLUTE RULES',
    '1. Return EXACTLY 5 questions — no more, no less',
    '2. Never ask about events clearly outside this chapter\'s age range',
    '3. Never repeat or be derivative of questions they have already answered (see below)',
    '4. Make each question meaningfully different — covering different aspects of that era',
    entrySummary ? '' : '',
    entrySummary,
  ].filter((l) => l !== undefined)

  return lines.join('\n')
}

export async function getLifeReviewChapter(chapterId: string): Promise<{
  questions: LifeReviewQuestion[]
  chapterLabel: string
  error?: string
}> {
  const chapter = CHAPTERS.find((c) => c.id === chapterId)
  if (!chapter) {
    return { questions: [], chapterLabel: '', error: 'Unknown chapter' }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { questions: [], chapterLabel: chapter.label, error: 'Not authenticated' }

    const service = createServiceClient()

    const [profileResult, entriesResult] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      service
        .from('soul_entries')
        .select('user_id, domain, content, created_at')
        .eq('user_id', user.id)
        .eq('domain', chapter.domain)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    const profile = (profileResult.data ?? {}) as Record<string, string | null>
    const entries = (entriesResult.data ?? []) as { user_id: string; domain: string; content: string; created_at: string }[]

    // ── Layer 4 guard: assert ownership before any data enters the AI context ──
    assertUserOwnership(entries, user.id, 'life-review/entries')

    const entrySummary = entries.length > 0
      ? '\n## WHAT THEY HAVE ALREADY SHARED IN THIS DOMAIN (avoid repeating these topics)\n' +
        entries.slice(0, 15).map((e) => `- "${e.content.slice(0, 100)}${e.content.length > 100 ? '…' : ''}"`).join('\n')
      : ''

    const client = getOpenAIClient()

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.85,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'life_review_questions',
          strict: true,
          schema: QUESTIONS_SCHEMA,
        },
      },
      messages: [
        {
          role: 'system',
          // aiContextHeader binds user_id at the prompt level (layer 5 isolation)
          content: aiContextHeader(user.id) + buildSystemPrompt(chapter, profile, entrySummary),
        },
        {
          role: 'user',
          content: `Generate 5 questions for the "${chapter.label}" chapter.`,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) throw new Error('No response from AI')

    const parsed = JSON.parse(raw) as { questions: LifeReviewQuestion[] }

    return {
      questions: parsed.questions,
      chapterLabel: chapter.label,
    }
  } catch (err) {
    console.error('[life-review] question generation failed:', err)
    return {
      questions: [],
      chapterLabel: chapter.label,
      error: 'Could not generate questions. Please try again.',
    }
  }
}
