import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { MemoirChat } from '@/components/interview/memoir-chat'
import type { Domain } from '@/lib/supabase/types'

const DOMAINS: { domain: Domain; label: string; dot: string }[] = [
  { domain: 'childhood', label: 'Childhood', dot: 'bg-amber-400' },
  { domain: 'family',    label: 'Family',    dot: 'bg-rose-400'  },
  { domain: 'career',    label: 'Career',    dot: 'bg-blue-400'  },
  { domain: 'values',    label: 'Values',    dot: 'bg-emerald-400' },
  { domain: 'beliefs',   label: 'Beliefs',   dot: 'bg-violet-400' },
  { domain: 'lessons',   label: 'Lessons',   dot: 'bg-orange-400' },
  { domain: 'messages',  label: 'Messages',  dot: 'bg-teal-400'  },
]

const VALID_DOMAINS: Domain[] = DOMAINS.map((d) => d.domain)

interface Props {
  searchParams: Promise<{ domain?: string }>
}

export default async function MemoirChatPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const params = await searchParams
  const rawDomain = params.domain ?? 'childhood'
  const domain: Domain = VALID_DOMAINS.includes(rawDomain as Domain)
    ? (rawDomain as Domain)
    : 'childhood'

  const activeMeta = DOMAINS.find((d) => d.domain === domain)!

  return (
    <div className="space-y-8">
      <FadeUp className="space-y-2">
        <div className="flex items-center gap-2">
          <Link
            href="/app/interview"
            className="text-label hover:text-muted-foreground transition-colors"
          >
            Capture
          </Link>
          <span className="text-muted-foreground/40">›</span>
          <p className="text-label">AI Conversation</p>
        </div>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          Talk it out.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
          Sometimes it&apos;s easier to talk than to type. Answer the questions naturally — your words become journal entries when you save.
        </p>
      </FadeUp>

      {/* Domain pills */}
      <FadeUp delay={0.05}>
        <div className="flex flex-wrap gap-2">
          {DOMAINS.map(({ domain: d, label, dot }) => {
            const isActive = d === domain
            return (
              <Link
                key={d}
                href={`/app/interview/chat?domain=${d}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all border ${
                  isActive
                    ? 'border-foreground/20 bg-surface/60 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/15'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dot} ${isActive ? 'opacity-100' : 'opacity-40'}`} />
                {label}
              </Link>
            )
          })}
        </div>
      </FadeUp>

      {/* Chat */}
      <FadeUp delay={0.1}>
        <div className="border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border/40">
            <span className={`w-2 h-2 rounded-full ${activeMeta.dot}`} />
            <p className="text-sm font-medium text-foreground">{activeMeta.label}</p>
            <span className="text-muted-foreground/40 text-xs ml-auto">Save your responses when ready</span>
          </div>
          <MemoirChat domain={domain} />
        </div>
      </FadeUp>

      <FadeUp delay={0.15}>
        <p className="text-xs text-muted-foreground/50 text-center">
          Your responses are never stored until you tap &quot;Save to journal&quot;. The conversation itself isn&apos;t kept.
        </p>
      </FadeUp>
    </div>
  )
}
