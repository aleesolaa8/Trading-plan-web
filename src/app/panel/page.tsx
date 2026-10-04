import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHead } from '@/components/app/PageHead'
import ui from '@/components/app/ui.module.css'
import { ButtonLink } from '@/components/ui/Button'
import { getAccess, has, trialDaysLeft } from '@/lib/access'
import { getEntries, getPlanContent, getProfile, getToday } from '@/lib/data'
import { addDays, computeStats, findPatterns, fmtR, weekStart } from '@/lib/domain/journal'
import { hhmm, sessionsOf, type BlockType } from '@/lib/domain/plan'
import { DAY_NAMES } from '@/lib/domain/time'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import styles from './dashboard.module.css'

export const metadata: Metadata = { title: 'Inicio' }

export default async function PanelHome() {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createClient()
  const [profile, today, access, plan] = await Promise.all([getProfile(user.id), getToday(user.id), getAccess(), getPlanContent(user.id)])
  const { data: prof } = (await supabase?.from('profiles').select('onboarding_done').eq('id', user.id).maybeSingle()) ?? { data: null }
  const name = profile.name || user.name || 'trader'
  const days = trialDaysLeft(access)

  if (!prof?.onboarding_done || !plan)
    return (
      <>
        <PageHead eyebrow="Tu panel" title={<>Hola, <span className="hl-grad">{name}</span>.</>}>
          Este es tu espacio. Empieza por el diagnóstico: con tus respuestas construimos tu plan, tu calendario y tus protocolos.
        </PageHead>
        <section className={`card ${styles.first}`}>
          <span className="chip">Primer paso · 3 minutos</span>
          <h2 className={ui.h2}>Haz tu diagnóstico de 7 preguntas</h2>
          <ul className="arrows">
            <li>Tu plan escrito con tus reglas</li>
            <li>Protocolos para los momentos difíciles</li>
            <li>Una semana propuesta con trading, descanso y vida</li>
          </ul>
          <ButtonLink href="/panel/diagnostico" size="xl" arrow>
            Empezar diagnóstico
          </ButtonLink>
        </section>
      </>
    )

  const wk = weekStart(today.isoDate)
  const [week, recent, blocksRes, protosRes] = await Promise.all([
    getEntries(user.id, { from: wk, to: today.isoDate }),
    getEntries(user.id, { from: addDays(today.isoDate, -59), to: today.isoDate }),
    supabase?.from('calendar_blocks').select('id, title, block_type, start_time, duration_min, days_of_week').eq('user_id', user.id),
    supabase?.from('protocols').select('id, title, trigger_text').eq('user_id', user.id).eq('is_active', true).order('sort_order').limit(3),
  ])
  const r = plan.rules
  const todayEntries = week.filter((e) => e.date === today.isoDate)
  const t = computeStats(todayEntries)
  const w = computeStats(week)
  const stop = t.trades >= r.maxTrades || t.totalR <= -r.maxLoss
  const blocks = (blocksRes?.data ?? [])
    .filter((b) => (b.days_of_week as number[]).includes(today.day))
    .map((b) => {
      const [h, m] = String(b.start_time).split(':').map(Number)
      return { id: b.id, title: b.title as string, type: b.block_type as BlockType, start: (h ?? 0) * 60 + (m ?? 0), duration: b.duration_min as number }
    })
    .sort((a, b) => a.start - b.start)
  const current = blocks.find((b) => b.start <= today.minutes && today.minutes < b.start + b.duration)
  const upcoming = blocks.filter((b) => b.start > today.minutes).slice(0, 3)

  // Racha: días con operaciones seguidos (hacia atrás) en los que todas cumplieron el plan
  const byDay = new Map<string, boolean>()
  for (const e of recent) if (e.type === 'trade') byDay.set(e.date, (byDay.get(e.date) ?? true) && e.compliance === 'si')
  let streak = 0
  for (const d of [...byDay.keys()].sort().reverse()) {
    if (!byDay.get(d)) break
    streak++
  }
  const pattern = has(access, 'patterns') ? findPatterns(recent, { maxTrades: r.maxTrades, maxLoss: r.maxLoss, sessions: sessionsOf(r) })[0] : undefined

  return (
    <>
      <PageHead eyebrow={`Hoy · ${DAY_NAMES[today.day - 1]}`} title={<>Hola, <span className="hl-grad">{name}</span>.</>} />

      {access.source === 'trial' && (
        <p className="notice notice-info" style={{ marginBottom: 16 }}>
          Estás probando Pro: te {days === 1 ? 'queda 1 día' : `quedan ${days} días`}. Después sigues gratis en Free.{' '}
          <Link href="/panel/ajustes#plan" style={{ textDecoration: 'underline' }}>
            Ver planes
          </Link>
        </p>
      )}
      {stop && (
        <p className="notice notice-error" role="status" style={{ marginBottom: 16 }}>
          Has llegado a tu límite de hoy ({t.trades} de {r.maxTrades} operaciones · {fmtR(t.totalR)}). Tu protocolo: cierra la plataforma. Mañana, más.
        </p>
      )}

      <div className={ui.tiles}>
        <div className={`${ui.tile} ${ui.accent}`}>
          <span>{current ? 'Ahora' : 'Próximo bloque'}</span>
          <b>{current?.title ?? upcoming[0]?.title ?? 'Día terminado'}</b>
          <small>
            {current
              ? `${hhmm(current.start)}–${hhmm(current.start + current.duration)}`
              : upcoming[0]
                ? `a las ${hhmm(upcoming[0].start)}`
                : 'Descansa. Mañana, más.'}
          </small>
        </div>
        <div className={`${ui.tile} ${stop ? ui.dangerTile : ''}`}>
          <span>Hoy</span>
          <b>
            {t.trades} / {r.maxTrades} op.
          </b>
          <small>
            {fmtR(t.totalR)} · límite −{r.maxLoss.toLocaleString('es-ES')} R
          </small>
        </div>
        <div className={ui.tile}>
          <span>Esta semana</span>
          <b>{w.compliancePct != null ? `${w.compliancePct.toLocaleString('es-ES')} % plan` : '—'}</b>
          <small>
            {fmtR(w.totalR)} en {w.trades} operaciones
          </small>
        </div>
        <div className={ui.tile}>
          <span>Racha</span>
          <b>
            {streak} {streak === 1 ? 'día' : 'días'}
          </b>
          <small>seguidos cumpliendo tu plan</small>
        </div>
      </div>

      <div className={styles.actions}>
        <ButtonLink href="/panel/calculadora" arrow>
          Calcular y checklist
        </ButtonLink>
        <ButtonLink href="/panel/journal?nueva=si" variant="ghost">
          Registrar operación
        </ButtonLink>
        <ButtonLink href="/panel/journal?nueva=no" variant="ghost">
          No realizada
        </ButtonLink>
      </div>

      <div className={styles.cols}>
        <section className={`card ${ui.section}`}>
          <div className={ui.secHead}>
            <span className={ui.secN}>Lo que queda de hoy</span>
            <Link href="/panel/calendario" className={styles.link}>
              Calendario →
            </Link>
          </div>
          {upcoming.length || current ? (
            <ol className={styles.agenda}>
              {[...(current ? [current] : []), ...upcoming].map((b) => (
                <li key={b.id} data-type={b.type}>
                  <time>{hhmm(b.start)}</time>
                  <span>{b.title}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">No te quedan bloques hoy.</p>
          )}
        </section>

        <section className={`card ${ui.section}`}>
          <div className={ui.secHead}>
            <span className={ui.secN}>Tus protocolos</span>
            <Link href="/panel/plan" className={styles.link}>
              Mi plan →
            </Link>
          </div>
          {protosRes?.data?.length ? (
            <ul className={styles.protos}>
              {protosRes.data.map((p) => (
                <li key={p.id}>
                  {p.trigger_text && <small>{p.trigger_text}</small>}
                  <b>{p.title}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No tienes protocolos activos.</p>
          )}
        </section>
      </div>

      <section className={`card ${ui.section}`}>
        <div className={ui.secHead}>
          <span className={ui.secN}>{pattern ? 'Un patrón de tus últimas semanas' : 'Tu revisión semanal'}</span>
          <Link href="/panel/revision" className={styles.link}>
            Revisión →
          </Link>
        </div>
        {pattern ? (
          <>
            <h3>{pattern.title}</h3>
            <p className="muted">{pattern.text}</p>
            <p>
              <b>Prueba:</b> {pattern.tip}
            </p>
          </>
        ) : (
          <p className="muted">
            Registra tus operaciones (y las que no haces) en el journal. Cada semana verás tus números
            {has(access, 'ai_reviews_per_month') ? ' y la IA te escribirá una revisión con una mejora concreta.' : ' en la revisión semanal.'}
          </p>
        )}
      </section>
    </>
  )
}
