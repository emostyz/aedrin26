import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

/** Verify the file actually matches the declared image type via magic bytes. */
function verifyImageMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF

    case 'image/png':
      return bytes[0] === 0x89 && bytes[1] === 0x50 &&
             bytes[2] === 0x4E && bytes[3] === 0x47

    case 'image/webp':
      return bytes[0] === 0x52 && bytes[1] === 0x49 &&
             bytes[2] === 0x46 && bytes[3] === 0x46 &&
             bytes[8] === 0x57 && bytes[9] === 0x45 &&
             bytes[10] === 0x42 && bytes[11] === 0x50

    default:
      return false
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // File is sent as raw binary body; Content-Type header carries the MIME type.
  // This avoids multipart/FormData parsing which is unreliable in dev under Turbopack.
  const mimeType = (request.headers.get('content-type') ?? '').split(';')[0].trim()
  const contentLength = Number(request.headers.get('content-length') ?? '0')

  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: 'Invalid file type. Use JPEG, PNG, or WebP.' },
      { status: 415 },
    )
  }

  if (contentLength > MAX_SIZE) {
    return NextResponse.json(
      { error: 'File too large (max 5 MB).' },
      { status: 413 },
    )
  }

  const arrayBuffer = await request.arrayBuffer()

  if (arrayBuffer.byteLength === 0) {
    return NextResponse.json({ error: 'Empty file.' }, { status: 400 })
  }

  if (arrayBuffer.byteLength > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5 MB).' }, { status: 413 })
  }

  // Magic-byte check: reject if actual bytes don't match the declared type
  const bytes = new Uint8Array(arrayBuffer.slice(0, 12))
  if (!verifyImageMagicBytes(bytes, mimeType)) {
    return NextResponse.json(
      { error: 'File content does not match its declared type.' },
      { status: 422 },
    )
  }

  const service = createServiceClient()
  // Derive extension from MIME, never from the filename (prevents extension smuggling)
  const ext  = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType]!
  const path = `${user.id}/avatar.${ext}`
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await service.storage
    .from('avatars')
    .upload(path, buffer, { contentType: mimeType, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = service.storage.from('avatars').getPublicUrl(path)

  // Bust CDN cache by appending timestamp
  const url = `${publicUrl}?t=${Date.now()}`

  const { error: updateError } = await service
    .from('users')
    .update({ photo_url: url })
    .eq('id', user.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ url })
}
