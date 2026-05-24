import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// 10 MB cap — Whisper hard limit is 25 MB, we keep headroom
const MAX_AUDIO_BYTES = 10 * 1024 * 1024

const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const audio = formData.get('audio') as File | null
  if (!audio) return NextResponse.json({ error: 'No audio provided.' }, { status: 400 })
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Recording too large (max 10 MB).' }, { status: 413 })
  }

  if (audio.size === 0) {
    return NextResponse.json({ error: 'Empty recording.' }, { status: 400 })
  }

  // Validate MIME type against allowlist (strip codec params for comparison)
  const baseType = audio.type.split(';')[0].trim()
  if (!ALLOWED_AUDIO_TYPES.has(baseType) && !ALLOWED_AUDIO_TYPES.has(audio.type)) {
    return NextResponse.json({ error: 'Unsupported audio format.' }, { status: 415 })
  }

  try {
    // Whisper needs a filename with the right extension so it knows the codec
    const ext = audio.type.includes('ogg') ? 'ogg'
               : audio.type.includes('mp4') ? 'mp4'
               : audio.type.includes('mpeg') ? 'mp3'
               : audio.type.includes('wav')  ? 'wav'
               : 'webm'

    const file = new File([await audio.arrayBuffer()], `audio.${ext}`, { type: audio.type })

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
    })

    return NextResponse.json({ transcript: transcription.text })
  } catch (err: unknown) {
    console.error('[/api/transcribe]', err)
    const message = err instanceof Error ? err.message : 'Transcription failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
