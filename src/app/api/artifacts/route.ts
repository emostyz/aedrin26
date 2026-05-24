import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const MAX_SIZE = 52_428_800 // 50 MB
const MAX_TEXT_SIZE = 10_485_760 // 10 MB for text/plain

// Strict MIME allowlist — mirrors the bucket's allowed_mime_types in migration 007
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm',
  'video/mp4', 'video/webm',
  'text/plain',
])

/**
 * Verify the actual file content matches the declared MIME type by checking
 * magic bytes. Prevents e.g. an HTML file uploaded with type=image/jpeg.
 * Returns true if the bytes are consistent with the declared type.
 */
async function verifyMagicBytes(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())

  switch (file.type) {
    case 'image/jpeg':
      return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF

    case 'image/png':
      return bytes[0] === 0x89 && bytes[1] === 0x50 &&
             bytes[2] === 0x4E && bytes[3] === 0x47

    case 'image/gif':
      return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46

    case 'image/webp':
      // RIFF????WEBP
      return bytes[0] === 0x52 && bytes[1] === 0x49 &&
             bytes[2] === 0x46 && bytes[3] === 0x46 &&
             bytes[8] === 0x57 && bytes[9] === 0x45 &&
             bytes[10] === 0x42 && bytes[11] === 0x50

    case 'application/pdf':
      // %PDF
      return bytes[0] === 0x25 && bytes[1] === 0x50 &&
             bytes[2] === 0x44 && bytes[3] === 0x46

    case 'audio/mpeg':
      // ID3 tag or MP3 sync word
      return (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
             (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)

    case 'audio/wav':
      // RIFF????WAVE
      return bytes[0] === 0x52 && bytes[1] === 0x49 &&
             bytes[2] === 0x46 && bytes[3] === 0x46

    case 'audio/ogg':
      // OggS
      return bytes[0] === 0x4F && bytes[1] === 0x67 &&
             bytes[2] === 0x67 && bytes[3] === 0x53

    // For audio/mp4, audio/webm, video/mp4, video/webm, text/plain:
    // signatures vary too much; trust the MIME type + bucket policy.
    default:
      return true
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })

  // ── Validate size ──────────────────────────────────────────────────────────
  const effectiveMax = file.type === 'text/plain' ? MAX_TEXT_SIZE : MAX_SIZE
  if (file.size > effectiveMax) {
    return NextResponse.json(
      { error: `File exceeds ${effectiveMax / 1_048_576} MB limit.` },
      { status: 413 },
    )
  }

  // ── Validate MIME type ─────────────────────────────────────────────────────
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'File type not permitted. Allowed: images, PDF, audio, video, text.' },
      { status: 415 },
    )
  }

  // ── Verify magic bytes match declared MIME ─────────────────────────────────
  const magicOk = await verifyMagicBytes(file)
  if (!magicOk) {
    return NextResponse.json(
      { error: 'File content does not match its declared type.' },
      { status: 422 },
    )
  }

  // ── Safe file extension (from MIME, not from filename) ─────────────────────
  const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'application/pdf': 'pdf',
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg',
    'audio/wav': 'wav', 'audio/webm': 'weba',
    'video/mp4': 'mp4', 'video/webm': 'webm',
    'text/plain': 'txt',
  }
  const ext  = MIME_TO_EXT[file.type] ?? 'bin'
  const path = `${user.id}/${Date.now()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

  const service = createServiceClient()
  const { error } = await service.storage.from('artifacts').upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // For private buckets, return the storage path — callers request signed URLs
  // via /api/artifacts/signed?path=... when they need to display the file.
  const { data: { publicUrl } } = service.storage.from('artifacts').getPublicUrl(path)

  // Display name: use original filename, stripped of any path traversal chars
  const safeName = file.name.replace(/[^a-zA-Z0-9._\-\s]/g, '').slice(0, 255) || `file.${ext}`

  return NextResponse.json({ url: publicUrl, path, name: safeName, type: file.type })
}
