import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Locked } from '@/components/app/Locked'
import { PageHead } from '@/components/app/PageHead'
import ui from '@/components/app/ui.module.css'
import { getAccess, has } from '@/lib/access'
import { getAccounts, getAssets, getEntries, getPlanContent, getToday } from '@/lib/data'
import { addDays, breakdown, computeStats, findPatterns, fmtR, fundedStatus, monthStart, weekStart } from '@/lib/domain/journal'
import { hhmm, sessionsOf } from '@/lib/domain/plan'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { EntryList } from './EntryList'
import { JournalForm, type FormPreset } from './JournalForm'
import styles from './journal.module.css'

export const metadata: Metadata = { title: 'Journal' }

const PERIODS = { semana: 'Esta semana', mes: 'Este mes', '90': '90 días', todo: 'Todo' } as const
type Period = keyof typeof PERIODS
const uuid = /^[0-9a-f-]{36}$/i

export default async function JournalPage({ searchParams }: PageProps<'/panel/journal'>) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/panel/journal')
  const sp = await searchParams
  const today = await getToday(user.id)
  const period: Period = typeof sp.periodo === 'string' && sp.periodo in PERIODS ? (sp.periodo as Period) : 'mes'
  const from = period === 'semana' ? weekStart(today.isoDate) : period === 'mes' ? monthStart(today.isoDate) : period === '90' ? addDays(today.isoDate, -89) : undefined
  const [access, accounts, assets, plan] = await Promise.all([getAccess(), getAccounts(user.id), getAssets(user.id), getPlanContent(user.id)])
  const account = typeof sp.cuenta === 'string' && accounts.some((a) => a.id === sp.cuenta) ? sp.cuenta : null

  const [entries, recent] = await Promise.all([
    getEntries(user.id, { from, to: today.isoDate, account }),
    getEntries(user.id, { from: addDays(today.isoDate, -89), account }),
  ])
  const s = computeStats(entries)
  const rules = plan?.rules
  const patterns = has(access, 'patterns') ? findPatterns(recent, rules ? { maxTrades: rules.maxTrades, maxLoss: rules.maxLoss, sessions: sessionsOf(rules) } : {}) : []
  const funded = has(access, 'funded_mode') ? accounts.filter((a) => a.kind === 'fondeo' && !a.archived && a.initial && (!account || a.id === account)) : []
  const fundedEntries = funded.length ? await getEntries(user.id, { account: funded.length === 1 ? funded[0]!.id : null }) : []

  // Capturas: enlaces firmados de 1 hora (el bucket es privado)
  const supabase = await createClient()
  const paths = entries.map((e) => e.screenshotPath).filter((p): p is string => Boolean(p))
  const shots: Record<string, string> = {}
  if (paths.length && supabase) {
    const { data } = await supabase.storage.from('journal').createSignedUrls(paths, 3600)
    for (const d of data ?? []) if (d.path && d.signedUrl) shots[d.path] = d.signedUrl
  }

  const markets = [...new Set([...(rules?.markets ?? []), ...assets.map((a) => a.name)])]
  const preset: FormPreset =
    sp.nueva === 'si' || sp.nueva === 'no'
      ? {
          type: sp.nueva === 'si' ? 'trade' : 'skipped',
          asset: typeof sp.mercado === 'string' ? sp.mercado.slice(0, 30) : undefined,
          accountId: typeof sp.cuenta === 'string' && uuid.test(sp.cuenta) ? sp.cuenta : undefined,
          checklistRunId: typeof sp.checklist === 'string' && uuid.test(sp.checklist) ? sp.checklist : undefined,
        }
      : null
  const q = (o: Record<string, string | null>) => {
    const p = new URLSearchParams()
    const merged = { periodo: period, cuenta: account, ...o }
    for (const [k, v] of Object.entries(merged)) if (v && !(k === 'periodo' && v === 'mes')) p.set(k, v)
    const str = p.toString()
    return `/panel/journal${str ? `?${str}` : ''}`
  }
  const journalLimit = access.features.journal_entries_per_month
  const adv = has(access, 'advanced_stats')
  const n = (x: number | null, suf = '') => (x == null ? '—' : `${x.toLocaleString('es-ES', { maximumFractionDigits: 2 })}${suf}`)

  return (
    <>
      <PageHead eyebrow="Registro" title={<>Tu <span className="hl-grad">journal</span>.</>}>
        Cada operación y cada operación que decides no hacer, con cómo te sentías. Sin juicios: datos para mejorar.
      </PageHead>

      <JournalForm
        userId={user.id}
        today={today.isoDate}
        nowTime={hhmm(today.minutes)}
        accounts={accounts}
        markets={markets}
        preset={preset}
      />
      {journalLimit ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          Plan Free: hasta {journalLimit} entradas al mes. <Link href="/panel/ajustes#plan">Con Core, sin límite.</Link>
        </p>
      ) : null}

      <div className={styles.filters}>
        <nav className={ui.seg} aria-label="Periodo">
          {(Object.keys(PERIODS) as Period[]).map((p) => (
            <Link key={p} href={q({ periodo: p })} aria-current={p === period ? 'page' : undefined} scroll={false}>
              {PERIODS[p]}
            </Link>
          ))}
        </nav>
        {accounts.length > 1 && (
          <nav className={ui.seg} aria-label="Cuenta">
            <Link href={q({ cuenta: null })} aria-current={!account ? 'page' : undefined} scroll={false}>
              Todas
            </Link>
            {accounts.map((a) => (
              <Link key={a.id} href={q({ cuenta: a.id })} aria-current={a.id === account ? 'page' : undefined} scroll={false}>
                {a.name}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <div className={ui.tiles}>
        <div className={`${ui.tile} ${ui.accent}`}>
          <span>Cumplimiento</span>
          <b>{n(s.compliancePct, ' %')}</b>
          <small>operaciones según tu plan</small>
        </div>
        <div className={ui.tile}>
          <span>Resultado</span>
          <b className={s.totalR > 0 ? ui.pos : s.totalR < 0 ? ui.neg : ''}>{fmtR(s.totalR)}</b>
          <small>R medio {n(s.avgR)}</small>
        </div>
        <div className={ui.tile}>
          <span>Ganadoras</span>
          <b>{n(s.winPct, ' %')}</b>
          <small>de {s.trades} operaciones</small>
        </div>
        <div className={ui.tile}>
          <span>No realizadas</span>
          <b>{s.skipped}</b>
          <small>decir que no también cuenta</small>
        </div>
      </div>

      {funded.map((a) => {
        const st = fundedStatus(
          { initial: a.initial!, dailyLossPct: a.daily, maxDrawdownPct: a.drawdown, profitTargetPct: a.target },
          fundedEntries.filter((e) => e.accountId === a.id),
          today.isoDate,
        )
        const money = (x: number) => `${x.toLocaleString('es-ES', { maximumFractionDigits: 0 })} ${a.currency}`
        return (
          <section key={a.id} className={`card ${ui.section} ${st.level === 'breached' ? styles.breached : st.level === 'near' ? styles.near : ''}`}>
            <div className={ui.secHead}>
              <span className={ui.secN}>Fondeo · {a.name}</span>
              <span className={`chip ${st.level === 'ok' ? '' : st.level === 'near' ? 'chip-amber' : 'chip-red'}`}>
                {st.level === 'ok' ? 'Con margen' : st.level === 'near' ? 'Cerca del límite' : 'Límite alcanzado'}
              </span>
            </div>
            <div className={ui.grid2}>
              {st.daily && (
                <div className={styles.gauge}>
                  <div className={ui.row}>
                    <b>Margen de hoy</b>
                    <span className="muted">
                      {money(st.daily.left)} de {money(st.daily.limit)}
                    </span>
                  </div>
                  <div className={ui.bar} data-level={st.daily.usedPct >= 100 ? 'breached' : st.daily.usedPct >= 70 ? 'near' : 'ok'}>
                    <i style={{ width: `${st.daily.usedPct}%` }} />
                  </div>
                </div>
              )}
              {st.drawdown && (
                <div className={styles.gauge}>
                  <div className={ui.row}>
                    <b>Caída máxima</b>
                    <span className="muted">
                      {money(st.drawdown.left)} de {money(st.drawdown.limit)}
                    </span>
                  </div>
                  <div className={ui.bar} data-level={st.drawdown.usedPct >= 100 ? 'breached' : st.drawdown.usedPct >= 70 ? 'near' : 'ok'}>
                    <i style={{ width: `${st.drawdown.usedPct}%` }} />
                  </div>
                </div>
              )}
              {st.target && (
                <div className={styles.gauge}>
                  <div className={ui.row}>
                    <b>Objetivo</b>
                    <span className="muted">
                      {money(Math.max(0, st.totalPL))} de {money(st.target.amount)}
                    </span>
                  </div>
                  <div className={ui.bar}>
                    <i style={{ width: `${st.target.progressPct}%` }} />
                  </div>
                </div>
              )}
            </div>
            {st.level !== 'ok' && (
              <p className={`notice ${st.level === 'breached' ? 'notice-error' : 'notice-warn'}`}>
                {st.level === 'breached'
                  ? 'Has llegado a un límite de la prueba. Para hoy: plataforma cerrada y revisión tranquila.'
                  : 'Te acercas a un límite de la prueba. Valora reducir el riesgo a la mitad o terminar la sesión.'}
              </p>
            )}
            <small className="muted">Calculado con el resultado en dinero de cada operación de esta cuenta. Caída máxima estática desde el capital inicial.</small>
          </section>
        )
      })}

      <section className={`card ${ui.section}`}>
        <div className={ui.secHead}>
          <span className={ui.secN}>Tus patrones · últimos 90 días</span>
          <Link href="/panel/revision" className="muted" style={{ fontSize: 14, fontWeight: 700 }}>
            Revisión semanal →
          </Link>
        </div>
        {!has(access, 'patterns') ? (
          <Locked plan="Core" title="Descubre tus patrones">
            Qué pasa después de una pérdida, con qué emoción operas peor, qué error se repite… Observaciones sin juicio, cada una con un consejo práctico.
          </Locked>
        ) : patterns.length ? (
          <div className={styles.patterns}>
            {patterns.map((p) => (
              <article key={p.id} className={`${styles.pattern} ${p.tone === 'good' ? styles.good : ''}`}>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
                <p className={styles.tip}>
                  <b>Prueba:</b> {p.tip}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">
            {recent.filter((e) => e.type === 'trade').length < 5
              ? 'Con 5 operaciones registradas empezamos a buscar patrones.'
              : 'De momento no vemos nada que destacar. Sigue registrando: es buena señal.'}
          </p>
        )}
      </section>

      <section className={`card ${ui.section}`}>
        <span className={ui.secN}>Estadísticas avanzadas · {PERIODS[period].toLowerCase()}</span>
        {!adv ? (
          <Locked plan="Pro" title="Por mercado, hora, día y emoción">
            Descubre en qué mercados, horas y días cumples mejor tu plan, y cómo influye tu estado de ánimo en tus resultados.
          </Locked>
        ) : s.trades === 0 ? (
          <p className="muted">Sin operaciones en este periodo.</p>
        ) : (
          <div className={styles.breakdowns}>
            {(
              [
                ['asset', 'Por mercado'],
                ['weekday', 'Por día'],
                ['hour', 'Por hora'],
                ['emotion', 'Por emoción'],
              ] as const
            ).map(([by, title]) => {
              const rows = breakdown(entries, by)
              if (!rows.length) return null
              return (
                <div key={by} className={ui.scrollX}>
                  <h3 className={styles.bdTitle}>{title}</h3>
                  <table className={ui.table}>
                    <thead>
                      <tr>
                        <th />
                        <th className={ui.num}>Op.</th>
                        <th className={ui.num}>R total</th>
                        <th className={ui.num}>Ganadoras</th>
                        <th className={ui.num}>Cumplimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.key}>
                          <td>{r.label}</td>
                          <td className={ui.num}>{r.trades}</td>
                          <td className={`${ui.num} ${r.totalR > 0 ? ui.pos : r.totalR < 0 ? ui.neg : ''}`}>{fmtR(r.totalR)}</td>
                          <td className={ui.num}>{n(r.winPct, ' %')}</td>
                          <td className={ui.num}>{n(r.compliancePct, ' %')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className={ui.section}>
        <div className={ui.secHead}>
          <span className={ui.secN}>Entradas · {PERIODS[period].toLowerCase()}</span>
          {has(access, 'export_csv') && (
            <a href="/api/export/journal" className="muted" style={{ fontSize: 14, fontWeight: 700 }} download>
              Descargar CSV
            </a>
          )}
        </div>
        <EntryList
          entries={entries}
          shots={shots}
          accounts={accounts}
          canReview={Number(access.features.ai_screenshot_reviews_per_month ?? 0) > 0}
          userId={user.id}
          today={today.isoDate}
          markets={markets}
        />
      </section>
    </>
  )
}
