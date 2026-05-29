'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface AdminCtx {
  secret: string
  setSecret: (s: string) => void
  authed: boolean
}

export const AdminContext = createContext<AdminCtx>({ secret: '', setSecret: () => {}, authed: false })
export function useAdmin() { return useContext(AdminContext) }

const NAV = [
  { href: '/app/admin',                label: 'Overview'         },
  { href: '/app/admin/memorialization', label: 'Memorialization'  },
  { href: '/app/admin/access-requests', label: 'Access requests'  },
  { href: '/app/admin/users',           label: 'Users'            },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [secret, setSecretState] = useState('')
  const [inputVal, setInputVal] = useState('')
  const pathname = usePathname()

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_secret') ?? ''
    setSecretState(stored)
    setInputVal(stored)
  }, [])

  function applySecret() {
    sessionStorage.setItem('admin_secret', inputVal)
    setSecretState(inputVal)
  }

  const authed = !!secret

  return (
    <AdminContext.Provider value={{ secret, setSecret: setSecretState, authed }}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-0.5">
            <p className="text-label">Admin</p>
            <p className="text-[1.4rem] font-light tracking-[-0.02em] text-foreground">AEDRIN Operations</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySecret()}
              placeholder="Admin secret"
              className="w-52 bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={applySecret}
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Unlock
            </button>
            {authed && (
              <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">
                authenticated
              </span>
            )}
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="flex gap-1 border-b border-border pb-0 -mb-4">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || (href !== '/app/admin' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2.5 text-xs font-medium rounded-t-md border-b-2 transition-colors ${
                  active
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="pt-2">{children}</div>
      </div>
    </AdminContext.Provider>
  )
}
