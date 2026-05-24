'use client'

import { useState, useTransition } from 'react'
import { addExecutor, removeExecutor } from '@/app/actions/settings'

type Executor = { id: string; name: string; email: string }

interface Props {
  initialExecutors: Executor[]
}

export function ExecutorManager({ initialExecutors }: Props) {
  const [executors, setExecutors] = useState<Executor[]>(initialExecutors)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd(formData: FormData) {
    setError(null)
    startTransition(async () => {
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
    startTransition(async () => {
      const result = await removeExecutor(id)
      if (!result?.error) setExecutors((prev) => prev.filter((e) => e.id !== id))
    })
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Executors</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Executors may initiate the death verification process. Share AEDRIN with them so they know their role.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
        >
          {showForm ? 'Cancel' : '+ Add executor'}
        </button>
      </div>

      {showForm && (
        <form action={handleAdd} className="rounded-lg border border-border px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="exec-name" className="text-xs font-medium text-foreground">Name</label>
              <input id="exec-name" name="name" required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label htmlFor="exec-email" className="text-xs font-medium text-foreground">Email</label>
              <input id="exec-email" name="email" type="email" required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <button type="submit" disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {isPending ? 'Adding…' : 'Add executor'}
          </button>
        </form>
      )}

      {executors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No executors designated yet.</p>
      ) : (
        <ul className="space-y-2">
          {executors.map((exec) => (
            <li key={exec.id} className="flex items-center justify-between rounded-lg border border-border px-5 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{exec.name}</p>
                <p className="text-xs text-muted-foreground">{exec.email}</p>
              </div>
              <button onClick={() => handleRemove(exec.id)} disabled={isPending}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
