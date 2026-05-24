'use client'

/**
 * SoundwaveRecorder
 * Canvas-based real-time audio visualiser + Web Speech API transcript.
 * Zero React re-renders during recording — all animation is done directly on a <canvas>.
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
const BAR_W     = 2   // px per bar
const BAR_GAP   = 2   // px between bars
const CANVAS_W  = BAR_COUNT * (BAR_W + BAR_GAP) - BAR_GAP  // 142

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
  }
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onend:    (() => void) | null
  onerror:  ((e: Event) => void) | null
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  [index: number]: { transcript: string }
}

export function SoundwaveRecorder({
  onTranscript,
  disabled,
  className,
  canvasHeight = 40,
}: SoundwaveRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [supported, setSupported]     = useState(false)

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number>(0)
  const analyserRef  = useRef<AnalyserNode | null>(null)
  const audioCtxRef  = useRef<AudioContext | null>(null)
  const streamRef    = useRef<MediaStream | null>(null)
  const recRef       = useRef<SpeechRecognitionInstance | null>(null)
  const activeRef    = useRef(false)   // tracks live recording state for onend restart

  useEffect(() => {
    const hasSR  = typeof window !== 'undefined' &&
                   !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)
    const hasMic = typeof navigator !== 'undefined' &&
                   !!navigator.mediaDevices?.getUserMedia
    setSupported(hasSR && hasMic)
  }, [])

  // ── Draw loop ──────────────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas   = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx  = canvas.getContext('2d')
    if (!ctx) return

    const dpr  = window.devicePixelRatio || 1
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(data)

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Get foreground colour from the canvas element (set via text-foreground class)
    const color = getComputedStyle(canvas).color || '#fff'
    ctx.fillStyle = color

    const midY = canvas.height / 2 / dpr

    for (let i = 0; i < BAR_COUNT; i++) {
      const amp    = data[i] / 255
      // minimum 4 px, with a gentle idle sine to show it's alive
      const base   = 4
      const maxAdd = canvasHeight - base - 4
      const barH   = base + amp * maxAdd

      const x = i * (BAR_W + BAR_GAP)
      const y = midY - barH / 2

      ctx.beginPath()
      // roundRect might not exist on older Safari — fall back to fillRect
      if (ctx.roundRect) {
        ctx.roundRect(x, y, BAR_W, barH, 1)
      } else {
        ctx.rect(x, y, BAR_W, barH)
      }
      ctx.fill()
    }

    rafRef.current = requestAnimationFrame(drawFrame)
  }, [canvasHeight])

  // ── Start ──────────────────────────────────────────────────────────────────
  async function start() {
    if (disabled) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const AudioCtx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx  = new AudioCtx()
      audioCtxRef.current = audioCtx

      const analyser = audioCtx.createAnalyser()
      analyser.fftSize                = 128    // 64 frequency bins
      analyser.smoothingTimeConstant  = 0.82   // smooth but responsive
      analyserRef.current = analyser

      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      // Scale canvas for hi-DPI
      const canvas = canvasRef.current!
      const dpr    = window.devicePixelRatio || 1
      canvas.width  = CANVAS_W * dpr
      canvas.height = canvasHeight * dpr
      canvas.getContext('2d')!.scale(dpr, dpr)

      activeRef.current = true
      setIsRecording(true)
      rafRef.current = requestAnimationFrame(drawFrame)

      // Speech recognition
      const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
      const rec = new SR()
      rec.continuous     = true
      rec.interimResults = true
      rec.lang           = 'en-US'
      recRef.current     = rec

      rec.onresult = (e: SpeechRecognitionEvent) => {
        let t = ''
        for (let i = 0; i < e.results.length; i++) {
          t += e.results[i][0].transcript
        }
        onTranscript(t)
      }

      // Auto-restart on end while still "active"
      rec.onend = () => {
        if (activeRef.current) {
          try { rec.start() } catch { /* already stopped */ }
        }
      }

      rec.start()
    } catch (err) {
      console.error('[SoundwaveRecorder] Cannot access microphone:', err)
      activeRef.current = false
      setIsRecording(false)
    }
  }

  // ── Stop ───────────────────────────────────────────────────────────────────
  function stop() {
    activeRef.current = false
    cancelAnimationFrame(rafRef.current)
    recRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    analyserRef.current = null

    // Clear canvas
    const canvas = canvasRef.current
    if (canvas) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    }

    setIsRecording(false)
  }

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      activeRef.current = false
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      audioCtxRef.current?.close().catch(() => {})
    }
  }, [])

  if (!supported) return null

  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      {/* Mic / stop button */}
      <button
        type="button"
        onClick={isRecording ? stop : start}
        disabled={disabled}
        aria-label={isRecording ? 'Stop recording' : 'Record voice response'}
        className={`relative w-8 h-8 rounded-full flex items-center justify-center border shrink-0 transition-all duration-300 ${
          isRecording
            ? 'border-foreground bg-foreground text-background'
            : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
        } disabled:opacity-30`}
      >
        {isRecording ? (
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

      {/* Waveform canvas */}
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

      {/* "Listening" label */}
      <AnimatePresence>
        {isRecording && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[10px] text-muted-foreground tracking-wider"
          >
            Listening…
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
