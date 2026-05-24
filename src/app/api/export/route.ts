import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    { data: profile },
    { data: entries },
    { data: lifeEvents },
    { data: valueSummaries },
    { data: heirs },
    { data: executors },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('soul_entries').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('life_events').select('*').eq('user_id', user.id).order('event_date'),
    supabase.from('value_summaries').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('heirs').select('id, name, relationship, email, access_status, created_at').eq('user_id', user.id),
    supabase.from('executors').select('id, name, email, created_at').eq('user_id', user.id),
  ])

  const exportData = {
    exported_at: new Date().toISOString(),
    schema_version: '1.0',
    profile,
    soul_entries: entries ?? [],
    life_events: lifeEvents ?? [],
    value_summaries: valueSummaries ?? [],
    heirs: heirs ?? [],
    executors: executors ?? [],
  }

  const fileName = `aedrin-export-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
