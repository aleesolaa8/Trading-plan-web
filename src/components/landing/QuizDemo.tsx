'use client'

import { useState } from 'react'
import type { QuizQuestion } from '@/lib/content'
import styles from './landing.module.css'

/** Una pregunta real del diagnóstico (leída de la base de datos) para probarlo desde la portada. */
export function QuizDemo({ question, index, total }: { question: QuizQuestion; index: number; total: number }) {
  const [chosen, setChosen] = useState<string | null>(null)
  const opt = question.options.find((o) => o.id === chosen)
  return (
    <div className={styles.quiz}>
      <div className="card">
        <div className={styles.qProgress} aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={i <= index ? styles.on : ''} />
          ))}
        </div>
        <span className="eyebrow">
          Pregunta {index + 1} de {total}
          {question.eyebrow ? ` · ${question.eyebrow}` : ''}
        </span>
        <p className={styles.qTitle} id="demo-q">
          {question.prompt}
        </p>
        <div className={styles.opts} role="radiogroup" aria-labelledby="demo-q">
          {question.options.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={o.id === chosen} className={styles.opt} onClick={() => setChosen(o.id)}>
              <span className={styles.radio} aria-hidden="true" />
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className={`${styles.explain} ${opt ? styles.explainOn : ''}`} aria-live="polite">
        <div className={`${styles.tip} ${styles.why}`}>
          <h3>Por qué puede pasar</h3>
          <p>{opt?.why ?? 'Elige una opción para ver la explicación.'}</p>
        </div>
        <div className={`${styles.tip} ${styles.planTip}`}>
          <h3>Cómo lo trabaja tu plan</h3>
          <p>{opt?.plan ?? 'Cada respuesta se convierte en algo concreto dentro de tu plan.'}</p>
        </div>
        <div className={styles.proto}>
          <span className="chip chip-blue">Protocolo</span>
          <div>
            <b>{opt?.protocol?.title ?? '—'}</b>
            <span className="muted" style={{ fontSize: 13 }}>
              Se añade a tu plan. Puedes editarlo o crear los tuyos.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
