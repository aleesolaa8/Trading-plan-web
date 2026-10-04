import styles from './Ticker.module.css'

const DEFAULT_ITEMS = [
  'Plan escrito',
  'Riesgo fijo',
  'Journal honesto',
  'Pausa tras pérdida',
  'Hora de desconexión',
  'Revisión semanal',
  'Sueño y rutina',
  'Sin señales',
]

/** Cinta en bucle de derecha a izquierda. Contenido duplicado y translateX(-50%). */
export function Ticker({ items = DEFAULT_ITEMS, label = 'Lo que trabaja tu plan' }: { items?: string[]; label?: string }) {
  const group = (hidden: boolean) => (
    <div className={styles.group} aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <span key={item} className={styles.item}>
          {item}
          <span className="dot" />
        </span>
      ))}
    </div>
  )
  return (
    <div className={styles.ticker} role="region" aria-label={label}>
      <div className={styles.track}>
        {group(false)}
        {group(true)}
      </div>
    </div>
  )
}
