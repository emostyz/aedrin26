'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { saveLetter, deleteLetter, updateEntry } from '@/app/actions/entries'

interface Heir {
  id: string
  name: string
  relationship: string
}

interface Letter {
  id: string
  content: string
  bound_recipient_id: string
  created_at: string
}

interface Props {
  heirs: Heir[]
  initialLetters: Letter[]
}

// Letter starters — help people begin writing
const STARTERS = [
  { label: 'What I want you to know', text: (name: string) => `Dear ${name},\n\nThere are things I've always wanted to say to you but never quite found the words. So here they are:\n\n` },
  { label: 'My proudest memory of you', text: (name: string) => `Dear ${name},\n\nOf all the memories I carry with me, one of the ones I treasure most is when you…\n\n` },
  { label: 'What I hope for your future', text: (name: string) => `Dear ${name},\n\nWhen I imagine your life ahead, I see so much possibility. What I hope for you is this:\n\n` },
  { label: 'Things I never said', text: (name: string) => `Dear ${name},\n\nThere are things I should have said more often. Things I felt but never spoke aloud. Here they are at last:\n\n` },
  { label: 'Lessons I learned the hard way', text: (name: string) => `Dear ${name},\n\nLife taught me a few things the hard way that I wish someone had told me sooner. I'm writing them down so you'll have them:\n\n` },
  { label: 'What I admire about you', text: (name: string) => `Dear ${name},\n\nI want you to know what I see when I look at you — because I don't think I've ever said it as clearly as I should have:\n\n` },
]

