import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app/AppShell'
import { getProfile, getToday } from '@/lib/data'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // El proxy ya protege /panel; esta comprobación es la segunda barrera.
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/panel')

  const [profile, today, supabase] = await Promise.all([getProfile(user.id), getToday(user.id), createClient()])
  const name = profile.name || user.name || user.email?.split('@')[0] || 'Trader'
  const { data: blocks } = (await supabase
    ?.from('calendar_blocks')
    .select('title, start_time, days_of_week')
    .eq('user_id', user.id)
    .eq('block_type', 'trading')) ?? { data: null }
  const reminders = (blocks ?? [])
    .filter((b) => (b.days_of_week as number[]).includes(today.day))
    .map((b) => {
      const [h, m] = String(b.start_time).split(':').map(Number)
      return { title: b.title as string, start: (h ?? 0) * 60 + (m ?? 0) }
    })

  return (
    <AppShell name={name} email={user.email} reminders={reminders} timezone={profile.timezone}>
      {children}
    </AppShell>
  )
}
