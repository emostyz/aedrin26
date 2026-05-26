'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type AuthState = { error: string } | undefined

export async function signup(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const legalName = formData.get('legal_name') as string

  if (!email || !password || !legalName) {
    return { error: 'All fields are required.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { legal_name: legalName },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // New users start with onboarding; the onboarding flow redirects to /app/dashboard on completion.
  redirect('/onboarding')
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
