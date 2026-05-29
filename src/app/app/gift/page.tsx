import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { GiftForm } from '@/components/gift/gift-form'
import { listMyGiftInvitations } from '@/app/actions/gift'

const STATUS_LABEL: Record<string, string> = {
  sent:     'Waiting',
  claimed:  'Active',
  declined: 'Declined',
  expired:  'Expired',
}

const STATUS_CLASS: Record<string, string> = {
  sent:     'text-muted-foreground',
  claimed:  'text-foreground',
  declined: 'text-muted-foreground',
  expired:  'text-muted-foreground/50',
}

export default async function GiftPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const invitations = await listMyGiftInvitations()

  return (
    <div className="space-y-12">
      {/* Header */}
      <FadeUp className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/app/dashboard" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <span className="text-foreground">Gift</span>
        </div>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          Set up AEDRIN for someone you love.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
          Invite a parent, grandparent, or anyone whose story matters to you. They&apos;ll
          receive a personal note from you and a way to begin — at their own pace, in their
          own words. You&apos;ll see what they share with you as it accumulates.
        </p>
      </FadeUp>

      {/* Send form */}
      <FadeUp delay={0.1}>
        <GiftForm />
      </FadeUp>

      {/* History */}
      {invitations.length > 0 && (
        <FadeUp delay={0.2} className="space-y-4 pt-8 border-t border-border">
          <p className="text-label">Invitations you&apos;ve sent</p>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-4 border border-border/40 rounded-lg px-4 py-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm text-foreground truncate">{inv.recipient_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {inv.recipient_email} · {inv.relationship}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs ${STATUS_CLASS[inv.status] ?? 'text-muted-foreground'}`}>
                    {STATUS_LABEL[inv.status] ?? inv.status}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50">
                    {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </FadeUp>
      )}
    </div>
  )
}
