import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGiftInvitationByToken, claimGiftInvitation } from '@/app/actions/gift'

interface Props {
  params: Promise<{ token: string }>
}

/**
 * Public recipient claim page.
 *
 * Three states it has to handle:
 *  1. The recipient is NOT signed in → show the personal page and a CTA that
 *     sends them to sign-up with their email pre-filled.
 *  2. The recipient IS signed in (just finished signing up) → call the claim
 *     action and forward them to onboarding.
 *  3. The invitation is expired / already claimed / not found → graceful
 *     "this isn't usable" message.
 */
export default async function GiftClaimPage({ params }: Props) {
  const { token } = await params

  const invitation = await getGiftInvitationByToken(token)
  if (!invitation) {
    return (
      <ExpiredOrUnknown
        title="This invitation isn't recognized."
        body="The link may be incorrect or the invitation may have been deleted."
      />
    )
  }

  if (invitation.expired) {
    return (
      <ExpiredOrUnknown
        title="This invitation has expired."
        body={`Invitations stay open for 90 days. Ask ${invitation.senderName} to send a fresh one if you'd still like to begin.`}
      />
    )
  }

  // ── If the recipient is signed in, try to claim immediately ─────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const result = await claimGiftInvitation(token)
    if (result.claimed) {
      // Successful claim — send them to onboarding (or dashboard if they're
      // already past it) so the next page knows they have an account.
      const { data: profile } = await supabase
        .from('users')
        .select('onboarding_complete')
        .eq('id', user.id)
        .maybeSingle<{ onboarding_complete: boolean }>()
      redirect(profile?.onboarding_complete ? '/app/dashboard' : '/onboarding')
    }
    // Email mismatch / already claimed by someone else / expired in flight
    return (
      <ExpiredOrUnknown
        title="We couldn't activate this invitation."
        body={result.error ?? 'Try signing in with the email address this was sent to.'}
      />
    )
  }

  // ── Not signed in — show the personal page ──────────────────────────────
  // The sign-up CTA redirects to /signup with this token in the URL so that
  // after sign-up the user can be returned here to claim.
  const signUpUrl = `/signup?gift=${encodeURIComponent(token)}`

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-background">
      <div className="max-w-md w-full space-y-10">
        {/* Subtle brand mark — not loud */}
        <p className="text-[10px] tracking-[0.22em] text-muted-foreground/60 uppercase text-center">
          AEDRIN
        </p>

        <div className="space-y-6 text-center">
          <p className="text-[1.6rem] font-light tracking-[-0.03em] text-foreground leading-tight">
            {invitation.senderName} has something to ask you, {invitation.recipientFirstName}.
          </p>
        </div>

        {invitation.senderNote && (
          <blockquote className="border-l border-foreground/40 pl-5 italic text-foreground/85 text-[15px] leading-relaxed font-light">
            “{invitation.senderNote}”
            <footer className="not-italic text-xs text-muted-foreground mt-3">
              — {invitation.senderFirstName}
            </footer>
          </blockquote>
        )}

        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed font-light">
          <p>
            AEDRIN is a quiet place to share the moments and lessons of your life — one
            question at a time. {invitation.senderFirstName} set it up for you because they
            want to remember your story in your own words.
          </p>
          <p>
            There&apos;s no pressure, no schedule. You answer when you feel like answering.
            Even one sentence is enough. What you write is preserved beautifully, for the
            people you love. You decide who sees it and when.
          </p>
        </div>

        <div className="space-y-3 pt-4">
          <Link
            href={signUpUrl}
            className="block w-full text-center bg-foreground text-background rounded-md px-5 py-3.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Begin
          </Link>
          <p className="text-[11px] text-center text-muted-foreground/60">
            Free. No credit card. Takes a minute.
          </p>
        </div>

        <p className="text-[11px] text-center text-muted-foreground/40 pt-4">
          If you&apos;d rather not, you can simply close this — {invitation.senderFirstName} won&apos;t be notified.
        </p>
      </div>
    </main>
  )
}

function ExpiredOrUnknown({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-background">
      <div className="max-w-md w-full space-y-6 text-center">
        <p className="text-[10px] tracking-[0.22em] text-muted-foreground/60 uppercase">AEDRIN</p>
        <p className="text-xl font-light tracking-[-0.02em] text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        <Link
          href="/"
          className="inline-block text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Go to aedrin.com →
        </Link>
      </div>
    </main>
  )
}
