'use client'

import { useState } from 'react'
import type { PlanTier } from '@/lib/content'
import { eur, TIER_FOR, tierBullets } from '@/lib/plan-copy'
import ui from '@/components/app/ui.module.css'
import styles from './ajustes.module.css'

/** Elegir plan de pago. Cada botón envía un formulario a /api/stripe/checkout (funciona sin JS). */
export function PlanPicker({ plans, current, subscribed }: { plans: PlanTier[]; current: string | null; subscribed: boolean }) {
  const [interval, setBilling] = useState<'month' | 'year'>('year')
  return (
    <div className={styles.picker}>
      <div className={ui.seg} role="group" aria-label="Forma de pago">
        <button type="button" aria-pressed={interval === 'month'} onClick={() => setBilling('month')}>
          Mensual
        </button>
        <button type="button" aria-pressed={interval === 'year'} onClick={() => setBilling('year')}>
          Anual · 2 meses gratis
        </button>
      </div>
      <div className={styles.tiers}>
        {plans
          .filter((p) => p.id !== 'free')
          .map((p) => {
            const id = p.id as 'core' | 'pro'
            const b = tierBullets(id, p.features)
            const amount = interval === 'year' ? p.annual : p.monthly
            const isCurrent = subscribed && current === id
            return (
              <form key={id} method="post" action="/api/stripe/checkout" className={`${styles.tier} ${id === 'pro' ? styles.tierPro : ''}`}>
                <input type="hidden" name="plan" value={id} />
                <input type="hidden" name="interval" value={interval} />
                <div className={ui.row}>
                  <span className="chip">{p.name}</span>
                  {isCurrent && <span className="chip chip-blue">Tu plan</span>}
                </div>
                <p className="muted">{TIER_FOR[id]}</p>
                <p className={styles.tierPrice}>
                  <b>{amount != null ? eur(amount) : '—'}</b> <span className="muted">+ IVA / {interval === 'year' ? 'año' : 'mes'}</span>
                </p>
                {interval === 'year' && p.annual != null && <small className={styles.equiv}>Equivale a {eur(Math.round((p.annual / 12) * 100) / 100)} al mes</small>}
                <ul className="arrows">
                  {b.items.slice(0, 5).map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                <button type="submit" className={`btn ${id === 'pro' ? 'btn-primary' : 'btn-ghost'} btn-block`} disabled={isCurrent}>
                  {isCurrent ? 'Plan actual' : subscribed ? `Cambiar a ${p.name}` : `Elegir ${p.name}`}
                  {!isCurrent && (
                    <span className="arr" aria-hidden="true">
                      →
                    </span>
                  )}
                </button>
              </form>
            )
          })}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Pago seguro con Stripe: tarjeta, PayPal, Apple Pay o Google Pay. Factura con IVA en cada pago. Sin permanencia: cancelas
        cuando quieras y mantienes el acceso hasta el final del periodo pagado.
      </p>
    </div>
  )
}
