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

  const [{ data: rawHeirs }, { data: perms }, { data: rawExecutors }, { data: prefRow }] = await Promise.all([
    supabase.from('heirs').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('heir_permissions').select('*'),
    supabase.from('executors').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('users').select('reminders_enabled').eq('id', user.id).single(),
  ])

  const remindersEnabled = (prefRow as { reminders_enabled: boolean } | null)?.reminders_enabled ?? true

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

      <FadeUp delay={0.1}>
        <HeirManager initialHeirs={heirs} />
      </FadeUp>

      <div className="border-t border-border" />

      <FadeUp delay={0.15}>
        <ExecutorManager initialExecutors={executors} />
      </FadeUp>

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
