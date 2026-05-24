'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
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
  const [heirs, setHeirs]         = useState<Heir[]>(initialHeirs)
  const [showForm, setShowForm]   = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, start]        = useTransition()

  function handleAdd(formData: FormData) {
    setFormError(null)
    start(async () => {
      const result = await addHeir(formData)
      if (result?.error) { setFormError(result.error); return }
      setHeirs((prev) => [...prev, {
        id: result.heirId!,
        name: formData.get('name') as string,
        relationship: formData.get('relationship') as string,
        email: formData.get('email') as string,
        permissions: Object.fromEntries(ALL_DOMAINS.map((d) => [d, false])) as Record<Domain, boolean>,
      }])
      setShowForm(false)
    })
  }

  function handleRemove(id: string) {
    start(async () => {
      const result = await removeHeir(id)
      if (!result?.error) setHeirs((prev) => prev.filter((h) => h.id !== id))
    })
  }

  function handleToggle(heirId: string, domain: Domain, current: boolean) {
    start(async () => {
      const result = await updateHeirPermissions(heirId, domain, !current)
      if (!result?.error) {
        setHeirs((prev) => prev.map((h) =>
          h.id === heirId ? { ...h, permissions: { ...h.permissions, [domain]: !current } } : h
        ))
      }
    })
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-label">Heirs</p>
          <p className="text-xs text-muted-foreground">
            People who receive access to your story after your death is verified.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {showForm ? 'Cancel' : '+ Add heir'}
        </button>
      </div>

      {/* How it works */}
      <div className="rounded-lg border border-border/60 bg-surface/40 px-5 py-4 space-y-3">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">How it works</p>
        <ol className="space-y-2.5">
          {[
            { step: '1', text: 'Mark entries "For heirs" in the Review tab — only those entries will ever be visible to anyone you designate.' },
            { step: '2', text: 'Add heirs here and choose which topics (domains) each person may see. For example, your daughter might see Family and Messages but not Career.' },
            { step: '3', text: 'Appoint an executor below — someone trusted to verify your death and unlock access for your heirs.' },
            { step: '4', text: 'Until that verification happens, nothing is shared. Your story stays completely private.' },
          ].map(({ step, text }) => (
            <li key={step} className="flex gap-3 text-xs text-muted-foreground leading-relaxed">
              <span className="shrink-0 w-4 h-4 rounded-full border border-border/60 flex items-center justify-center text-[9px] text-muted-foreground/60 font-medium mt-px">
                {step}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <form action={handleAdd} className="border border-border rounded-lg px-5 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="heir-name" className="text-label">Name</label>
                  <input id="heir-name" name="name" required placeholder="Full name"
                    className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="heir-rel" className="text-label">Relationship</label>
                  <input id="heir-rel" name="relationship" placeholder="e.g. Daughter" required
                    className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="heir-email" className="text-label">Email</label>
                  <input id="heir-email" name="email" type="email" required
                    className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>
              {formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}
              <button type="submit" disabled={isPending}
                className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
                {isPending ? 'Adding…' : 'Add heir'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {heirs.length === 0 ? (
        <div className="border border-border rounded-lg px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">No heirs designated yet.</p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          <div className="space-y-3">
            {heirs.map((heir) => (
              <motion.div
                key={heir.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                className="border border-border rounded-lg px-5 py-4 space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-sm text-foreground">{heir.name}</p>
                    <p className="text-xs text-muted-foreground">{heir.relationship} · {heir.email}</p>
                  </div>
                  <button onClick={() => handleRemove(heir.id)} disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40">
                    Remove
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    Topics they can see
                  </p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Only entries marked &quot;For heirs&quot; in the selected topics will be visible.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_DOMAINS.map((domain) => {
                      const allowed = heir.permissions[domain]
                      return (
                        <button
                          key={domain}
                          onClick={() => handleToggle(heir.id, domain, allowed)}
                          disabled={isPending}
                          aria-pressed={allowed}
                          className={[
                            'rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 disabled:opacity-50',
                            allowed
                              ? 'bg-primary text-primary-foreground'
                              : 'border border-border text-muted-foreground hover:border-foreground/20',
                          ].join(' ')}
                        >
                          {DOMAIN_LABELS[domain]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </section>
  )
}
