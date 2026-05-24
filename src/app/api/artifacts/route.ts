import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })

  const maxBytes = 52_428_800
  if (file.size > maxBytes) return NextResponse.json({ error: 'File exceeds 50 MB limit.' }, { status: 413 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `${user.id}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const service = createServiceClient()
  const { error } = await service.storage.from('artifacts').upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = service.storage.from('artifacts').getPublicUrl(path)

  return NextResponse.json({ url: publicUrl, name: file.name, type: file.type })
}
