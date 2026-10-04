'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import ui from '@/components/app/ui.module.css'
import type { Account, EntryRow } from '@/lib/data'
import { COMPLIANCE, EMOTIONS, ERRORS, fmtDate, fmtR } from '@/lib/domain/journal'
import { deleteEntry, reviewShot } from './actions'
import { JournalForm, type JournalFormApi } from './JournalForm'
import styles from './journal.module.css'

export function EntryList({
  entries,
  shots,
  accounts,
  canReview,
  userId,
  today,
  markets,
}: {
  entries: EntryRow[]
  shots: Record<string, string>
  accounts: Account[]
  canReview: boolean
  userId: string
  today: string
  markets: string[]
}) {
  const router = useRouter()
  const form = useRef<JournalFormApi>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; text: string } | null>(null)
  const [, start] = useTransition()
  const accName = new Map(accounts.map((a) => [a.id, a.name]))
  const multi = accounts.length > 1

  if (!entries.length)
    return (
      <div className={ui.empty}>
        <b>Aún no hay entradas en este periodo.</b>
        <span>Registra cada operación y también las que decides no hacer: ahí empiezan tus patrones.</span>
      </div>
    )

  return (
    <>
      <ol className={styles.list}>
        {entries.map((e) => {
          const trade = e.type === 'trade'
          const r = e.resultR ?? 0
          return (
            <li key={e.id} className={styles.entry}>
              <div className={styles.entryTop}>
                <div className={styles.entryMain}>
                  <time>
                    {fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                    {e.time ? ` · ${e.time}` : ''}
                  </time>
                  <b>{e.asset}</b>
                  {trade ? (
                    <span className={`chip ${e.direction === 'long' ? '' : 'chip-blue'}`}>{e.direction === 'long' ? 'Compra' : 'Venta'}</span>
                  ) : (
                    <span className="chip chip-amber">No realizada</span>
                  )}
                  {multi && e.accountId && <span className="muted">{accName.get(e.accountId)}</span>}
                </div>
                {trade && (
                  <strong className={`${styles.r} ${r > 0 ? ui.pos : r < 0 ? ui.neg : ''}`}>
                    {fmtR(r)}
                    {e.amount != null && <small>{e.amount.toLocaleString('es-ES', { maximumFractionDigits: 2 })}</small>}
                  </strong>
                )}
              </div>
              <div className={styles.tags}>
                {trade && e.compliance && (
                  <span className={e.compliance === 'si' ? styles.tagOk : e.compliance === 'no' ? styles.tagBad : styles.tagMid}>Plan: {COMPLIANCE[e.compliance]}</span>
                )}
                {e.emotion && <span>{EMOTIONS[e.emotion]}</span>}
                {trade && e.error && e.error !== 'ninguno' && <span className={styles.tagMid}>{ERRORS[e.error]}</span>}
              </div>
              {!trade && e.skipReason && <p className={styles.note}>{e.skipReason}</p>}
              {e.lesson && <p className={styles.note}>{e.lesson}</p>}
              {e.screenshotPath && shots[e.screenshotPath] && (
                <a href={shots[e.screenshotPath]} target="_blank" rel="noreferrer" className={styles.shot}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shots[e.screenshotPath]} alt={`Captura de ${e.asset}`} loading="lazy" />
                </a>
              )}
              {e.aiFeedback && (
                <div className={styles.ai}>
                  <span className="chip chip-blue">Revisión de la captura con IA</span>
                  <p>{e.aiFeedback}</p>
                </div>
              )}
              {msg?.id === e.id && (
                <p className="notice notice-info" role="status">
                  {msg.text}
                </p>
              )}
              <div className={styles.actions}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => form.current?.edit(e)}>
                  Editar
                </button>
                {e.screenshotPath && canReview && !e.aiFeedback && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy === e.id}
                    onClick={() => {
                      setBusy(e.id)
                      start(async () => {
                        const res = await reviewShot(e.id)
                        setBusy(null)
                        if (!res.ok) setMsg({ id: e.id, text: res.message ?? 'No se ha podido revisar.' })
                        router.refresh()
                      })
                    }}
                  >
                    {busy === e.id ? 'Revisando…' : 'Revisar captura con IA'}
                  </button>
                )}
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm ${ui.dangerBtn}`}
                  onClick={() => {
                    if (!confirm('¿Borrar esta entrada?')) return
                    start(async () => {
                      await deleteEntry(e.id)
                      router.refresh()
                    })
                  }}
                >
                  Borrar
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      <JournalForm
        userId={userId}
        today={today}
        nowTime=""
        accounts={accounts}
        markets={markets}
        api={form}
        showButtons={false}
      />
    </>
  )
}
