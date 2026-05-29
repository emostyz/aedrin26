'use client'

import { useActionState, useState } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { updateProfileContext } from '@/app/actions/profile'

interface Props {
  initialData: {
    relationship_status: string | null
    location: string | null
    company: string | null
    job_title: string | null
    job_happiness: string | null
    career_goals: string | null
    family_description: string | null
    life_description: string | null
    biggest_regret: string | null
    life_purpose: string | null
  }
}

const RELATIONSHIP_OPTIONS = [
  '',
  'Single',
  'In a relationship',
  'Engaged',
  'Married',
  'Separated',
  'Divorced',
  'Widowed',
  'It\'s complicated',
  'Prefer not to say',
]

function Field({
  label,
  hint,
  name,
  defaultValue,
  type = 'text',
  rows,
}: {
  label: string
  hint?: string
  name: string
  defaultValue?: string | null
  type?: 'text' | 'textarea'
  rows?: number
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-label">
        {label}
      </label>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      {type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          defaultValue={defaultValue ?? ''}
          rows={rows ?? 3}
          className="w-full bg-input border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
        />
      ) : (
        <input
          id={name}
          name={name}
          type="text"
          defaultValue={defaultValue ?? ''}
          className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      )}
    </div>
  )
}

export function ProfileContextForm({ initialData }: Props) {
  const [open, setOpen] = useState(false)
  const [state, action, isPending] = useActionState(updateProfileContext, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-label">Life context</p>
          <p className="text-xs text-muted-foreground">
            Background details that help the AI give you more meaningful prompts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {open ? 'Hide' : 'Edit'}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <form action={action} className="space-y-6 pt-2">

              {/* ── Life & family ─────────────────────────────────── */}
              <div className="space-y-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Life &amp; family</p>

                <div className="space-y-1.5">
                  <label htmlFor="relationship_status" className="text-label">Relationship status</label>
                  <select
                    id="relationship_status"
                    name="relationship_status"
                    defaultValue={initialData.relationship_status ?? ''}
                    className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {RELATIONSHIP_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o || '— not set —'}</option>
                    ))}
                  </select>
                </div>

                <Field label="Location" name="location" defaultValue={initialData.location}
                  hint="City, country, or region" />

                <Field label="Family" name="family_description" type="textarea" rows={4}
                  defaultValue={initialData.family_description}
                  hint="Who are the key people in your life? Describe your family in your own words." />
              </div>

              {/* ── Career ─────────────────────────────────────────── */}
              <div className="space-y-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Career</p>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Company" name="company" defaultValue={initialData.company} />
                  <Field label="Role" name="job_title" defaultValue={initialData.job_title} />
                </div>

                <Field label="How do you feel about your work right now?" name="job_happiness"
                  type="textarea" rows={2} defaultValue={initialData.job_happiness} />

                <Field label="Career goals" name="career_goals" type="textarea" rows={3}
                  defaultValue={initialData.career_goals}
                  hint="Where are you trying to go, or what are you working toward?" />
              </div>

              {/* ── Inner life ─────────────────────────────────────── */}
              <div className="space-y-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Inner life</p>

                <Field label="How would you describe your life right now?" name="life_description"
                  type="textarea" rows={4} defaultValue={initialData.life_description} />

                <Field label="Your life purpose" name="life_purpose" type="textarea" rows={3}
                  defaultValue={initialData.life_purpose}
                  hint="What do you believe you're here to do or be?" />

                <Field label="Your biggest regret" name="biggest_regret" type="textarea" rows={3}
                  defaultValue={initialData.biggest_regret}
                  hint="What would you do differently, and what did you learn from it?" />
              </div>

              <AnimatePresence>
                {state?.error && (
                  <motion.p
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    role="alert" className="text-xs text-destructive"
                  >
                    {state.error}
                  </motion.p>
                )}
                {state?.success && (
                  <motion.p
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-muted-foreground"
                  >
                    Saved. Your next prompts will reflect these updates.
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isPending}
                className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {isPending ? 'Saving…' : 'Save context'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
