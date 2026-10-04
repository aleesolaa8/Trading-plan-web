import styles from './StatsBand.module.css'

export type Stat = { value: string; label: string }

/** Franja con degradado y 4 cifras. Solo cifras reales del producto, nunca valoraciones inventadas. */
export function StatsBand({ stats, label = 'El producto en cifras' }: { stats: Stat[]; label?: string }) {
  return (
    <div className={`wrap ${styles.band}`} role="region" aria-label={label}>
      {stats.map((s) => (
        <div key={s.label} className={styles.stat}>
          <strong>{s.value}</strong>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  )
}
