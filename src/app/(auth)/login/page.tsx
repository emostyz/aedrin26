'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { FadeUp, Stagger, StaggerItem } from '@/components/ui/motion'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6">
      <FadeUp className="w-full max-w-[360px] space-y-10">
        <div className="space-y-1">
          <p className="text-label">AEDRIN</p>
          <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
            Welcome back.
          </p>
        </div>

        <Stagger className="space-y-5">
          <form action={action} className="space-y-4">
            <StaggerItem className="space-y-1.5">
              <label htmlFor="email" className="text-label">Email</label>
              <input
                id="email" name="email" type="email" autoComplete="email" required
                className="w-full bg-input border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
              />
            </StaggerItem>

            <StaggerItem className="space-y-1.5">
              <label htmlFor="password" className="text-label">Password</label>
              <input
                id="password" name="password" type="password" autoComplete="current-password" required
                className="w-full bg-input border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
              />
            </StaggerItem>

            {state?.error && (
              <StaggerItem>
                <p role="alert" className="text-xs text-destructive">{state.error}</p>
              </StaggerItem>
            )}

            <StaggerItem>
              <button
                type="submit" disabled={pending}
                className="w-full bg-primary text-primary-foreground rounded-md px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {pending ? 'Signing in…' : 'Sign in'}
              </button>
            </StaggerItem>
          </form>

          <StaggerItem>
            <p className="text-center text-xs text-muted-foreground">
              No account?{' '}
              <Link href="/signup" className="text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity">
                Create one
              </Link>
            </p>
          </StaggerItem>
        </Stagger>
      </FadeUp>
    </div>
  )
}
