import { ButtonLink } from '@/components/ui/Button'
import styles from './ui.module.css'

/** Aviso para funciones de otro plan. Sin presión: explica qué aporta y enlaza a los planes. */
export function Locked({ plan, title, children }: { plan: 'Core' | 'Pro'; title: string; children: React.ReactNode }) {
  return (
    <div className={styles.locked}>
      <span className="chip chip-blue">Incluido en {plan === 'Core' ? 'Core y Pro' : 'Pro'}</span>
      <h3>{title}</h3>
      <p>{children}</p>
      <ButtonLink href="/panel/ajustes#plan" size="sm" variant="ghost" arrow>
        Ver planes
      </ButtonLink>
    </div>
  )
}
