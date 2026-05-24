import type { NextConfig } from 'next'

// HTTP security headers applied to every response.
// CSP is intentionally omitted here — Supabase realtime, OpenAI CDN, and
// Framer Motion all need dynamic scripts/connects; a proper CSP requires a
// nonce-based setup (Next.js middleware) and is a follow-up hardening task.
const securityHeaders = [
  // Prevent browsers from sniffing the content type
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  // Block clickjacking — the app should never be framed
  { key: 'X-Frame-Options',          value: 'DENY' },
  // Minimal referrer info to external sites
  { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
  // Legacy XSS filter for older browsers
  { key: 'X-XSS-Protection',         value: '1; mode=block' },
  // Enforce HTTPS for 2 years (active once behind TLS / Vercel)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Permissions policy: allow microphone (voice recording), block everything else
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'geolocation=()',
      'interest-cohort=()',
      'microphone=(self)',   // required for SoundwaveRecorder voice input
      'payment=()',
      'usb=()',
    ].join(', '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source:  '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
