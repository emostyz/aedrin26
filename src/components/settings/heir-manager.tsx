'use client'

import { useState, useTransition } from 'react'
import { addHeir, removeHeir, updateHeirPermissions } from '@/app/actions/settings'
import type { Domain } from '@/lib/supabase/types'

const ALL_DOMAINS: Domain[] = ['childhood','family','career','values','beliefs','lessons','messages','other']
const DOMAIN_LABELS: Record<Domain, string> = {
  childhood:'Childhood', family:'Family', career:'Career', values:'Values',
  beliefs:'Beliefs', lessons:'Lessons', messages:'Messages', other:'Other',
}

type Heir = {
  id: string
  name: string
  relationship: string
  email: string
  permissions: Record<Domain, boolean>
}

interface Props {
  initialHeirs: Heir[]
}

export function HeirManager({ initialHeirs }: Props) {
  const [heirs, setHeirs] = useState<Heir[]>(initialHeirs)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd(formData: FormData) {
    setFormError(null)
    startTransition(async () => {
      const result = await addHeir(formData)
      if (result?.error) { setFormError(result.error); return }
      setHeirs((prev) => [
        ...prev,
        {
          id: result.heirId!,
          name: formData.get('name') as string,
          relationship: formData.get('relationship') as string,
          email: formData.get('email') as string,
          permissions: Object.fromEntries(ALL_DOMAINS.map((d) => [d, false])) as Record<Domain, boolean>,
        },
      ])
      setShowForm(false)
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await removeHeir(id)
      if (!result?.error) setHeirs((prev) => prev.filter((h) => h.id !== id))
    })
  }

  function handleTogglePermission(heirId: string, domain: Domain, current: boolean) {
    startTransition(async () => {
      const result = await updateHeirPermissions(heirId, domain, !current)
      if (!result?.error) {
        setHeirs((prev) => prev.map((h) =>
          h.id === heirId
            ? { ...h, permissions: { ...h.permissions, [domain]: !current } }
            : h
        ))
      }
    })
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Heirs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Designate who may access your Soul Profile after death, and which domains they may see.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
        >
          {showForm ? 'Cancel' : '+ Add heir'}
        </button>
      </div>

      {showForm && (
        <form action={handleAdd} className="rounded-lg border border-border px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="heir-name" className="text-xs font-medium text-foreground">Name</label>
              <input id="heir-name" name="name" required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label htmlFor="heir-rel" className="text-xs font-medium text-foreground">Relationship</label>
              <input id="heir-rel" name="relationship" placeholder="e.g. Daughter" required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label htmlFor="heir-email" className="text-xs font-medium text-foreground">Email</label>
              <input id="heir-email" name="email" type="email" required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          {formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}
          <button type="submit" disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {isPending ? 'Adding…' : 'Add heir'}
          </button>
        </form>
      )}

      {heirs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No heirs designated yet.</p>
      ) : (
        <ul className="space-y-4">
          {heirs.map((heir) => (
            <li key={heir.id} className="rounded-lg border border-border px-5 py-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{heir.name}</p>
                  <p className="text-xs text-muted-foreground">{heir.relationship} · {heir.email}</p>
                </div>
                <button onClick={() => handleRemove(heir.id)} disabled={isPending}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40">
                  Remove
                </button>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Domains this heir may access:</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_DOMAINS.map((domain) => {
                    const allowed = heir.permissions[domain]
                    return (
                      <button
                        key={domain}
                        onClick={() => handleTogglePermission(heir.id, domain, allowed)}
                        disabled={isPending}
                        aria-pressed={allowed}
                        className={[
                          'rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                          allowed
                            ? 'bg-foreground text-background'
                            : 'border border-border text-muted-foreground hover:border-foreground/30',
                        ].join(' ')}
                      >
                        {DOMAIN_LABELS[domain]}
                      </button>
                    )
                  })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
