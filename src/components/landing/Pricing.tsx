'use client'

import { useState } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import type { PlanTier } from '@/lib/content'
import styles from './landing.module.css'

const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export function Pricing({ plans }: { plans: PlanTier[] }) {
  const [annual, setAnnual] = useState(false)
  const core = plans.find((p) => p.id === 'core')
  const pro = plans.find((p) => p.id === 'pro')
  const trial = pro?.trialDays ?? core?.trialDays ?? 7
  const coreMsgs = Number(core?.features.copilot_messages_per_month ?? 0)
  const proAccounts = Number(pro?.features.max_accounts ?? 3)

  const price = (p?: PlanTier) => {
    if (!p) return { main: '—', unit: '', sub: 'Precio disponible muy pronto' }
    if (annual && p.annual != null)
      return { main: eur(p.annual), unit: '+ IVA / año', sub: `Equivale a ${eur(Math.round((p.annual / 12) * 100) / 100)} al mes` }
    return { main: p.monthly != null ? eur(p.monthly) : '—', unit: '+ IVA / mes', sub: 'Sin permanencia' }
  }
  const c = price(core)
  const pr = price(pro)
  const hasAnnual = plans.some((p) => p.annual != null)

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
        <article className={`card ${styles.plan}`}>
          <span className="chip">Core</span>
          <p className={styles.planFor}>Para operar con un plan y cumplirlo</p>
          <div className={styles.price}>
            <strong>{c.main}</strong>
            <span className="muted">{c.unit}</span>
          </div>
          <p className={styles.priceSub}>{c.sub}</p>
          <ul className="arrows">
            <li>Diagnóstico de 7 preguntas y plan con tus reglas</li>
            <li>Protocolos de conducta editables</li>
            <li>Calendario semanal: trading y vida</li>
            <li>Calculadora de riesgo para cualquier mercado</li>
            <li>Checklist antes de cada entrada</li>
            <li>Journal ilimitado con patrones sin juicio</li>
            <li>Resumen semanal de tus números</li>
            <li>Recordatorios de sesión y de límite diario</li>
            {coreMsgs > 0 && <li>Copiloto con IA: {coreMsgs} mensajes al mes</li>}
            <li>Exporta tus datos cuando quieras (CSV)</li>
          </ul>
          <ButtonLink href="/registro?plan=core" variant="ghost" size="xl" arrow>
            Empezar con Core
          </ButtonLink>
        </article>
        <article className={`card ${styles.plan} ${styles.pro}`}>
          <div className={styles.planTop}>
            <span className="chip">Pro</span>
            <span className="chip chip-blue">El más completo</span>
          </div>
          <p className={styles.planFor}>Para quien opera muchas horas, con fondeo o con varias cuentas</p>
          <div className={styles.price}>
            <strong>{pr.main}</strong>
            <span className="muted">{pr.unit}</span>
          </div>
          <p className={styles.priceSub}>{pr.sub}</p>
          <p className={styles.plus}>Todo lo de Core, y además:</p>
          <ul className="arrows">
            <li>
              <b>Copiloto 24 h sin límite</b>: habla con él cuando lo necesites
            </li>
            <li>Revisión semanal escrita por IA con propuestas para tu plan</li>
            <li>La IA revisa tus capturas y las compara con tu setup escrito</li>
            <li>Estadísticas avanzadas: por mercado, hora, día y emoción</li>
            <li>
              <b>Hasta {proAccounts} cuentas</b> (personal, fondeo, demo) con resumen conjunto
            </li>
            <li>Modo fondeo: límite diario y caída máxima con avisos</li>
            <li>Informe mensual en PDF de tu progreso</li>
          </ul>
          <ButtonLink href="/registro?plan=pro" size="xl" arrow>
            Probar Pro {trial} días gratis
          </ButtonLink>
        </article>
      </div>
      <p className={styles.plansNote}>
        Prueba de {trial} días con todo Pro incluido y sin tarjeta. Al terminar eliges plan; si no eliges, no se cobra
        nada. El IVA se calcula en el pago según tu país.
      </p>
    </>
  )
}
