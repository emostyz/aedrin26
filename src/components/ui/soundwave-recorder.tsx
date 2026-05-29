'use client'

/**
 * SoundwaveRecorder
 * Records audio via MediaRecorder, visualises the waveform on a canvas,
 * then transcribes the recording via OpenAI Whisper (/api/transcribe).
 *
 * Why not Web Speech API?
 *  – Chrome-only; silent failures in Safari/Firefox; requires Google's cloud
 *    even for on-device hardware; no way to detect when it's unavailable.
 * Whisper works in every browser that supports MediaRecorder (all modern browsers).
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'

export interface SoundwaveRecorderProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  className?: string
  /** Height of the waveform canvas in px (default 40) */
  canvasHeight?: number
}

const BAR_COUNT = 36
const BAR_W     = 2
const BAR_GAP   = 2
const CANVAS_W  = BAR_COUNT * (BAR_W + BAR_GAP) - BAR_GAP  // 142 px

type RecorderState = 'idle' | 'recording' | 'processing'

export function SoundwaveRecorder({
  onTranscript,
  disabled,
  className,
  canvasHeight = 40,
}: SoundwaveRecorderProps) {
  const [state, setState]         = useState<RecorderState>('idle')
  const [error, setError]         = useState<string | null>(null)
  const [supported, setSupported] = useState(false)

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number>(0)
  const analyserRef  = useRef<AnalyserNode | null>(null)
  const audioCtxRef  = useRef<AudioContext | null>(null)
  const streamRef    = useRef<MediaStream | null>(null)
  const recRef       = useRef<MediaRecorder | null>(null)
  const chunksRef    = useRef<BlobPart[]>([])

  // Support check — any browser with MediaRecorder + getUserMedia works
  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
      !!window.MediaRecorder &&
      !!navigator.mediaDevices?.getUserMedia
    )
  }, [])

  // ── Waveform draw loop ─────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas   = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr  = window.devicePixelRatio || 1
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(data)

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = getComputedStyle(canvas).color || '#fff'

    const midY = canvas.height / 2 / dpr

    for (let i = 0; i < BAR_COUNT; i++) {
      const amp  = data[i] / 255
      const base = 4
      const barH = base + amp * (canvasHeight - base - 4)
      const x    = i * (BAR_W + BAR_GAP)
      const y    = midY - barH / 2

      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(x, y, BAR_W, barH, 1)
      } else {
        ctx.rect(x, y, BAR_W, barH)
      }
      ctx.fill()
    }

    rafRef.current = requestAnimationFrame(drawFrame)
  }, [canvasHeight])

  // ── Start recording ────────────────────────────────────────────────────────
  async function start() {
    if (disabled || state !== 'idle') return
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      // Audio analyser for the waveform visualisation
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioCtx()
      audioCtxRef.current = audioCtx

      const analyser = audioCtx.createAnalyser()
      analyser.fftSize               = 128
      analyser.smoothingTimeConstant = 0.82
      analyserRef.current = analyser

      audioCtx.createMediaStreamSource(stream).connect(analyser)

      // Pick the best supported MIME type for MediaRecorder
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find((m) => MediaRecorder.isTypeSupported(m)) ?? ''

      chunksRef.current = []
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const mimeUsed = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeUsed })
        chunksRef.current = []

        // Animation-frame cleanup happens via the canvas effect when state
        // transitions out of 'recording' — no need to duplicate it here.
        streamRef.current?.getTracks().forEach((t) => t.stop())
        audioCtxRef.current?.close().catch(() => {})
        analyserRef.current = null

        if (blob.size < 1000) {
          // Probably silence or an instantly-stopped recording
          setState('idle')
          return
        }

        setState('processing')

        try {
          const fd = new FormData()
          fd.append('audio', blob, `recording.${mimeUsed.includes('ogg') ? 'ogg' : mimeUsed.includes('mp4') ? 'mp4' : 'webm'}`)

          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          const json = await res.json()

          if (json.error) {
            setError(json.error)
          } else if (json.transcript?.trim()) {
            onTranscript(json.transcript.trim())
          }
        } catch {
          setError('Could not reach transcription service.')
        } finally {
          setState('idle')
        }
      }

      recorder.start()
      // Canvas setup + draw loop now run in a separate effect that fires
      // AFTER the canvas mounts (state change re-renders the component, the
      // <canvas> appears in the DOM, then the effect grabs canvasRef.current).
      // Previously we tried to access canvasRef inside start() — before any
      // re-render — which threw on the non-null assertion and got swallowed
      // by the catch below as a misleading "Microphone access was denied".
      setState('recording')
    } catch (err) {
      console.error('[SoundwaveRecorder] Mic access error:', err)
      setError('Microphone access was denied.')
      setState('idle')
    }
  }

  // ── Canvas setup + draw loop ────────────────────────────────────────────────
  // Runs when state becomes 'recording' — at this point React has committed
  // the re-render and the <canvas> element is in the DOM, so canvasRef is
  // populated. Cleans up on state change (stop, error, unmount).
  useEffect(() => {
    if (state !== 'recording') return
    const canvas = canvasRef.current
    if (!canvas || !analyserRef.current) return

    const dpr = window.devicePixelRatio || 1
    canvas.width  = CANVAS_W * dpr
    canvas.height = canvasHeight * dpr
    canvas.getContext('2d')?.scale(dpr, dpr)

    rafRef.current = requestAnimationFrame(drawFrame)
    return () => {
      cancelAnimationFrame(rafRef.current)
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [state, drawFrame, canvasHeight])

  // ── Stop recording ─────────────────────────────────────────────────────────
  function stop() {
    if (state !== 'recording') return
    recRef.current?.stop()
    // onstop handles the rest
  }

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      recRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      audioCtxRef.current?.close().catch(() => {})
    }
  }, [])

  if (!supported) return null

  const isRecording   = state === 'recording'
  const isProcessing  = state === 'processing'

  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      {/* Mic / stop / spinner button */}
      <button
        type="button"
        onClick={isRecording ? stop : start}
        disabled={disabled || isProcessing}
        aria-label={isRecording ? 'Stop recording' : isProcessing ? 'Processing…' : 'Record voice response'}
        className={`relative w-8 h-8 rounded-full flex items-center justify-center border shrink-0 transition-all duration-300 ${
          isRecording
            ? 'border-foreground bg-foreground text-background'
            : isProcessing
              ? 'border-border text-muted-foreground opacity-60'
              : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
        } disabled:opacity-30`}
      >
        {isProcessing ? (
          /* Spinner while Whisper processes */
          <motion.span
            className="w-3 h-3 border border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
          />
        ) : isRecording ? (
          /* Pulsing ring + stop square */
          <>
            <motion.span
              className="absolute inset-0 rounded-full border border-foreground/40"
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeOut' }}
            />
            <span className="w-2.5 h-2.5 bg-current rounded-[2px]" />
          </>
        ) : (
          /* Mic SVG */
          <svg width="12" height="15" viewBox="0 0 12 15" fill="none" aria-hidden>
            <rect x="3.5" y="0.75" width="5" height="8" rx="2.5"
              stroke="currentColor" strokeWidth="1.25" />
            <path d="M1 7C1 9.76 3.24 12 6 12s5-2.24 5-5"
              stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            <line x1="6" y1="12" x2="6" y2="14.25"
              stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Waveform canvas (recording only) */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: CANVAS_W }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden shrink-0"
            style={{ height: canvasHeight }}
          >
            <canvas
              ref={canvasRef}
              className="text-foreground"
              style={{ width: CANVAS_W, height: canvasHeight }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status label */}
      <AnimatePresence mode="wait">
        {isRecording && (
          <motion.span
            key="listening"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[10px] text-muted-foreground tracking-wider"
          >
            Listening…
          </motion.span>
        )}
        {isProcessing && (
          <motion.span
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[10px] text-muted-foreground tracking-wider"
          >
            Transcribing…
          </motion.span>
        )}
        {error && (
          <motion.span
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[10px] text-destructive"
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
