import { FadeUp } from '@/components/ui/motion'

interface Props {
  totalEntries: number
  totalWords: number
  domainsExplored: number   // 0-7
  heirCount: number
  streakDays: number
}

interface Milestone {
  id: string
  label: string
  check: (p: Props) => boolean
}

const MILESTONES: Milestone[] = [
  { id: 'first_entry',   label: 'First memory',        check: (p) => p.totalEntries >= 1 },
  { id: 'ten_entries',   label: '10 memories',         check: (p) => p.totalEntries >= 10 },
  { id: 'fifty_entries', label: '50 memories',         check: (p) => p.totalEntries >= 50 },
  { id: 'words_1k',      label: '1,000 words written', check: (p) => p.totalWords >= 1000 },
  { id: 'words_10k',     label: '10,000 words',        check: (p) => p.totalWords >= 10000 },
  { id: 'domains_all',   label: 'All 7 domains',       check: (p) => p.domainsExplored >= 7 },
  { id: 'first_heir',    label: 'First heir',          check: (p) => p.heirCount >= 1 },
  { id: 'streak_week',   label: '7-day streak',        check: (p) => p.streakDays >= 7 },
  { id: 'streak_month',  label: '30-day streak',       check: (p) => p.streakDays >= 30 },
]

export function Milestones(props: Props) {
  if (props.totalEntries === 0) return null

  const achieved = MILESTONES.filter((m) => m.check(props))
  if (achieved.length === 0) return null

  return (
    <FadeUp>
      <div className="space-y-2.5">
        <p className="text-label">Milestones</p>
        <div className="flex flex-wrap gap-2">
          {achieved.map((m) => (
            <span
              key={m.id}
              className="rounded-full border border-border/60 px-2.5 py-1 text-[10px] text-muted-foreground bg-surface/30"
            >
              &#10003; {m.label}
            </span>
          ))}
        </div>
      </div>
    </FadeUp>
  )
}
