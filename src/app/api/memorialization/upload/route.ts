import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// Only documents and images are acceptable proof-of-death evidence
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// 10 MB max — matches bucket policy
const MAX_BYTES = 10 * 1024 * 1024

/** Verify the first bytes of the decoded buffer match the declared MIME type. */
function verifyMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  switch (mimeType) {
    case 'application/pdf':
      return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 // %PDF
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

  const body = await request.json()
  const { requestId, fileName, fileType, fileData } = body as {
    requestId: string
    fileName: string
    fileType: string
    fileData: string // base64
  }

  if (!requestId || !fileName || !fileType || !fileData) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  // ── MIME allowlist (client-supplied fileType is untrusted — validate it) ──
  const normalizedType = fileType.split(';')[0].trim().toLowerCase()
  if (!ALLOWED_MIME_TYPES.has(normalizedType)) {
    return NextResponse.json(
      { error: 'Only PDF, JPEG, PNG, or WebP files are accepted.' },
      { status: 415 },
    )
  }

  // ── Decode and size-check before touching any storage ─────────────────────
  let buffer: Buffer
  try {
    buffer = Buffer.from(fileData, 'base64')
  } catch {
    return NextResponse.json({ error: 'Invalid file data.' }, { status: 400 })
  }

  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: 'Empty file.' }, { status: 400 })
  }
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10 MB).' }, { status: 413 })
  }

  // ── Magic byte check — ensure bytes match declared type ───────────────────
  const header = new Uint8Array(buffer.buffer, 0, Math.min(12, buffer.byteLength))
  if (!verifyMagicBytes(header, normalizedType)) {
    return NextResponse.json(
      { error: 'File content does not match its declared type.' },
      { status: 422 },
    )
  }

  const service = createServiceClient()

  // ── Verify this executor initiated the request (ownership check) ───────────
  const { data: req } = await service
    .from('memorialization_requests')
    .select('id, status')
    .eq('id', requestId)
    .eq('initiated_by_executor_email', user.email!.toLowerCase())
    .single() as { data: { id: string; status: string } | null }

  if (!req) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  if (req.status !== 'pending') {
    return NextResponse.json({ error: 'Request is not in pending state.' }, { status: 400 })
  }

  // ── Safe path: extension from MIME (never from filename), requestId scoped ──
  const ext  = MIME_TO_EXT[normalizedType]!
  const path = `${requestId}/${Date.now()}.${ext}`

  const { error: uploadError } = await service.storage
    .from('verification-documents')
    .upload(path, buffer, { contentType: normalizedType, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // ── Return the storage path only — verification-documents is private.
  //    Admins access files via the Supabase dashboard or a signed URL.
  //    Never return a public URL for sensitive legal documents.
  return NextResponse.json({ path, uploaded: true })
}
