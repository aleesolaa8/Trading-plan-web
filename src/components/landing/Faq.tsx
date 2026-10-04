'use client'

import { useState } from 'react'
import type { FaqGroup } from '@/content/faq'
import styles from './landing.module.css'

export function Faq({ groups }: { groups: FaqGroup[] }) {
  const [filter, setFilter] = useState<string>('all')
  return (
    <>
      <div className={styles.faqFilter} role="group" aria-label="Filtrar preguntas">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          Todas
        </button>
        {groups.map((g) => (
          <button key={g.id} type="button" aria-pressed={filter === g.id} onClick={() => setFilter(g.id)}>
            {g.title}
          </button>
        ))}
      </div>
      <div className={styles.faqGroups}>
        {groups
          .filter((g) => filter === 'all' || g.id === filter)
          .map((g) => (
            <div key={g.id}>
              <h3 className={styles.faqH}>{g.title}</h3>
              <div className={styles.faq}>
                {g.items.map((it) => (
                  <details key={it.q}>
                    <summary>{it.q}</summary>
                    <p>{it.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
      </div>
    </>
  )
}
