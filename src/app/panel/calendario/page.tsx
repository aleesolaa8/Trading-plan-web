import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageHead } from '@/components/app/PageHead'
import { ButtonLink } from '@/components/ui/Button'
import { getPlanContent, getToday } from '@/lib/data'
import { SCREEN_LIMIT, type CalBlock } from '@/lib/domain/calendar'
import { sessionsOf, type BlockType } from '@/lib/domain/plan'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { WeekCalendar } from './WeekCalendar'

export const metadata: Metadata = { title: 'Calendario' }

export default async function CalendarioPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/panel/calendario')
  const supabase = await createClient()
  const [plan, today, res] = await Promise.all([
    getPlanContent(user.id),
    getToday(user.id),
    supabase?.from('calendar_blocks').select('id, title, block_type, start_time, duration_min, days_of_week, notes').eq('user_id', user.id),
  ])
  const blocks: CalBlock[] = (res?.data ?? []).map((b) => {
    const [h, m] = String(b.start_time).split(':').map(Number)
    return {
      id: b.id,
      title: b.title,
      type: b.block_type as BlockType,
      start: (h ?? 0) * 60 + (m ?? 0),
      duration: b.duration_min,
      days: b.days_of_week,
      notes: b.notes,
    }
  })

  return (
    <>
      <PageHead eyebrow="Planificación" title={<>Tu <span className="hl-grad">semana</span>.</>}>
        Trading, estudio, comida, ejercicio, sueño y desconexión en un mismo sitio. Muévelo a tu ritmo.
      </PageHead>
      {!plan && !blocks.length ? (
        <section className="card" style={{ display: 'grid', gap: 14, justifyItems: 'start' }}>
          <p className="muted">Cuando hagas el diagnóstico te proponemos una semana completa. También puedes empezar desde cero.</p>
          <ButtonLink href="/panel/diagnostico" arrow>
            Hacer el diagnóstico
          </ButtonLink>
        </section>
      ) : null}
      <WeekCalendar
        initial={blocks}
        today={today.day}
        nowMin={today.minutes}
        screenLimit={plan?.time ? SCREEN_LIMIT[plan.time] : undefined}
        sessions={plan ? sessionsOf(plan.rules) : []}
      />
    </>
  )
}
