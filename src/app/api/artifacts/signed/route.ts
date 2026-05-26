import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const SIGNED_URL_TTL = 3600 // 1 hour

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = new URL(request.url).searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path parameter.' }, { status: 400 })

  // Enforce ownership: paths are stored as `{userId}/{filename}` — the prefix
  // must exactly match the authenticated user's id. Prevents users from
  // generating signed URLs for other users' artifacts.
  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data, error } = await service.storage
    .from('artifacts')
    .createSignedUrl(path, SIGNED_URL_TTL)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? 'Could not generate URL.' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl, expiresIn: SIGNED_URL_TTL })
}
