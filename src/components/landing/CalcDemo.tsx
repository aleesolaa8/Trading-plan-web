'use client'

import { useState } from 'react'
import styles from './landing.module.css'

const num = (v: string) => Number(v.replace(',', '.'))
const fmt = (n: number, d = 2) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
const DEMO_PLAN_RISK = 1 // Límite de ejemplo; en la app sale del plan del usuario

export function CalcDemo() {
  const [v, setV] = useState({ market: 'XAUUSD · Oro', bal: '10000', risk: '0,5', sl: '40', vpp: '1', min: '0,01', step: '0,01' })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }))
  const [bal, risk, sl, vpp, min, step] = [v.bal, v.risk, v.sl, v.vpp, v.min, v.step].map(num) as number[]
  const valid = [bal, risk, sl, vpp, min, step].every((x) => x! > 0)
  const dec = Math.min(4, (v.step.split(/[.,]/)[1] ?? '').length)
  const lots = valid ? Math.floor((bal! * risk!) / 100 / (sl! * vpp!) / step! + 1e-9) * step! : 0
  const real = lots * sl! * vpp!
  const warns: [string, string][] = []
  if (!valid) warns.push(['', 'Completa todos los campos con valores positivos.'])
  else {
    if (risk! > DEMO_PLAN_RISK) warns.push(['red', `Este riesgo (${fmt(risk!, 1)} %) supera el límite de tu plan (${fmt(DEMO_PLAN_RISK, 1)} %).`])
    if (lots < min!) warns.push(['', `El tamaño no alcanza el lote mínimo (${v.min}). Con este stop no puedes respetar tu riesgo.`])
  }
  return (
    <div className={styles.demo}>
      <form className={styles.calc} onSubmit={(e) => e.preventDefault()}>
        <label className={styles.full}>
          Mercado
          <select value={v.market} onChange={set('market')}>
            {['XAUUSD · Oro', 'US100 · Nasdaq', 'EURUSD', 'GER40 · DAX', 'BTCUSD', 'Otro mercado…'].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Capital (€)
          <input inputMode="decimal" value={v.bal} onChange={set('bal')} />
        </label>
        <label>
          Riesgo %
          <input inputMode="decimal" value={v.risk} onChange={set('risk')} />
        </label>
        <label>
          Stop (puntos/pips)
          <input inputMode="decimal" value={v.sl} onChange={set('sl')} />
        </label>
        <label>
          € por punto (1 lote)
          <input inputMode="decimal" value={v.vpp} onChange={set('vpp')} />
        </label>
        <label>
          Lote mínimo
          <input inputMode="decimal" value={v.min} onChange={set('min')} />
        </label>
        <label>
          Paso de lote
          <input inputMode="decimal" value={v.step} onChange={set('step')} />
        </label>
        <div className={styles.result} aria-live="polite">
          <div>
            <small>Tamaño</small>
            <strong>{!valid ? '—' : lots < min! ? '0 lotes' : `${fmt(lots, dec)} lotes`}</strong>
          </div>
          <div style={{ textAlign: 'right' }}>
            <small>Riesgo real</small>
            <b>{valid && lots >= min! ? `${fmt(real)} € · ${fmt((real / bal!) * 100)} %` : '—'}</b>
          </div>
        </div>
        {warns.length > 0 && (
          <div className={styles.warns}>
            {warns.map(([c, t]) => (
              <p key={t} className={`notice ${c === 'red' ? 'notice-error' : 'notice-warn'}`}>
                {t}
              </p>
            ))}
          </div>
        )}
      </form>
      <p className={styles.note}>Valores de ejemplo. Usa los de tu bróker: cambian entre cuentas.</p>
    </div>
  )
}
