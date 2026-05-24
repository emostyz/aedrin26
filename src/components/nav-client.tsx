'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from '@/components/ui/motion'

const DESKTOP_NAV_ITEMS = [
  { href: '/app/dashboard', label: 'Home' },
  { href: '/app/interview', label: 'Capture' },
  { href: '/app/review', label: 'Review' },
  { href: '/app/lifemap', label: 'Life map' },
  { href: '/app/values', label: 'Values' },
  { href: '/app/settings', label: 'Settings' },
  { href: '/app/profile', label: 'Profile' },
]

const BOTTOM_NAV_ITEMS = [
  {
    href: '/app/dashboard',
    label: 'Home',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/app/interview',
    label: 'Capture',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    href: '/app/review',
    label: 'Review',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    href: '/app/lifemap',
    label: 'Life map',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: '/app/settings',
    label: 'Settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
]

interface Props {
  displayName: string
  children: React.ReactNode
}

export function NavClient({ displayName, children }: Props) {
  const pathname = usePathname()

  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 h-14 flex items-center justify-between gap-6">
          <Link href="/app/dashboard" className="text-sm font-medium tracking-[0.08em] text-foreground shrink-0">
            AEDRIN
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {DESKTOP_NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative text-xs pb-1 transition-colors ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {item.label}
                  {active && (
                    <motion.div
                      layoutId="nav-underline"
                      className="absolute bottom-0 left-0 right-0 h-px bg-foreground"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/app/profile" className="hidden md:block text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px]">
              {displayName}
            </Link>
            {children}
          </div>
        </div>
      </header>

      {/* Mobile bottom nav bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-sm border-t border-border flex items-center justify-around px-2">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full px-1 transition-colors ${active ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              <span className={`flex items-center justify-center rounded-xl p-1.5 transition-colors ${active ? 'bg-foreground/5' : ''}`}>
                {item.icon}
              </span>
              <span className="text-[9px] uppercase tracking-wider leading-none">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
