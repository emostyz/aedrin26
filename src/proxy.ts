import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64')
}

export async function proxy(request: NextRequest) {
  const nonce = generateNonce()

  // ── Forward nonce to Server Components ──────────────────────────────────────
  // layout.tsx reads x-nonce via headers() so it can emit <meta property="csp-nonce">
  // and Next.js propagates it to its own inline hydration scripts.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  let response = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must happen before any redirects or logic below
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isAppRoute = pathname.startsWith('/app') || pathname === '/dashboard'

  if (!user && isAppRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/app/dashboard', request.url))
  }

  // ── Content Security Policy ──────────────────────────────────────────────────
  // Nonce-based script-src prevents XSS escalation. Only Next.js-bundled scripts
  // (which carry the nonce) and nonce-tagged inlines can execute.
  // 'unsafe-inline' is intentionally absent from script-src.
  const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host

  // React dev mode uses eval() for source maps. Allow it locally only.
  const isDev = process.env.NODE_ENV === 'development'

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''}`,
    // Tailwind v4 and Framer Motion both require inline styles
    `style-src 'self' 'unsafe-inline'`,
    // Avatars and artifacts are served from Supabase Storage
    `img-src 'self' data: blob: https://${supabaseHost}`,
    // Next.js font optimization serves fonts from _next/static
    `font-src 'self' data:`,
    // Supabase REST + realtime WebSocket; Google for OAuth redirects
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://accounts.google.com`,
    `frame-src 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ')

  response.headers.set('Content-Security-Policy', csp)

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
