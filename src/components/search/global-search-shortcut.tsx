'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Listens globally for ⌘K (Mac) or Ctrl+K (Windows/Linux).
 * Navigates to /app/search and lets the autofocus there handle the rest.
 * Mount this once inside the app layout.
 */
export function GlobalSearchShortcut() {
  const router = useRouter()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isK = e.key === 'k' || e.key === 'K'
      if (isK && (e.metaKey || e.ctrlKey)) {
        // Don't hijack browser shortcuts when already on the search page
        if (window.location.pathname === '/app/search') return
        e.preventDefault()
        router.push('/app/search')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  return null
}
