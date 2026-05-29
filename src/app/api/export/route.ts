import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Explicit allow-list on the users table — never `select('*')` here.
  // A future migration that adds an internal flag (admin_role, support_notes,
  // moderation_status, etc.) should NOT silently start landing in user-facing
  // exports. Adding a column to this list is a deliberate decision.
  const USER_EXPORT_COLUMNS = [
    'id', 'email', 'legal_name', 'display_name', 'dob', 'photo_url',
    'account_state', 'relationship_status', 'location', 'company',
    'job_title', 'job_happiness', 'career_goals',
    'family_description', 'life_description',
    'biggest_regret', 'life_purpose',
    'onboarding_complete', 'setup_complete', 'reminders_enabled',
    'last_reminded_on', 'created_at', 'updated_at',
  ].join(', ')

  const [
    { data: profile },
    { data: entries },
    { data: lifeEvents },
    { data: valueSummaries },
    { data: heirs },
    { data: executors },
    { data: dailyPrompts },
    { data: dailyInsights },
    { data: memorialization },
    { data: customQuestions },
  ] = await Promise.all([
    supabase.from('users').select(USER_EXPORT_COLUMNS).eq('id', user.id).single(),
    supabase.from('soul_entries').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('life_events').select('*').eq('user_id', user.id).order('event_date'),
    supabase.from('value_summaries').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('heirs').select('id, name, relationship, email, access_status, created_at').eq('user_id', user.id),
    supabase.from('executors').select('id, name, email, created_at').eq('user_id', user.id),
    supabase.from('daily_prompts').select('id, prompt_text, domain, delivered_date, soul_entry_id, created_at').eq('user_id', user.id).order('delivered_date'),
    supabase.from('daily_insights').select('id, insight_text, recommendation, pattern_sources, delivered_date, created_at').eq('user_id', user.id).order('delivered_date'),
    supabase.from('memorialization_requests').select('id, initiated_by_executor_email, status, grace_period_ends_at, decided_by, decided_at, notes, created_at, updated_at').eq('user_id', user.id).order('created_at'),
    // Custom questions added by the user (may fail gracefully if table doesn't exist yet)
    supabase.from('custom_questions').select('id, domain, text, ord, created_at').eq('user_id', user.id).order('created_at'),
  ])

  // Separate final letters from regular soul entries for clarity in the export
  const allEntries = (entries ?? []) as Record<string, unknown>[]
  const finalLetters = allEntries.filter((e) => e.bound_recipient_id !== null)
  const soulEntries  = allEntries.filter((e) => e.bound_recipient_id === null)

  const exportData = {
    exported_at: new Date().toISOString(),
    schema_version: '1.2',
    profile,
    soul_entries: soulEntries,
    final_letters: finalLetters,
    life_events: lifeEvents ?? [],
    value_summaries: valueSummaries ?? [],
    heirs: heirs ?? [],
    executors: executors ?? [],
    custom_questions: customQuestions ?? [],
    daily_prompts: dailyPrompts ?? [],
    daily_insights: dailyInsights ?? [],
    memorialization_history: memorialization ?? [],
  }

  const fileName = `aedrin-export-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
