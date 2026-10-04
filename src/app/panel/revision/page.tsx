import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Locked } from '@/components/app/Locked'
import { PageHead } from '@/components/app/PageHead'
import ui from '@/components/app/ui.module.css'
import { getAccess, has } from '@/lib/access'
import type { AiReview } from '@/lib/ai/review'
import { getEntries, getToday } from '@/lib/data'
import { addDays, computeStats, ERRORS, fmtDate, fmtR, weekdayOf, weekStart } from '@/lib/domain/journal'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { AdoptButton, GenerateButton, NotesForm } from './ReviewParts'
import styles from './revision.module.css'

export const metadata: Metadata = { title: 'Revisión semanal' }
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default async function RevisionPage({ searchParams }: PageProps<'/panel/revision'>) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/panel/revision')
  const [sp, today, access, supabase] = await Promise.all([searchParams, getToday(user.id), getAccess(), createClient()])
  const thisWeek = weekStart(today.isoDate)
  // Por defecto, la última semana completa; el fin de semana, la que acaba
  const def = today.day >= 6 ? thisWeek : addDays(thisWeek, -7)
  const asked = typeof sp.semana === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? weekStart(sp.semana) : def
  const wk = asked > thisWeek ? thisWeek : asked
  const end = addDays(wk, 6)

  const head = (
    <>
      <PageHead eyebrow="Revisión" title={<>Tu semana, <span className="hl-grad">en claro</span>.</>}>
        Números, lo que se repite y una sola mejora para la semana que viene.
      </PageHead>
      <nav className={styles.weekNav} aria-label="Semana">
        <Link href={`/panel/revision?semana=${addDays(wk, -7)}`} className="btn btn-ghost btn-sm" aria-label="Semana anterior">
          ←
        </Link>
        <b>
          {fmtDate(wk, { day: 'numeric', month: 'short' })} – {fmtDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}
        </b>
        {wk < thisWeek ? (
          <Link href={`/panel/revision?semana=${addDays(wk, 7)}`} className="btn btn-ghost btn-sm" aria-label="Semana siguiente">
            →
          </Link>
        ) : (
          <span className="btn btn-ghost btn-sm" aria-disabled="true">
            →
          </span>
        )}
      </nav>
    </>
  )

  if (!has(access, 'weekly_summary'))
    return (
      <>
        {head}
        <Locked plan="Core" title="Revisión semanal">
          Cada semana, tus números comparados con la anterior, por día, los errores que se repiten y tus notas. Con Pro, además, la IA la escribe por ti con
          una mejora concreta.
        </Locked>
      </>
    )

  const [entries, prev, saved, quota] = await Promise.all([
    getEntries(user.id, { from: wk, to: end }),
    getEntries(user.id, { from: addDays(wk, -7), to: addDays(wk, -1) }),
    supabase?.from('weekly_reviews').select('ai, user_notes').eq('user_id', user.id).eq('week_start', wk).maybeSingle(),
    supabase?.rpc('ai_quota', { p_kind: 'review' }),
  ])
  const s = computeStats(entries)
  const p = computeStats(prev)
  const ai = (saved?.data?.ai ?? null) as AiReview | null
  const q = (quota?.data ?? { used: 0, limit: 0 }) as { used: number; limit: number }
  const delta = (a: number | null, b: number | null, suf: string) =>
    a == null || b == null ? null : `${a - b >= 0 ? '+' : '−'}${Math.abs(Math.round((a - b) * 10) / 10).toLocaleString('es-ES')}${suf} vs. semana anterior`
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const list = entries.filter((e) => weekdayOf(e.date) === i + 1)
    return { day: i + 1, ...computeStats(list) }
  })
  const maxAbs = Math.max(1, ...perDay.map((d) => Math.abs(d.totalR)))
  const errors = new Map<string, number>()
  for (const e of entries) if (e.error && e.error !== 'ninguno') errors.set(e.error, (errors.get(e.error) ?? 0) + 1)

  return (
    <>
      {head}
      <div className={ui.tiles}>
        <div className={`${ui.tile} ${ui.accent}`}>
          <span>Cumplimiento</span>
          <b>{s.compliancePct != null ? `${s.compliancePct.toLocaleString('es-ES')} %` : '—'}</b>
          <small>{delta(s.compliancePct, p.compliancePct, ' pts') ?? 'sin semana anterior para comparar'}</small>
        </div>
        <div className={ui.tile}>
          <span>Resultado</span>
          <b className={s.totalR > 0 ? ui.pos : s.totalR < 0 ? ui.neg : ''}>{fmtR(s.totalR)}</b>
          <small>{delta(s.totalR, p.trades ? p.totalR : null, ' R') ?? `${s.trades} operaciones`}</small>
        </div>
        <div className={ui.tile}>
          <span>Operaciones</span>
          <b>{s.trades}</b>
          <small>
            {s.skipped} no realizadas · {s.winPct != null ? `${s.winPct.toLocaleString('es-ES')} % ganadoras` : '—'}
          </small>
        </div>
      </div>

      <section className={`card ${ui.section}`}>
        <span className={ui.secN}>Día a día</span>
        <div className={styles.days} role="img" aria-label="Resultado en R por día de la semana">
          {perDay.map((d) => (
            <div key={d.day} className={styles.day}>
              <div className={styles.barWrap}>
                <i
                  className={d.totalR >= 0 ? styles.up : styles.down}
                  style={{ height: `${(Math.abs(d.totalR) / maxAbs) * 100}%` }}
                />
              </div>
              <b className={d.totalR > 0 ? ui.pos : d.totalR < 0 ? ui.neg : 'muted'}>{d.trades || d.skipped ? fmtR(d.totalR) : '·'}</b>
              <small>{DAYS[d.day - 1]}</small>
              {d.trades > 0 && <small className="muted">{d.compliancePct?.toLocaleString('es-ES')} % plan</small>}
            </div>
          ))}
        </div>
        {errors.size > 0 && (
          <p className="muted">
            Lo que se repite:{' '}
            {[...errors.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => `${ERRORS[k as keyof typeof ERRORS].toLowerCase()} (${n})`)
              .join(', ')}
            .
          </p>
        )}
      </section>

      <section className={`card ${ui.section}`}>
        <div className={ui.secHead}>
          <span className={ui.secN}>Revisión escrita por IA</span>
          {ai && <span className="chip chip-blue">Propuestas, no órdenes</span>}
        </div>
        {Number(access.features.ai_reviews_per_month ?? 0) <= 0 ? (
          <Locked plan="Pro" title="Que la IA escriba tu revisión">
            Un resumen de tu semana, lo que hiciste bien, lo que puede indicar cada dato y una única mejora concreta que puedes añadir a tus protocolos con un
            clic.
          </Locked>
        ) : (
          <>
            {ai ? (
              <div className={styles.ai}>
                <p className={styles.lede}>{ai.resumen}</p>
                <div className={ui.grid2}>
                  {ai.bien.length > 0 && (
                    <div>
                      <h3>Lo que hiciste bien</h3>
                      <ul className="arrows">
                        {ai.bien.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {ai.observaciones.length > 0 && (
                    <div>
                      <h3>Lo que puede indicar</h3>
                      <ul className="arrows">
                        {ai.observaciones.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className={styles.mejora}>
                  <span className="chip">Una mejora para la semana que viene</span>
                  <h3>{ai.mejora.titulo}</h3>
                  <p>{ai.mejora.como}</p>
                  <AdoptButton week={wk} />
                </div>
                <p className="muted">
                  <b>Para pensar:</b> {ai.pregunta}
                </p>
              </div>
            ) : (
              <p className="muted">
                {entries.length ? 'Cuando quieras, la IA escribe tu revisión a partir de tus números y tus notas.' : 'Registra operaciones esta semana para poder revisarla.'}
              </p>
            )}
            {entries.length > 0 && <GenerateButton week={wk} again={Boolean(ai)} left={Math.max(0, q.limit - q.used)} />}
          </>
        )}
      </section>

      <section className={`card ${ui.section}`}>
        <NotesForm key={wk} week={wk} initial={saved?.data?.user_notes ?? ''} />
      </section>

      <div className={ui.row}>
        <Link href="/panel/journal?periodo=semana" className="btn btn-ghost btn-sm">
          Ver el journal
        </Link>
        <Link href={`/panel/informe?mes=${wk.slice(0, 7)}`} className="btn btn-ghost btn-sm">
          Informe del mes
        </Link>
      </div>
    </>
  )
}
