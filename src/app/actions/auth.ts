'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type AuthState = { error: string } | undefined

export async function signup(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const legalName = formData.get('legal_name') as string
  // Optional gift-invitation token threaded through from /gift/[token] —
  // see src/app/gift/[token]/page.tsx. When present, we route the user
  // back through the claim page after auth instead of straight to onboarding,
  // so the invitation gets claimed before the new user starts.
  const giftToken = (formData.get('gift_token') as string | null)?.trim() || null

  if (!email || !password || !legalName) {
    return { error: 'All fields are required.' }
  }

  const supabase = await createClient()

  // Where the magic-link email should land. If a gift token was supplied,
  // route the email-confirm callback through the claim page so the gift
  // attaches before onboarding starts.
  const base = process.env.BASE_URL || 'https://www.aedrin.com'
  const postAuthPath = giftToken ? `/gift/${encodeURIComponent(giftToken)}` : '/onboarding'
  const emailRedirectTo = `${base}/auth/callback?next=${encodeURIComponent(postAuthPath)}`

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { legal_name: legalName },
      emailRedirectTo,
    },
  })

  if (error) {
    return { error: error.message }
  }

  // If email confirmation is required, session is null — send them to the
  // "check your inbox" page. If confirmation is disabled in Supabase (common
  // in dev), session is already populated and we can proceed to onboarding —
  // or, if there's a gift, to the claim page first.
  if (!data.session) {
    const confirmParams = new URLSearchParams({ email })
    if (giftToken) confirmParams.set('gift', giftToken)
    redirect(`/auth/confirm?${confirmParams.toString()}`)
  }

  redirect(postAuthPath)
}

export async function login(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  redirect('/app/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function requestPasswordReset(
  _prevState: { error?: string; sent?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; sent?: boolean }> {
  const email = (formData.get('email') as string | null)?.trim()
  if (!email) return { error: 'Email is required.' }

  const supabase = await createClient()
  const base = process.env.BASE_URL || 'https://www.aedrin.com'
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/callback?next=/auth/reset`,
  })
  // Always report success — never reveal whether an email is registered.
  if (error) console.error('[auth] resetPasswordForEmail:', error.message)
  return { sent: true }
}

export async function resendConfirmation(
  _prevState: { error?: string; sent?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; sent?: boolean }> {
  const email = (formData.get('email') as string | null)?.trim()
  if (!email) return { error: 'Email is required.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({ type: 'signup', email })
  if (error) return { error: error.message }
  return { sent: true }
}

export async function updatePassword(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string
  if (!password || password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== confirm) return { error: 'Passwords do not match.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Your reset link has expired or is invalid. Please request a new one.' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  redirect('/app/dashboard')
}
