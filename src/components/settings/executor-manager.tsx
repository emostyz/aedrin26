'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { addExecutor, removeExecutor } from '@/app/actions/settings'

type Executor = { id: string; name: string; email: string }

interface Props {
  initialExecutors: Executor[]
}

export function ExecutorManager({ initialExecutors }: Props) {
  const [executors, setExecutors] = useState<Executor[]>(initialExecutors)
  const [showForm, setShowForm]   = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [isPending, start]        = useTransition()

  function handleAdd(formData: FormData) {
    setError(null)
    start(async () => {
      const result = await addExecutor(formData)
      if (result?.error) { setError(result.error); return }
      setExecutors((prev) => [...prev, {
        id: crypto.randomUUID(),
        name: formData.get('name') as string,
        email: formData.get('email') as string,
      }])
      setShowForm(false)
    })
  }

  function handleRemove(id: string) {
    start(async () => {
      const result = await removeExecutor(id)
      if (!result?.error) setExecutors((prev) => prev.filter((e) => e.id !== id))
    })
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-label">Executors</p>
          <p className="text-xs text-muted-foreground">
            Executors may initiate the death verification process. Share AEDRIN with them so they know their role.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add executor'}
        </button>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="exec-name" className="text-label">Name</label>
                  <input id="exec-name" name="name" required placeholder="Full name"
                    className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="exec-email" className="text-label">Email</label>
                  <input id="exec-email" name="email" type="email" required
                    className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>
              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
              <button type="submit" disabled={isPending}
                className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
                {isPending ? 'Adding…' : 'Add executor'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {executors.length === 0 ? (
        <div className="border border-border rounded-lg px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">No executors designated yet.</p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          <div className="space-y-2">
            {executors.map((exec) => (
              <motion.div
                key={exec.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                className="flex items-center justify-between border border-border rounded-lg px-5 py-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm text-foreground">{exec.name}</p>
                  <p className="text-xs text-muted-foreground">{exec.email}</p>
                </div>
                <button onClick={() => handleRemove(exec.id)} disabled={isPending}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40">
                  Remove
                </button>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </section>
  )
}
