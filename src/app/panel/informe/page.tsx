import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Locked } from '@/components/app/Locked'
import { PageHead } from '@/components/app/PageHead'
import ui from '@/components/app/ui.module.css'
import { getAccess, has } from '@/lib/access'
import { getEntries, getPlanContent, getProfile, getToday } from '@/lib/data'
import { addDays, breakdown, computeStats, findPatterns, fmtR, monthEnd, weekStart } from '@/lib/domain/journal'
import { sessionsOf } from '@/lib/domain/plan'
import { getCurrentUser } from '@/lib/supabase/server'
import { PrintButton } from '../revision/ReviewParts'
import styles from './informe.module.css'

export const metadata: Metadata = { title: 'Informe mensual' }

export default async function InformePage({ searchParams }: PageProps<'/panel/informe'>) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/panel/informe')
  const [sp, today, access, profile, plan] = await Promise.all([searchParams, getToday(user.id), getAccess(), getProfile(user.id), getPlanContent(user.id)])
  const month = typeof sp.mes === 'string' && /^\d{4}-\d{2}$/.test(sp.mes) && sp.mes <= today.isoDate.slice(0, 7) ? sp.mes : today.isoDate.slice(0, 7)
  const from = `${month}-01`
  const to = monthEnd(from)
  const prevMonth = addDays(from, -1).slice(0, 7)
  const nextMonth = addDays(to, 1).slice(0, 7)
  const label = new Date(`${from}T12:00:00Z`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  if (!has(access, 'pdf_reports'))
    return (
      <>
        <PageHead eyebrow="Informe" title="Informe mensual" />
        <Locked plan="Pro" title="Tu mes, en un PDF">
          Resumen del mes, evolución semana a semana, mercados, emociones y patrones, listo para guardar o enviar a tu mentor.
        </Locked>
      </>
    )

  const entries = await getEntries(user.id, { from, to })
  const s = computeStats(entries)
  const rules = plan?.rules
  const patterns = findPatterns(entries, rules ? { maxTrades: rules.maxTrades, maxLoss: rules.maxLoss, sessions: sessionsOf(rules) } : {})
  const weeks: { start: string; s: ReturnType<typeof computeStats> }[] = []
  for (let w = weekStart(from); w <= to; w = addDays(w, 7))
    weeks.push({ start: w, s: computeStats(entries.filter((e) => e.date >= w && e.date <= addDays(w, 6))) })
  const n = (x: number | null, suf = '') => (x == null ? '—' : `${x.toLocaleString('es-ES', { maximumFractionDigits: 2 })}${suf}`)

  return (
    <article className={styles.report}>
      <div className={`${ui.row} ${ui.noPrint}`} style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <div className={ui.row}>
          <Link href={`/panel/informe?mes=${prevMonth}`} className="btn btn-ghost btn-sm" aria-label="Mes anterior">
            ←
          </Link>
          {month < today.isoDate.slice(0, 7) && (
            <Link href={`/panel/informe?mes=${nextMonth}`} className="btn btn-ghost btn-sm" aria-label="Mes siguiente">
              →
            </Link>
          )}
        </div>
        <PrintButton />
      </div>
      <header className={styles.head}>
        <span className="eyebrow">Time to Trade · Informe mensual</span>
        <h1>
          {profile.name ? `${profile.name}, ` : ''}
          <span className="hl-grad">{label}</span>
        </h1>
        <p className="muted">Generado el {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}. Herramienta de registro; no es asesoramiento financiero.</p>
      </header>

      <div className={ui.tiles}>
        <div className={`${ui.tile} ${ui.accent}`}>
          <span>Cumplimiento</span>
          <b>{n(s.compliancePct, ' %')}</b>
        </div>
        <div className={ui.tile}>
          <span>Resultado</span>
          <b>{fmtR(s.totalR)}</b>
        </div>
        <div className={ui.tile}>
          <span>Operaciones</span>
          <b>{s.trades}</b>
          <small>{s.skipped} no realizadas</small>
        </div>
        <div className={ui.tile}>
          <span>Ganadoras · R medio</span>
          <b>
            {n(s.winPct, ' %')} · {n(s.avgR)}
          </b>
        </div>
      </div>

      <section className={`card ${ui.section}`}>
        <span className={ui.secN}>Semana a semana</span>
        <table className={ui.table}>
          <thead>
            <tr>
              <th>Semana</th>
              <th className={ui.num}>Op.</th>
              <th className={ui.num}>Cumplimiento</th>
              <th className={ui.num}>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.start}>
                <td>Desde el {new Date(`${w.start}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</td>
                <td className={ui.num}>{w.s.trades}</td>
                <td className={ui.num}>{n(w.s.compliancePct, ' %')}</td>
                <td className={ui.num}>{fmtR(w.s.totalR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {s.trades > 0 && (
        <section className={`card ${ui.section}`}>
          <span className={ui.secN}>Por mercado y por emoción</span>
          <div className={ui.grid2}>
            {(['asset', 'emotion'] as const).map((by) => (
              <table key={by} className={ui.table}>
                <thead>
                  <tr>
                    <th>{by === 'asset' ? 'Mercado' : 'Emoción'}</th>
                    <th className={ui.num}>Op.</th>
                    <th className={ui.num}>R</th>
                    <th className={ui.num}>Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown(entries, by).map((r) => (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td className={ui.num}>{r.trades}</td>
                      <td className={ui.num}>{fmtR(r.totalR)}</td>
                      <td className={ui.num}>{n(r.compliancePct, ' %')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </section>
      )}

      <section className={`card ${ui.section}`}>
        <span className={ui.secN}>Patrones del mes</span>
        {patterns.length ? (
          <ul className="arrows">
            {patterns.map((p) => (
              <li key={p.id}>
                <b>{p.title}.</b> {p.text} <i>{p.tip}</i>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Sin patrones destacables este mes (hacen falta al menos 5 operaciones).</p>
        )}
      </section>
    </article>
  )
}
