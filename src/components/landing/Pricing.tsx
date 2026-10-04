'use client'

import { useState } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import type { PlanTier } from '@/lib/content'
import { eur, TIER_FOR, tierBullets } from '@/lib/plan-copy'
import styles from './landing.module.css'

export function Pricing({ plans }: { plans: PlanTier[] }) {
  const [annual, setAnnual] = useState(false)
  const free = plans.find((p) => p.id === 'free')
  const core = plans.find((p) => p.id === 'core')
  const pro = plans.find((p) => p.id === 'pro')
  const trial = pro?.trialDays ?? 7

  const price = (p?: PlanTier) => {
    if (!p) return { main: '—', unit: '', sub: 'Precio disponible muy pronto' }
    if (annual && p.annual != null)
      return { main: eur(p.annual), unit: '+ IVA / año', sub: `Equivale a ${eur(Math.round((p.annual / 12) * 100) / 100)} al mes` }
    return { main: p.monthly != null ? eur(p.monthly) : '—', unit: '+ IVA / mes', sub: 'Sin permanencia' }
  }
  const hasAnnual = plans.some((p) => p.annual)

  const card = (p: PlanTier | undefined, id: 'free' | 'core' | 'pro') => {
    const b = tierBullets(id, p?.features ?? {})
    const pr = id === 'free' ? { main: '0 €', unit: 'para siempre', sub: 'Sin tarjeta' } : price(p)
    return (
      <article key={id} className={`card ${styles.plan} ${id === 'pro' ? styles.pro : ''}`}>
        <div className={styles.planTop}>
          <span className="chip">{p?.name ?? id}</span>
          {id === 'core' && <span className="chip chip-amber">El más elegido</span>}
          {id === 'pro' && <span className="chip chip-blue">El más completo</span>}
        </div>
        <p className={styles.planFor}>{TIER_FOR[id]}</p>
        <div className={styles.price}>
          <strong>{pr.main}</strong>
          <span className="muted">{pr.unit}</span>
        </div>
        <p className={styles.priceSub}>{pr.sub}</p>
        {b.lead && <p className={styles.plus}>{b.lead}</p>}
        <ul className="arrows">
          {b.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        {id === 'free' && (
          <ButtonLink href="/registro" variant="ghost" size="xl" arrow>
            Empezar gratis
          </ButtonLink>
        )}
        {id === 'core' && (
          <ButtonLink href="/registro?plan=core" variant="ghost" size="xl" arrow>
            Empezar con Core
          </ButtonLink>
        )}
        {id === 'pro' && (
          <ButtonLink href="/registro?plan=pro" size="xl" arrow>
            Probar Pro {trial} días gratis
          </ButtonLink>
        )}
      </article>
    )
  }

  return (
    <>
      {hasAnnual && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div className={styles.billing} role="group" aria-label="Forma de pago">
            <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>
              Mensual
            </button>
            <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>
              Anual <span className={styles.save}>2 meses gratis</span>
            </button>
          </div>
        </div>
      )}
      <div className={styles.plans}>
        {card(free, 'free')}
        {card(core, 'core')}
        {card(pro, 'pro')}
      </div>
      <p className={styles.plansNote}>
        Al registrarte tienes {trial} días con todo Pro incluido y sin tarjeta. Después sigues gratis en Free hasta que
        elijas un plan. Pagas con tarjeta, PayPal, Apple Pay o Google Pay. El IVA se calcula en el pago según tu país.
      </p>
    </>
  )
}
