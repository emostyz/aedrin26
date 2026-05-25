import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { RepDocumentType } from '@/lib/supabase/types'

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const ALLOWED_DOC_TYPES = new Set<RepDocumentType>(['government_id', 'relationship_proof', 'other'])
const MAX_BYTES = 10 * 1024 * 1024

/** Verify the first bytes of the decoded buffer match the declared MIME type. */
function verifyMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  switch (mimeType) {
    case 'application/pdf':
      return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
    case 'image/jpeg':
      return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
    case 'image/png':
      return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
    case 'image/webp':
      return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
             bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    default:
      return false
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { requestId, fileType, fileData, docType } = await request.json() as {
    requestId: string
    fileName: string
    fileType: string
    fileData: string
    docType: RepDocumentType
  }

  if (!requestId || !fileType || !fileData || !docType) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }
  if (!ALLOWED_DOC_TYPES.has(docType)) {
    return NextResponse.json({ error: 'Invalid document type.' }, { status: 400 })
  }

  const normalizedType = fileType.split(';')[0].trim().toLowerCase()
  if (!ALLOWED_MIME_TYPES.has(normalizedType)) {
    return NextResponse.json({ error: 'Only PDF, JPEG, PNG, or WebP files are accepted.' }, { status: 415 })
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(fileData, 'base64')
  } catch {
    return NextResponse.json({ error: 'Invalid file data.' }, { status: 400 })
  }
  if (buffer.byteLength === 0) return NextResponse.json({ error: 'Empty file.' }, { status: 400 })
  if (buffer.byteLength > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 10 MB).' }, { status: 413 })

  const header = new Uint8Array(buffer.buffer, 0, Math.min(12, buffer.byteLength))
  if (!verifyMagicBytes(header, normalizedType)) {
    return NextResponse.json({ error: 'File content does not match its declared type.' }, { status: 422 })
  }

  const service = createServiceClient()

  // Ownership: the request must belong to this requester and still be open for docs.
  const { data: req } = (await service
    .from('access_requests')
    .select('id, status')
    .eq('id', requestId)
    .eq('requester_user_id', user.id)
    .maybeSingle()) as { data: { id: string; status: string } | null }

  if (!req) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  if (!['submitted', 'docs_submitted'].includes(req.status)) {
    return NextResponse.json({ error: 'This request can no longer accept documents.' }, { status: 400 })
  }

  const ext = MIME_TO_EXT[normalizedType]!
  const path = `${requestId}/${Date.now()}.${ext}`

  const { error: uploadError } = await service.storage
    .from('representative-documents')
    .upload(path, buffer, { contentType: normalizedType, upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { error: insertError } = await service
    .from('access_request_documents')
    .insert({ request_id: requestId, document_url: path, type: docType })
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  await service.from('access_requests').update({ status: 'docs_submitted' }).eq('id', requestId)

  return NextResponse.json({ path, uploaded: true })
}