export function LettersComposer({ heirs, initialLetters }: Props) {
  const [letters, setLetters]           = useState<Letter[]>(initialLetters)
  const [selectedHeir, setSelectedHeir] = useState<string>(heirs[0]?.id ?? '')
  const [content, setContent]           = useState('')
  const [error, setError]               = useState<string | null>(null)
  const [saved, setSaved]               = useState(false)
  const [showStarters, setShowStarters] = useState(false)
  const [isPending, startTransition]    = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedHeirObj = heirs.find((h) => h.id === selectedHeir)
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [content])

  if (heirs.length === 0) return null

  function applyStarter(starterFn: (name: string) => string) {
    const name = selectedHeirObj?.name ?? 'you'
    setContent(starterFn(name))
    setShowStarters(false)
    setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }, 50)
  }

  function handleSave() {
    if (!content.trim() || !selectedHeir) return
    setError(null)
    startTransition(async () => {
      const result = await saveLetter(selectedHeir, content.trim())
      if (result?.error) { setError(result.error); return }
      setLetters((prev) => [{
        id: crypto.randomUUID(),
        content: content.trim(),
        bound_recipient_id: selectedHeir,
        created_at: new Date().toISOString(),
      }, ...prev])
      setContent('')
      setSaved(true)
      setShowStarters(false)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  function handleDelete(letterId: string) {
    startTransition(async () => {
      const result = await deleteLetter(letterId)
      if (!result?.error) setLetters((prev) => prev.filter((l) => l.id !== letterId))
    })
  }

  function handleUpdate(letterId: string, newContent: string) {
    setLetters((prev) => prev.map((l) => l.id === letterId ? { ...l, content: newContent } : l))
  }

  const byRecipient = heirs.map((h) => ({
    heir: h,
    letters: letters.filter((l) => l.bound_recipient_id === h.id),
  })).filter((g) => g.letters.length > 0)

  return (
    <div className="space-y-14">
      {/* ── Compose ─────────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-label">New letter</p>
            <p className="text-xs text-muted-foreground">Write as if you&apos;re speaking directly to this person.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowStarters((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-1.5"
          >
            {showStarters ? 'Hide starters' : '✦ Starter ideas'}
          </button>
        </div>

        {/* Letter starters */}
        <AnimatePresence>
          {showStarters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2">
                {STARTERS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => applyStarter(s.text)}
                    className="text-left border border-border/60 rounded-xl px-4 py-3 hover:border-foreground/20 hover:bg-surface/30 transition-all group"
                  >
                    <p className="text-xs text-foreground group-hover:text-foreground">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-1">
                      {s.text(selectedHeirObj?.name ?? 'them').slice(0, 60)}…
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* To: selector */}
        <div className="space-y-1.5">
          <label className="text-label">To</label>
          <div className="flex gap-2 flex-wrap">
            {heirs.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setSelectedHeir(h.id)}
                className={[
                  'px-3 py-1.5 rounded-full text-xs border transition-all duration-150',
                  h.id === selectedHeir
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                ].join(' ')}
              >
                {h.name}
              </button>
            ))}
          </div>
        </div>

        {/* Letter textarea */}
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave() }}
            placeholder={`Dear ${selectedHeirObj?.name ?? '…'},\n\nI want you to know…`}
            rows={10}
            className="w-full bg-input border border-border rounded-xl px-5 py-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-[1.8] transition-all font-light"
            style={{ minHeight: '240px' }}
          />

          {/* Word count + target */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/60">
              {wordCount > 0 ? `${wordCount} words` : 'Write freely — length doesn\'t matter'}
            </span>
            <span className="text-[10px] text-muted-foreground/40">⌘↵ to save</span>
          </div>
        </div>

        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={!content.trim() || !selectedHeir || isPending}
            className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            {isPending ? 'Saving…' : 'Save letter'}
          </button>
          <AnimatePresence>
            {saved && (
              <motion.p
                key="saved"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-muted-foreground"
              >
                ✓ Sealed. Will be delivered when the time comes.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Saved letters ──────────────────────────────── */}
      {byRecipient.length > 0 && (
        <div className="space-y-10 pt-8 border-t border-border">
          <div className="flex items-center gap-3">
            <p className="text-label shrink-0">Sealed letters</p>
            <div className="flex-1 h-px bg-border" />
            <p className="text-[10px] text-muted-foreground shrink-0">
              {letters.length} total · private until delivered
            </p>
          </div>

          {byRecipient.map(({ heir, letters: heirLetters }) => (
            <div key={heir.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-foreground/8 border border-border flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-medium text-muted-foreground uppercase">
                    {heir.name.charAt(0)}
                  </span>
                </div>
                <p className="text-sm text-foreground">{heir.name}</p>
                <span className="text-[10px] text-muted-foreground">{heir.relationship}</span>
                <div className="flex-1 h-px bg-border/60" />
                <p className="text-[10px] text-muted-foreground shrink-0">
                  {heirLetters.length} letter{heirLetters.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="space-y-3 pl-9">
                {heirLetters.map((letter) => (
                  <LetterCard
                    key={letter.id}
                    letter={letter}
                    isPending={isPending}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How delivery works */}
      <div className="rounded-xl border border-border/40 bg-surface/10 px-5 py-4 space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">How letters are delivered</p>
        <ol className="space-y-1.5 text-xs text-muted-foreground">
          <li>1. Your executor verifies your death and memorializes your account.</li>
          <li>2. Each letter is emailed privately and directly to the recipient.</li>
          <li>3. No one — including your heirs — can read them before that moment.</li>
        </ol>
      </div>
    </div>
  )
}

// ── Letter card ──────────────────────────────────────────────────────────────

function LetterCard({
  letter,
  isPending,
  onDelete,
  onUpdate,
}: {
  letter: Letter
  isPending: boolean
  onDelete: (id: string) => void
  onUpdate: (id: string, content: string) => void
}) {
  const [expanded, setExpanded]       = useState(false)
  const [isEditing, setIsEditing]     = useState(false)
  const [editContent, setEditContent] = useState(letter.content)
  const [savedContent, setSavedContent] = useState(letter.content)
  const [editError, setEditError]     = useState<string | null>(null)
  const [savedBrief, setSavedBrief]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [localPending, startLocal]    = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isLong = savedContent.length > 300
  const pending = isPending || localPending
  const wordCount = savedContent.trim().split(/\s+/).filter(Boolean).length

  function openEdit() {
    setEditContent(savedContent)
    setEditError(null)
    setIsEditing(true)
    setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }, 50)
  }

  function cancelEdit() {
    setEditContent(savedContent)
    setEditError(null)
    setIsEditing(false)
  }

  function saveEdit() {
    if (!editContent.trim()) return
    setEditError(null)
    startLocal(async () => {
      const result = await updateEntry(letter.id, editContent)
      if (result?.error) { setEditError(result.error); return }
      const trimmed = editContent.trim()
      setSavedContent(trimmed)
      onUpdate(letter.id, trimmed)
      setIsEditing(false)
      setSavedBrief(true)
      setTimeout(() => setSavedBrief(false), 2000)
    })
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border border-border rounded-xl px-5 py-4 space-y-3 transition-colors ${isEditing ? 'border-foreground/20' : 'hover:border-foreground/10'}`}
    >
      {/* Sealed badge */}
      {!isEditing && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground/60 uppercase tracking-widest">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Sealed
          </span>
          <span className="text-[9px] text-muted-foreground/40">·</span>
          <span className="text-[9px] text-muted-foreground/40">{wordCount} words</span>
          <span className="text-[9px] text-muted-foreground/40">·</span>
          <span className="text-[9px] text-muted-foreground/40">
            {new Date(letter.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {isEditing ? (
          <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => {
                setEditContent(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${e.target.scrollHeight}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancelEdit()
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit()
              }}
              className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm text-foreground leading-[1.8] focus:outline-none focus:ring-1 focus:ring-ring resize-none font-light"
              style={{ minHeight: '120px' }}
            />
            {editError && <p role="alert" className="text-xs text-destructive">{editError}</p>}
            <div className="flex items-center gap-3">
              <button onClick={saveEdit} disabled={!editContent.trim() || pending}
                className="bg-primary text-primary-foreground rounded-md px-3.5 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity">
                {pending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={cancelEdit} disabled={pending} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <span className="text-[10px] text-muted-foreground/40">⌘↵ to save · Esc to cancel</span>
            </div>
          </motion.div>
        ) : (
          <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className={`text-sm text-foreground leading-[1.8] whitespace-pre-wrap font-light ${!expanded && isLong ? 'line-clamp-4' : ''}`}>
              {savedContent}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
          {isLong && !isEditing && (
            <button onClick={() => setExpanded((v) => !v)} className="hover:text-muted-foreground transition-colors">
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
          <AnimatePresence>
            {savedBrief && (
              <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-muted-foreground">
                Saved.
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {!isEditing && (
          <div className="flex items-center gap-2">
            <button onClick={openEdit}
              className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors px-2 py-1 rounded border border-transparent hover:border-border">
              Edit
            </button>
            <button
              onClick={() => { if (!confirmDelete) { setConfirmDelete(true); return } onDelete(letter.id) }}
              disabled={pending}
              onBlur={() => setConfirmDelete(false)}
              className={`text-[10px] transition-colors px-2 py-1 rounded border disabled:opacity-30 ${
                confirmDelete
                  ? 'text-destructive border-destructive/20'
                  : 'text-muted-foreground/60 border-transparent hover:text-destructive hover:border-destructive/20'
              }`}
            >
              {confirmDelete ? 'Sure?' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
