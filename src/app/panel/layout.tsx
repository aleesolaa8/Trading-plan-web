import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app/AppShell'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // El proxy ya protege /panel; esta comprobación es la segunda barrera.
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/panel')

  const supabase = await createClient()
  const { data: profile } = (await supabase?.from('profiles').select('display_name').eq('id', user.id).maybeSingle()) ?? {
    data: null,
  }
  const name = profile?.display_name ?? user.name ?? user.email?.split('@')[0] ?? 'Trader'

  return (
    <AppShell name={name} email={user.email}>
      {children}
    </AppShell>
  )
}
