'use client'

import { useState, useTransition } from 'react'
import { updateReminderPreference } from '@/app/actions/settings'

export function ReminderToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = !enabled
    setEnabled(next)
    startTransition(async () => {
      const res = await updateReminderPreference(next)
      if (res.error) setEnabled(!next) // revert on failure
    })
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={toggle}
      disabled={pending}
      className="inline-flex items-center gap-3 disabled:opacity-50"
    >
      <span
        className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-foreground' : 'bg-border'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </span>
      <span className="text-xs text-muted-foreground">
        {enabled ? 'Daily reminders on' : 'Daily reminders off'}
      </span>
    </button>
  )
}
