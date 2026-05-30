'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from '@/components/ui/motion'

// Six focused items — keeps the header from ever overflowing.
// Archive, Letters, and Represent are all reachable from Settings + their parent sections.
const DESKTOP_NAV_ITEMS = [
  { href: '/app/dashboard', label: 'Home' },
  { href: '/app/interview', label: 'Capture' },
  { href: '/app/review',    label: 'Review' },
  { href: '/app/memoir',    label: 'Memoir' },
  { href: '/app/lifemap',   label: 'Life map' },
  { href: '/app/settings',  label: 'Settings' },
]

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

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
    href: '/app/memoir',
    label: 'Memoir',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
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
        {/* max-w-6xl gives the header room to breathe without constraining page content */}
        <div className="mx-auto max-w-6xl px-6 h-14 md:h-16 flex items-center justify-between gap-4">
          <Link href="/app/dashboard" className="text-sm font-medium tracking-[0.08em] text-foreground shrink-0">
            AEDRIN
          </Link>

          {/* Desktop nav — whitespace-nowrap prevents any item from ever wrapping */}
          <nav className="hidden md:flex items-center gap-5">
            {DESKTOP_NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative text-xs whitespace-nowrap transition-colors ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {item.label}
                  {active && (
                    <motion.div
                      layoutId="nav-underline"
                      className="absolute bottom-[-4px] left-0 right-0 h-px bg-foreground"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {/* Search icon only — ⌘K shortcut is wired globally */}
            <Link
              href="/app/search"
              className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
              title="Search (⌘K)"
              aria-label="Search"
            >
              <SearchIcon />
            </Link>

            <Link href="/app/profile" className="hidden md:block text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap max-w-[140px] overflow-hidden text-ellipsis">
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
              <span className="text-[9px] uppercase tracking-wider leading-none whitespace-nowrap">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
