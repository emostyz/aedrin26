import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveLegacyAccess } from '@/lib/legacy-access'
import { FadeUp } from '@/components/ui/motion'
import { StartNegotiation } from '@/components/negotiation/start-negotiation'

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  resolved: 'Resolved',
  closed: 'Closed',
  archived: 'Archived',
}

export default async function NegotiationsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const access = await resolveLegacyAccess(userId, user)
  if (!access || !access.canNegotiate) notFound()

  const service = createServiceClient()
  const { data: negs } = await service
    .from('negotiations')
    .select('id, title, status, created_at')
    .eq('deceased_user_id', userId)
    .order('created_at', { ascending: false })

  const negotiations = (negs ?? []) as Array<{ id: string; title: string; status: string; created_at: string }>

  return (
    <div className="space-y-8 max-w-xl mx-auto w-full px-6 py-10">
      <FadeUp className="space-y-2">
        <Link href={`/app/legacy/${userId}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Back to {access.deceasedName}
        </Link>
        <p className="text-label">Negotiations</p>
        <p className="text-[1.5rem] font-light tracking-[-0.02em] text-foreground leading-snug">
          Decide together, grounded in {access.deceasedName.split(' ')[0]}&rsquo;s values
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A neutral, AI-assisted space for the people {access.deceasedName.split(' ')[0]} left behind to
          work through a shared decision. The mediator draws only on what they recorded and respects
          each person&rsquo;s non-negotiables. Nothing here is legally binding.
        </p>
      </FadeUp>

      <FadeUp delay={0.05}>
        <StartNegotiation deceasedUserId={userId} />
      </FadeUp>

      {negotiations.length > 0 && (
        <FadeUp delay={0.1} className="space-y-2">
          {negotiations.map((n) => (
            <Link
              key={n.id}
              href={`/app/legacy/${userId}/negotiations/${n.id}`}
              className="block border border-border rounded-lg px-4 py-3 hover:border-foreground/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-foreground truncate">{n.title}</p>
                <span className="text-[11px] text-muted-foreground shrink-0">{STATUS_LABEL[n.status] ?? n.status}</span>
              </div>
            </Link>
          ))}
        </FadeUp>
      )}
    </div>
  )
}
