'use client'

import { FadeUp } from '@/components/ui/motion'

export type StreakState = 'never' | 'new' | 'building' | 'strong' | 'legendary' | 'lost'

export interface StreakTrackerProps {
  // ISO date strings (YYYY-MM-DD) for days that have at least one entry (last 14 days)
  activeDates: string[]
  // current streak count (consecutive days ending today or yesterday)
  streakDays: number
  // streak phase
  streakState: StreakState
}

const MESSAGES: Record<StreakState, string[]> = {
  never: [
    "Begin today. Your future self will thank you.",
    "Every great story starts with a first sentence.",
    "The best time to start was yesterday. Now is second best.",
    "One memory captured is one memory saved forever.",
  ],
  new: [
    "You've started. That's the hardest part.",
    "One day becomes two. Two becomes a habit.",
    "A small flame. Keep it burning.",
    "Day one is behind you. That matters more than you know.",
    "The journey begins with showing up.",
  ],
  building: [
    "Something is forming here. Don't let it stop.",
    "A few days in and already a record of who you are.",
    "The habit is taking shape. Stay with it.",
    "You're writing the kind of story that lasts.",
    "Every day adds to something irreplaceable.",
  ],
  strong: [
    "A week. You're serious about this.",
    "Seven days of truth. Keep going.",
    "You've built something real. Your heirs will read this.",
    "Something rare is happening here.",
    "A week of showing up — that's more than most people ever do.",
  ],
  legendary: [
    "You're building something that will outlast you.",
    "Two weeks in. This is no longer a habit — it's who you are.",
    "Rare. Precious. Keep going.",
    "Your consistency is an act of love for the people who will miss you.",
    "This is what it looks like to leave something real behind.",
  ],
  lost: [
    "Every story has a pause. Begin again.",
    "The silence won't erase what you've already written.",
    "A streak broken is still a story started.",
    "Missing a day doesn't undo everything before it.",
    "The hard part isn't starting again — it's forgiving the gap.",
  ],
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function StreakTracker({ activeDates, streakDays, streakState }: StreakTrackerProps) {
  const activeSet = new Set(activeDates)

  // Build the last 7 days: index 0 = 6 days ago, index 6 = today
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().slice(0, 10)
    const dayLetter = DAY_LETTERS[d.getDay()]
    const isToday = dateStr === todayStr
    const isActive = activeSet.has(dateStr)
    return { dateStr, dayLetter, isToday, isActive }
  })

  // Rotate message by day of month
  const messages = MESSAGES[streakState]
  const message = messages[today.getDate() % messages.length]

  return (
    <FadeUp delay={0.08}>
      <div className="space-y-4">
        {/* Section header */}
        <p className="text-label">Your streak</p>

        {/* Day squares */}
        <div className="flex items-end gap-2">
          {days.map(({ dateStr, dayLetter, isToday, isActive }) => (
            <div key={dateStr} className="flex flex-col items-center gap-1.5">
              <div
                className={
                  isActive
                    ? 'w-7 h-7 rounded-md bg-foreground'
                    : isToday
                    ? 'w-7 h-7 rounded-md border border-border bg-transparent relative'
                    : 'w-7 h-7 rounded-md bg-border/40'
                }
              >
                {isToday && !isActive && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-foreground/30" />
                )}
              </div>
              <span className="text-[9px] text-muted-foreground leading-none">{dayLetter}</span>
            </div>
          ))}
        </div>

        {/* Streak count */}
        <p className="text-foreground font-light">
          {streakDays > 0 ? `${streakDays} day streak` : 'No streak yet'}
        </p>

        {/* Encouraging message */}
        <p className="text-xs text-muted-foreground leading-relaxed">{message}</p>
      </div>
    </FadeUp>
  )
}
