import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { ProfileForm } from '@/components/profile/profile-form'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('legal_name, display_name, dob, photo_url, email')
    .eq('id', user.id)
    .single()

  const profile = data as {
    legal_name: string
    display_name: string | null
    dob: string | null
    photo_url: string | null
    email: string
  } | null

  return (
    <div className="space-y-12">
      <FadeUp className="space-y-2">
        <p className="text-label">Profile</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          {profile?.display_name ?? profile?.legal_name ?? 'Your profile'}
        </p>
        <p className="text-sm text-muted-foreground">{profile?.email ?? user.email}</p>
      </FadeUp>

      <FadeUp delay={0.1}>
        <ProfileForm
          legalName={profile?.legal_name ?? ''}
          displayName={profile?.display_name ?? ''}
          dob={profile?.dob ?? ''}
          photoUrl={profile?.photo_url ?? null}
        />
      </FadeUp>
    </div>
  )
}
