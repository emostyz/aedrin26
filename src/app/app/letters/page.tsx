import { createClient } from '@/lib/supabase/server'
import { FadeUp, Stagger, StaggerItem } from '@/components/ui/motion'
import { LettersComposer } from '@/components/letters/letters-composer'

export default async function LettersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: rawHeirs }, { data: rawLetters }] = await Promise.all([
    supabase
      .from('heirs')
      .select('id, name, relationship')
      .eq('user_id', user.id)
      .order('created_at'),
    supabase
      .from('soul_entries')
      .select('id, content, bound_recipient_id, created_at')
      .eq('user_id', user.id)
      .eq('domain', 'messages')
      .not('bound_recipient_id', 'is', null)
      .order('created_at', { ascending: false }),
  ])

  const heirs = (rawHeirs ?? []).map((h: Record<string, unknown>) => ({
    id: h.id as string,
    name: h.name as string,
    relationship: h.relationship as string,
  }))

  const letters = (rawLetters ?? []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    content: l.content as string,
    bound_recipient_id: l.bound_recipient_id as string,
    created_at: l.created_at as string,
  }))

  return (
    <div className="space-y-16">
      <FadeUp className="space-y-2">
        <p className="text-label">Final letters</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          Words that wait.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
          Write personal letters to the people who matter most. These are kept completely private and delivered to each person by email only after you pass — a final gift from you, in your own words.
        </p>
      </FadeUp>

      <FadeUp delay={0.1}>
        <LettersComposer heirs={heirs} initialLetters={letters} />
      </FadeUp>

      {heirs.length === 0 && (
        <Stagger className="space-y-3 pt-4 border-t border-border">
          <StaggerItem>
            <p className="text-sm text-muted-foreground">
              You haven&apos;t added any heirs yet. Letters are addressed to specific people — add someone in{' '}
              <a href="/app/settings" className="text-foreground underline underline-offset-4">Settings</a>{' '}
              first.
            </p>
          </StaggerItem>
        </Stagger>
      )}
    </div>
  )
}
