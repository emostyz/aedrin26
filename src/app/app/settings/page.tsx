import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FadeUp, Stagger, StaggerItem } from '@/components/ui/motion'
import { HeirManager } from '@/components/settings/heir-manager'
import { ExecutorManager } from '@/components/settings/executor-manager'
import { ReminderToggle } from '@/components/settings/reminder-toggle'
import type { Domain } from '@/lib/supabase/types'

const ALL_DOMAINS: Domain[] = ['childhood','family','career','values','beliefs','lessons','messages','other']

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [
    { data: rawHeirs },
    { data: perms },
    { data: rawExecutors },
    { data: prefRow },
    { data: allEntries },
    { data: letterEntries },
    { count: lifeEventCount },
  ] = await Promise.all([
    supabase.from('heirs').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('heir_permissions').select('*'),
    supabase.from('executors').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('users').select('reminders_enabled, created_at').eq('id', user.id).single(),
    supabase.from('soul_entries').select('domain, content, sharing_status, bound_recipient_id').eq('user_id', user.id),
    supabase.from('soul_entries').select('id').eq('user_id', user.id).not('bound_recipient_id', 'is', null),
    supabase.from('life_events').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const prefData = prefRow as { reminders_enabled: boolean; created_at: string } | null
  const remindersEnabled = prefData?.reminders_enabled ?? true

  // ── Data stats ───────────────────────────────────────────────────────────────
  const entries = (allEntries ?? []) as {
    domain: Domain
    content: string
    sharing_status: string
    bound_recipient_id: string | null
  }[]
  const totalEntries     = entries.length
  const totalWords       = entries.reduce((sum, e) => sum + e.content.trim().split(/\s+/).filter(Boolean).length, 0)
  const domainsExplored  = new Set(entries.map((e) => e.domain)).size
  const forHeirs         = entries.filter((e) => e.sharing_status === 'shareable' && e.bound_recipient_id === null).length
  const onlyForYou       = entries.filter((e) => e.sharing_status === 'private').length
  const finalLetters     = (letterEntries ?? []).length
  const lifeEvents       = lifeEventCount ?? 0
  const memberSince      = prefData?.created_at
    ? new Date(prefData.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  const heirs = (rawHeirs ?? []).map((h: Record<string, unknown>) => {
    const heirPerms = (perms ?? []).filter((p: Record<string, unknown>) => p.heir_id === h.id)
    const permMap = Object.fromEntries(
      ALL_DOMAINS.map((d) => [d, heirPerms.find((p: Record<string, unknown>) => p.domain === d)?.allowed ?? false])
    ) as Record<Domain, boolean>
    return {
      id: h.id as string,
      name: h.name as string,
      relationship: h.relationship as string,
      email: h.email as string,
      permissions: permMap,
    }
  })

  const executors = (rawExecutors ?? []).map((e: Record<string, unknown>) => ({
    id: e.id as string,
    name: e.name as string,
    email: e.email as string,
  }))

  return (
    <div className="space-y-16">
      <FadeUp className="space-y-2">
        <p className="text-label">Settings</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          Who holds the keys.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
          Choose who receives your story after you pass — and exactly what they can read. Nothing is shared while you&apos;re alive.
        </p>
      </FadeUp>

      {/* Quick navigation to pages removed from the top nav */}
      <FadeUp delay={0.04}>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {[
            { href: '/app/today',    label: "Today's journal →" },
            { href: '/app/archive',  label: 'Archive →' },
            { href: '/app/letters',  label: 'Letters →' },
            { href: '/app/represent', label: 'Represent →' },
            { href: '/app/lifemap',  label: 'Life map →' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
              {label}
            </Link>
          ))}
        </div>
      </FadeUp>

      <div className="border-t border-border" />

      {/* Your data stats */}
      <FadeUp delay={0.05}>
        <div className="space-y-4">
          <div className="space-y-0.5">
            <p className="text-label">Your data</p>
            <p className="text-xs text-muted-foreground">A snapshot of everything you&apos;ve captured so far.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { value: totalEntries.toLocaleString(), label: `entr${totalEntries === 1 ? 'y' : 'ies'}` },
              { value: totalWords.toLocaleString(), label: 'words written' },
              { value: `${domainsExplored} of ${ALL_DOMAINS.length}`, label: 'domains explored' },
              { value: forHeirs.toLocaleString(), label: 'marked for heirs' },
              { value: onlyForYou.toLocaleString(), label: 'only for you' },
              { value: finalLetters.toLocaleString(), label: `final letter${finalLetters === 1 ? '' : 's'}` },
              { value: lifeEvents.toLocaleString(), label: `life map event${lifeEvents === 1 ? '' : 's'}` },
              ...(memberSince ? [{ value: memberSince, label: 'member since' }] : []),
            ].map(({ value, label }) => (
              <div key={label} className="border border-border/60 rounded-xl px-4 py-4 text-center space-y-1">
                <p className="text-xl font-light tracking-[-0.02em] text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeUp>

      <div className="border-t border-border" />

      <FadeUp delay={0.1}>
        <HeirManager initialHeirs={heirs} />
      </FadeUp>

      <div className="border-t border-border" />

      <FadeUp delay={0.12}>
        <Stagger className="space-y-3">
          <StaggerItem>
            <div className="space-y-0.5">
              <p className="text-label">Gift AEDRIN to someone you love</p>
              <p className="text-xs text-muted-foreground">
                Invite a parent, grandparent, or anyone whose story matters to you. They&apos;ll receive
                a personal note from you with a way to begin — at their own pace.
              </p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <Link href="/app/gift" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Send an invitation →
            </Link>
          </StaggerItem>
        </Stagger>
      </FadeUp>

      <div className="border-t border-border" />

      <FadeUp delay={0.15}>
        <ExecutorManager initialExecutors={executors} />
      </FadeUp>

      <div className="border-t border-border" />

      <Stagger className="space-y-3">
        <StaggerItem>
          <div className="space-y-0.5">
            <p className="text-label">Final letters</p>
            <p className="text-xs text-muted-foreground">
              Write private letters to specific heirs, delivered by email when your account is memorialized.
            </p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <Link href="/app/letters" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Write letters →
          </Link>
        </StaggerItem>
      </Stagger>

      <div className="border-t border-border" />

      <Stagger className="space-y-3">
        <StaggerItem>
          <div className="space-y-0.5">
            <p className="text-label">Memorialization</p>
            <p className="text-xs text-muted-foreground">
              View or cancel an active memorialization request during the grace period.
            </p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <Link
            href="/app/settings/memorialization"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View memorialization status →
          </Link>
        </StaggerItem>
      </Stagger>

      <div className="border-t border-border" />

      <Stagger className="space-y-3">
        <StaggerItem>
          <div className="space-y-0.5">
            <p className="text-label">Notifications</p>
            <p className="text-xs text-muted-foreground">
              A gentle daily nudge to reflect, sent to your email.
            </p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <ReminderToggle initialEnabled={remindersEnabled} />
        </StaggerItem>
      </Stagger>

      <div className="border-t border-border" />

      <Stagger className="space-y-3">
        <StaggerItem>
          <div className="space-y-0.5">
            <p className="text-label">Account</p>
            <p className="text-xs text-muted-foreground">
              Export your data or permanently delete your account.
            </p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <Link href="/app/export" className="hover:text-foreground transition-colors">
              Export data →
            </Link>
            <Link href="/app/settings/delete" className="hover:text-destructive transition-colors">
              Delete account →
            </Link>
          </div>
        </StaggerItem>
      </Stagger>
    </div>
  )
}
