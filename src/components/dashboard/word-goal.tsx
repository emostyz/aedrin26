'use client'

import { useState, useEffect } from 'react'
import { motion } from '@/components/ui/motion'

const GOALS = [50, 100, 200, 500]
const STORAGE_KEY = 'aedrin_daily_word_goal'

interface Props {
  wordsWrittenToday: number
}

export function WordGoal({ wordsWrittenToday }: Props) {
  const [goal, setGoal]       = useState<number>(100)
  const [editing, setEditing] = useState(false)

  // Load persisted goal from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setGoal(Number(stored))
  }, [])

  function selectGoal(g: number) {
    setGoal(g)
    localStorage.setItem(STORAGE_KEY, String(g))
    setEditing(false)
  }

  const pct     = Math.min(100, Math.round((wordsWrittenToday / goal) * 100))
  const done    = wordsWrittenToday >= goal
  const remaining = Math.max(0, goal - wordsWrittenToday)

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-label">Today&apos;s goal</p>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {editing ? 'Done' : `${goal} words`}
        </button>
      </div>

      {editing ? (
        <div className="flex gap-2 flex-wrap">
          {GOALS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => selectGoal(g)}
              className={[
                'px-3 py-1 rounded-full text-xs border transition-all',
                g === goal
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/30',
              ].join(' ')}
            >
              {g} words
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Progress bar */}
          <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${done ? 'bg-foreground' : 'bg-foreground/50'}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {done
              ? `Goal reached · ${wordsWrittenToday.toLocaleString()} words today`
              : `${wordsWrittenToday.toLocaleString()} / ${goal} · ${remaining} to go`}
          </p>
        </div>
      )}
    </div>
  )
}
