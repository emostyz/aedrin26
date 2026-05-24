import { createClient } from '@/lib/supabase/server'
import { HeirManager } from '@/components/settings/heir-manager'
import { ExecutorManager } from '@/components/settings/executor-manager'
import type { Domain } from '@/lib/supabase/types'

const ALL_DOMAINS: Domain[] = ['childhood','family','career','values','beliefs','lessons','messages','other']

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: rawHeirs }, { data: perms }, { data: rawExecutors }] = await Promise.all([
    supabase.from('heirs').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('heir_permissions').select('*'),
    supabase.from('executors').select('*').eq('user_id', user.id).order('created_at'),
  ])

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
    <div className="space-y-12">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage who may access your Soul Profile and who may initiate the verification process.
        </p>
      </div>

      <HeirManager initialHeirs={heirs} />

      <div className="border-t border-border" />

      <ExecutorManager initialExecutors={executors} />

      <div className="border-t border-border" />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Memorialization</h3>
        <p className="text-xs text-muted-foreground">
          If a memorialization request has been initiated by one of your executors, you can view its
          status and cancel it here during the grace period.
        </p>
        <a href="/app/settings/memorialization"
          className="inline-block text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground">
          View memorialization status →
        </a>
      </section>
    </div>
  )
}
