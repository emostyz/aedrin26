'use client'

import { useMemo, useState } from 'react'
import { FadeUp } from '@/components/ui/motion'

interface Props {
  // YYYY-MM-DD → entry count for that day
  dateCounts: Record<string, number>
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Mon–Sun order (ISO week); labels shown on the left: show M, W, F
const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] // index 0 = Monday

function intensityClass(count: number): string {
  if (count === 0) return 'bg-border/30'
  if (count === 1) return 'bg-foreground/20'
  if (count === 2) return 'bg-foreground/40'
  if (count === 3) return 'bg-foreground/60'
  return 'bg-foreground/90'
}

/** Returns YYYY-MM-DD for a Date object (local time) */
function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday = 0 … Sunday = 6 (ISO day-of-week index) */
function isoDow(d: Date): number {
  return (d.getDay() + 6) % 7
}

export function WritingHeatmap({ dateCounts }: Props) {
  const [tooltip, setTooltip] = useState<{
    date: string
    count: number
    x: number
    y: number
  } | null>(null)

  const { weeks, monthPositions, activeDays, longestStreak, currentStreak } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = toDateStr(today)

    // Start date: Monday of the week 52 weeks ago
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 52 * 7 - isoDow(today))

    // Build grid: one column per week, rows 0–6 = Mon–Sun
    const weeks: Array<Array<{ date: string; count: number; inRange: boolean }>> = []
    const monthPos: Array<{ label: string; col: number }> = []
    let lastMonth = -1

    const current = new Date(startDate)
    while (current <= today) {
      // Start a new week column on every Monday
      if (isoDow(current) === 0) {
        weeks.push([])
        const m = current.getMonth()
        if (m !== lastMonth) {
          monthPos.push({ label: MONTH_LABELS[m], col: weeks.length - 1 })
          lastMonth = m
        }
      }
      const dateStr = toDateStr(current)
      const count = dateCounts[dateStr] ?? 0
      const inRange = dateStr <= todayStr
      weeks[weeks.length - 1].push({ date: dateStr, count, inRange })
      current.setDate(current.getDate() + 1)
    }
    // Pad last week to 7 rows
    const lastWeek = weeks[weeks.length - 1]
    while (lastWeek.length < 7) {
      lastWeek.push({ date: '', count: 0, inRange: false })
    }

    // Stats: activeDays, longestStreak, currentStreak
    let activeDays = 0
    let longestStreak = 0
    let currentStreak = 0
    let streak = 0

    // Walk from startDate to today inclusive
    const walker = new Date(startDate)
    while (walker <= today) {
      const ds = toDateStr(walker)
      const active = (dateCounts[ds] ?? 0) > 0
      if (active) {
        activeDays++
        streak++
        if (streak > longestStreak) longestStreak = streak
      } else {
        streak = 0
      }
      walker.setDate(walker.getDate() + 1)
    }

    // Current streak: consecutive days ending on today (or yesterday if today has no entry)
    const cs = new Date(today)
    let csCount = 0
    while (true) {
      const ds = toDateStr(cs)
      if ((dateCounts[ds] ?? 0) > 0) {
        csCount++
        cs.setDate(cs.getDate() - 1)
      } else {
        // Allow a single-day gap only if it's today with no entry yet
        if (ds === todayStr && csCount === 0) {
          cs.setDate(cs.getDate() - 1)
          // check yesterday
          const ysDs = toDateStr(cs)
          if ((dateCounts[ysDs] ?? 0) > 0) {
            csCount++
            cs.setDate(cs.getDate() - 1)
            continue
          }
        }
        break
      }
    }
    currentStreak = csCount

    return { weeks, monthPositions: monthPos, activeDays, longestStreak, currentStreak }
  }, [dateCounts])

  return (
    <FadeUp>
      <div className="space-y-3">
        <p className="text-label">Writing activity</p>

        <div className="overflow-x-auto pb-1">
          {/* fixed-width inner container */}
          <div style={{ minWidth: `${weeks.length * 12 + 32}px` }}>
            {/* Month labels row */}
            <div className="flex mb-1 pl-8">
              {weeks.map((_, colIdx) => {
                const mp = monthPositions.find((m) => m.col === colIdx)
                return (
                  <div key={colIdx} style={{ width: 12, flexShrink: 0 }}>
                    {mp && (
                      <span className="text-[8px] text-muted-foreground/50 whitespace-nowrap">
                        {mp.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Day-of-week labels + grid */}
            <div className="flex gap-0">
              {/* Day-of-week labels: Mon–Sun, show M on row 0, W on row 2, F on row 4 */}
              <div className="flex flex-col gap-[2px] mr-2">
                {DOW_LABELS.map((d, i) => (
                  <span
                    key={i}
                    className="text-[7px] text-muted-foreground/40 w-4 leading-none flex items-center justify-end"
                    style={{ height: 10 }}
                  >
                    {/* Show label for M (0), W (2), F (4) */}
                    {i === 0 || i === 2 || i === 4 ? d : ''}
                  </span>
                ))}
              </div>

              {/* Grid columns */}
              <div className="flex gap-[2px]">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[2px]">
                    {week.map((cell, dIdx) => {
                      if (!cell.inRange || !cell.date) {
                        return (
                          <div
                            key={dIdx}
                            style={{ width: 10, height: 10 }}
                            className="rounded-[2px] bg-transparent"
                          />
                        )
                      }
                      return (
                        <div
                          key={dIdx}
                          style={{ width: 10, height: 10 }}
                          className={`rounded-[2px] cursor-default transition-opacity hover:opacity-70 ${intensityClass(cell.count)}`}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setTooltip({ date: cell.date, count: cell.count, x: rect.left + rect.width / 2, y: rect.top })
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <p className="text-[10px] text-muted-foreground/60">
          {activeDays} {activeDays === 1 ? 'day' : 'days'} active
          {' · '}longest streak: {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
          {' · '}current streak: {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
        </p>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none bg-background border border-border rounded-lg px-2.5 py-1.5 text-[10px] shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y - 40, transform: 'translateX(-50%)' }}
          >
            <span className="text-foreground font-medium">
              {tooltip.count === 0
                ? 'No entries'
                : `${tooltip.count} ${tooltip.count === 1 ? 'entry' : 'entries'}`}
            </span>
            <span className="text-muted-foreground ml-1">
              {new Date(tooltip.date + 'T12:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        )}
      </div>
    </FadeUp>
  )
}
