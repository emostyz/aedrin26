'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

export async function deleteAccount(_prevState: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const confirmedEmail = (formData.get('email') as string | null)?.trim().toLowerCase()
  if (confirmedEmail !== user.email?.toLowerCase()) {
    return { error: 'Email does not match. Please type your exact email address.' }
  }

  const service = createServiceClient()

  // ── Delete storage files before removing the auth user ──────────────────────
  // The DB cascade removes soul_entries rows but NOT the files in Supabase
  // Storage. We must delete them first so no orphaned data survives.
  await Promise.allSettled([
    // Avatar: stored as `{userId}.{ext}` — list the folder prefix to find it
    service.storage.from('avatars').list(user.id).then(async ({ data: files }) => {
      if (files && files.length > 0) {
        const paths = files.map((f) => `${user.id}/${f.name}`)
        await service.storage.from('avatars').remove(paths)
      }
    }),
    // Artifacts: stored as `{userId}/{timestamp}.{ext}` — list and remove all
    service.storage.from('artifacts').list(user.id).then(async ({ data: files }) => {
      if (files && files.length > 0) {
        const paths = files.map((f) => `${user.id}/${f.name}`)
        await service.storage.from('artifacts').remove(paths)
      }
    }),
  ])

  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) return { error: error.message }

  await supabase.auth.signOut()
  redirect('/')
}
