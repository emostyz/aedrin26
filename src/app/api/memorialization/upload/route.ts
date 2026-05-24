import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { requestId, fileName, fileType, fileData } = body as {
    requestId: string
    fileName: string
    fileType: string
    fileData: string // base64
  }

  if (!requestId || !fileName || !fileData) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify this executor owns the request
  const { data: req } = await service
    .from('memorialization_requests')
    .select('id, status')
    .eq('id', requestId)
    .eq('initiated_by_executor_email', user.email!.toLowerCase())
    .single() as { data: { id: string; status: string } | null }

  if (!req) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  if (req.status !== 'pending') return NextResponse.json({ error: 'Request is not in pending state.' }, { status: 400 })

  const buffer = Buffer.from(fileData, 'base64')
  const path = `${requestId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const { error: uploadError } = await service.storage
    .from('verification-documents')
    .upload(path, buffer, { contentType: fileType, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = service.storage
    .from('verification-documents')
    .getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
