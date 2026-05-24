'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from '@/components/ui/motion'

const NAV_ITEMS = [
  { href: '/app/dashboard', label: 'Home' },
  { href: '/app/interview', label: 'Capture' },
  { href: '/app/review', label: 'Review' },
  { href: '/app/lifemap', label: 'Life map' },
  { href: '/app/values', label: 'Values' },
  { href: '/app/settings', label: 'Settings' },
  { href: '/app/profile', label: 'Profile' },
]

interface Props {
  displayName: string
  children: React.ReactNode
}

export function NavClient({ displayName, children }: Props) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-3xl px-6 h-14 flex items-center justify-between gap-6">
        <Link href="/app/dashboard" className="text-sm font-medium tracking-[0.08em] text-foreground shrink-0">
          AEDRIN
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-xs transition-colors ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-4">
          <span className="hidden md:block text-xs text-muted-foreground truncate max-w-[120px]">{displayName}</span>
          {children}

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              {menuOpen
                ? <><line x1="2" y1="2" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="2" x2="2" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>
                : <><line x1="2" y1="5" x2="16" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden border-t border-border md:hidden"
          >
            <nav className="px-6 py-4 flex flex-col gap-4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-border text-xs text-muted-foreground">{displayName}</div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
