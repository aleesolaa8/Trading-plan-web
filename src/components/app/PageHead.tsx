import styles from './PageHead.module.css'

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={styles.head}>
      <span className="eyebrow">
        <span className="dot" />
        {eyebrow}
      </span>
      <h1>{title}</h1>
      {children && <p className="lead">{children}</p>}
    </div>
  )
}

/** Estado vacío diseñado para secciones que llegan en pasos posteriores. */
export function ComingSoon({ step, what, items }: { step: number; what: string; items: string[] }) {
  return (
    <section className={`card ${styles.soon}`}>
      <span className="chip chip-blue">Llega en el paso {step}</span>
      <h2 className={styles.soonTitle}>{what}</h2>
      <ul className="arrows">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  )
}
