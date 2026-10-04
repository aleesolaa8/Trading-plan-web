'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import type { MyProtocol } from '@/lib/content'
import { addProtocol, deleteProtocol, toggleProtocol } from './actions'
import styles from './plan.module.css'

const CATEGORY: Record<string, string> = {
  trading: 'Trading', riesgo: 'Riesgo', emociones: 'Emociones', sueno: 'Sueño', rutina: 'Rutina',
  comida: 'Comida', ejercicio: 'Ejercicio', pausas: 'Pausas', desconexion: 'Desconexión', otro: 'Propio',
}

export function Checklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false))
  const all = checked.every(Boolean)
  return (
    <>
      <ul className={styles.checklist}>
        {items.map((t, i) => (
          <li key={t}>
            <label>
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
              />
              <span>{t}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className={all ? styles.okLine : 'muted'} aria-live="polite" style={{ fontSize: 14 }}>
        {all
          ? 'Todo en orden. Si la entrada es la de tu setup, adelante con tu tamaño calculado.'
          : 'Marca todo antes de entrar. Si algo no se cumple, la operación no se hace.'}
      </p>
    </>
  )
}

export function Protocols({ protocols }: { protocols: MyProtocol[] }) {
  const [list, setOptimistic] = useOptimistic(protocols, (state, p: { id: string; active: boolean }) =>
    state.map((x) => (x.id === p.id ? { ...x, active: p.active } : x)),
  )
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState('')
  const [body, setBody] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)

  const toggle = (p: MyProtocol) =>
    start(async () => {
      setOptimistic({ id: p.id, active: !p.active })
      const r = await toggleProtocol(p.id, !p.active)
      if (!r.ok) setError(r.message ?? 'No se ha podido guardar.')
    })

  const add = () =>
    start(async () => {
      setError(null)
      const r = await addProtocol({ trigger, body })
      if (!r.ok) return setError(r.message ?? 'No se ha podido guardar.')
      setTrigger('')
      setBody('')
    })

  const remove = (id: string) => {
    if (confirm !== id) return setConfirm(id)
    start(async () => {
      await deleteProtocol(id)
      setConfirm(null)
    })
  }

  return (
    <>
      <div className={styles.protos}>
        {list.map((p) => (
          <div key={p.id} className={`${styles.proto} ${p.active ? '' : styles.off}`}>
            <div>
              <small>
                {CATEGORY[p.category] ?? 'Protocolo'}
                {p.trigger ? ` · ${p.trigger}` : ''}
              </small>
              <h3>{p.title}</h3>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={p.active}
              aria-label={`${p.active ? 'Desactivar' : 'Activar'} ${p.title}`}
              className={styles.switch}
              onClick={() => toggle(p)}
            />
            <p>{p.body}</p>
            {p.own && (
              <button type="button" className={styles.del} onClick={() => remove(p.id)}>
                {confirm === p.id ? '¿Seguro? Pulsa otra vez' : 'Eliminar'}
              </button>
            )}
          </div>
        ))}
      </div>
      <details className={styles.addBox}>
        <summary>+ Añadir un protocolo propio</summary>
        <div className={styles.addGrid}>
          <div className="field">
            <label htmlFor="p-when" className="field-label">
              Cuándo
            </label>
            <input id="p-when" className="input" maxLength={80} placeholder="Ej.: Si llevo dos ganadoras seguidas" value={trigger} onChange={(e) => setTrigger(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="p-what" className="field-label">
              Qué hago
            </label>
            <input id="p-what" className="input" maxLength={240} placeholder="Ej.: Termino la sesión y lo celebro lejos de la pantalla" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="ghost" size="sm" onClick={add} disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar protocolo'}
          </Button>
        </div>
      </details>
    </>
  )
}
