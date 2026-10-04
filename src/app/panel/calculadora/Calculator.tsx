'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { saveAsset } from '@/app/panel/actions'
import ui from '@/components/app/ui.module.css'
import type { Account, Asset } from '@/lib/data'
import { MARKETS, normalizeMarket } from '@/lib/domain/markets'
import { parseNum, positionSize } from '@/lib/domain/risk'
import { recordChecklist } from './actions'
import styles from './calc.module.css'

const fmt = (n: number, d = 2) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
const str = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

export function Calculator({
  assets,
  accounts,
  planMarkets,
  planRisk,
  checklist,
}: {
  assets: Asset[]
  accounts: Account[]
  planMarkets: string[]
  planRisk: number | null
  checklist: string[]
}) {
  const router = useRouter()
  const usable = accounts.filter((a) => !a.archived)
  const firstAcc = usable.find((a) => a.balance) ?? usable[0]
  const names = [...new Set([...planMarkets, ...assets.map((a) => a.name)])]
  const first = names[0] ?? '__otro'
  const fill = (name: string) => {
    const a = assets.find((x) => x.name === name)
    return { vpp: str(a?.valuePerPoint), min: str(a?.minLot ?? 0.01), step: str(a?.lotStep ?? 0.01), currency: a?.currency ?? firstAcc?.currency ?? 'EUR' }
  }
  const [account, setAccount] = useState(firstAcc?.id ?? '')
  const [v, setV] = useState({
    market: first,
    other: '',
    bal: str(firstAcc?.balance ?? null),
    risk: str(planRisk ?? 0.5),
    sl: '',
    ...fill(first),
  })
  const [saved, setSaved] = useState<string | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [pending, start] = useTransition()

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSaved(null)
    setV((s) => ({ ...s, [k]: e.target.value }))
  }
  const marketName = v.market === '__otro' ? normalizeMarket(v.other) : v.market
  const r = positionSize({
    balance: parseNum(v.bal),
    riskPct: parseNum(v.risk),
    stop: parseNum(v.sl),
    valuePerPoint: parseNum(v.vpp),
    minLot: parseNum(v.min),
    lotStep: parseNum(v.step),
  })
  const risk = parseNum(v.risk)
  const overPlan = planRisk != null && risk > planRisk
  const known = assets.find((a) => a.name === marketName)
  const changed = known
    ? str(known.valuePerPoint) !== v.vpp || str(known.minLot) !== v.min || str(known.lotStep) !== v.step
    : Boolean(marketName && v.vpp)
  const allOk = checklist.length > 0 && checked.length === checklist.length

  const go = (skip: boolean) =>
    start(async () => {
      const run = await recordChecklist(checklist, checked)
      const q = new URLSearchParams({ nueva: skip ? 'no' : 'si' })
      if (marketName) q.set('mercado', marketName)
      if (account) q.set('cuenta', account)
      if (run.id) q.set('checklist', run.id)
      router.push(`/panel/journal?${q}`)
    })

  return (
    <div className={styles.layout}>
      <section className={`card ${styles.calc}`} aria-labelledby="calc-title">
        <h2 id="calc-title" className={ui.secN}>
          Tamaño de la posición
        </h2>
        <div className={ui.formGrid}>
          {usable.length > 1 && (
            <label className={`field ${ui.full}`}>
              <span className="field-label">Cuenta</span>
              <select
                className={`input ${ui.select}`}
                value={account}
                onChange={(e) => {
                  setAccount(e.target.value)
                  const a = usable.find((x) => x.id === e.target.value)
                  if (a?.balance) setV((s) => ({ ...s, bal: str(a.balance) }))
                }}
              >
                {usable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={`field ${ui.full}`}>
            <span className="field-label">Mercado</span>
            <select
              className={`input ${ui.select}`}
              value={v.market}
              onChange={(e) => {
                const m = e.target.value
                setSaved(null)
                setV((s) => ({ ...s, market: m, ...(m === '__otro' ? {} : fill(m)) }))
              }}
            >
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                  {assets.some((a) => a.name === n) ? '' : ' · sin datos guardados'}
                </option>
              ))}
              <option value="__otro">Otro mercado…</option>
            </select>
          </label>
          {v.market === '__otro' && (
            <label className={`field ${ui.full}`}>
              <span className="field-label">Nombre del mercado</span>
              <input className="input" list="mk-list" value={v.other} onChange={set('other')} placeholder="Ej.: US500, café, SOLUSD…" maxLength={30} />
              <datalist id="mk-list">
                {MARKETS.map((m) => (
                  <option key={m.symbol} value={m.symbol}>
                    {m.name}
                  </option>
                ))}
              </datalist>
            </label>
          )}
          <label className="field">
            <span className="field-label">Capital ({v.currency})</span>
            <input className="input" inputMode="decimal" value={v.bal} onChange={set('bal')} placeholder="10000" />
          </label>
          <label className="field">
            <span className="field-label">Riesgo %</span>
            <input className="input" inputMode="decimal" value={v.risk} onChange={set('risk')} aria-invalid={overPlan} />
          </label>
          <label className={`field ${ui.full}`}>
            <span className="field-label">Distancia del stop (puntos o pips)</span>
            <input className={`input ${styles.big}`} inputMode="decimal" value={v.sl} onChange={set('sl')} placeholder="Ej.: 40" autoFocus />
          </label>
        </div>

        <details className={styles.contract} open={!known}>
          <summary>
            Datos del contrato de tu bróker {known && !changed ? <span className="chip">Guardados</span> : null}
          </summary>
          <div className={ui.formGrid}>
            <label className="field">
              <span className="field-label">Valor de 1 punto con 1 lote</span>
              <input className="input" inputMode="decimal" value={v.vpp} onChange={set('vpp')} placeholder="Ej.: 1" />
            </label>
            <label className="field">
              <span className="field-label">Lote mínimo</span>
              <input className="input" inputMode="decimal" value={v.min} onChange={set('min')} />
            </label>
            <label className="field">
              <span className="field-label">Paso de lote</span>
              <input className="input" inputMode="decimal" value={v.step} onChange={set('step')} />
            </label>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            Lo encuentras en la ficha del instrumento de tu plataforma. Cambia entre brókers y tipos de cuenta.
          </p>
          {changed && marketName && (
            <div className={ui.row}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await saveAsset({ id: known?.id, name: marketName, valuePerPoint: v.vpp, minLot: v.min, lotStep: v.step, currency: v.currency })
                    setSaved(res.ok ? `Datos de ${marketName} guardados.` : (res.message ?? 'No se ha podido guardar.'))
                    if (res.ok) router.refresh()
                  })
                }
              >
                Guardar datos de {marketName}
              </button>
              {saved && <span className="muted">{saved}</span>}
            </div>
          )}
        </details>

        <div className={`${styles.result} ${r.ok && !r.belowMin ? styles.resultOk : ''}`} aria-live="polite">
          <div>
            <small>Tamaño</small>
            <strong>{!r.ok ? '—' : r.belowMin ? '0 lotes' : `${fmt(r.lots, r.decimals)} lotes`}</strong>
          </div>
          <div className={styles.real}>
            <small>Riesgo real</small>
            <b>{r.ok && !r.belowMin ? `${fmt(r.realRisk)} ${v.currency} · ${fmt(r.realPct)} %` : '—'}</b>
          </div>
        </div>
        <div className={styles.warns}>
          {!r.ok && <p className="notice notice-info">Escribe la distancia del stop y los datos del contrato para ver el tamaño.</p>}
          {overPlan && (
            <p className="notice notice-error">
              Este riesgo ({fmt(risk, 2)} %) supera el límite de tu plan ({fmt(planRisk!, 2)} %).
            </p>
          )}
          {r.ok && r.belowMin && (
            <p className="notice notice-warn">
              Ni el lote mínimo ({v.min}) cabe en tu riesgo: con él arriesgarías {fmt(r.minLotRisk)} {v.currency}. Con este stop no puedes respetar tu plan;
              busca un stop más corto o no operes.
            </p>
          )}
          {r.ok && !r.belowMin && r.realRisk < r.riskMoney * 0.8 && (
            <p className="notice notice-info">El redondeo al paso de lote deja tu riesgo por debajo de lo previsto. Siempre hacia abajo, nunca hacia arriba.</p>
          )}
        </div>
      </section>

      <section className={`card ${styles.check}`} aria-labelledby="ck-title">
        <h2 id="ck-title" className={ui.secN}>
          Checklist antes de entrar
        </h2>
        {checklist.length ? (
          <>
            <ul className={styles.list}>
              {checklist.map((c) => (
                <li key={c}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked.includes(c)}
                      onChange={(e) => setChecked((x) => (e.target.checked ? [...x, c] : x.filter((y) => y !== c)))}
                    />
                    <span>{c}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className={allOk ? styles.okLine : 'muted'} aria-live="polite">
              {allOk ? 'Todo en orden. Entra con el tamaño calculado y sin tocar el stop en contra.' : `${checked.length} de ${checklist.length}. Si falta algo, no entres: no operar también es cumplir.`}
            </p>
            <div className={ui.row}>
              <button type="button" className="btn btn-primary btn-sm" disabled={!allOk || pending} onClick={() => go(false)}>
                Registrar la operación
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => go(true)}>
                No entro: registrar «no realizada»
              </button>
            </div>
          </>
        ) : (
          <p className="muted">
            Tu checklist sale de tu plan. <Link href="/panel/diagnostico">Haz el diagnóstico</Link> para crearlo.
          </p>
        )}
      </section>
    </div>
  )
}
