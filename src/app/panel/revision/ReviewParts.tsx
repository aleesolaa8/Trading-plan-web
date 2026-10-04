'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import ui from '@/components/app/ui.module.css'
import { adoptImprovement, generateReview, saveNotes } from './actions'

export function GenerateButton({ week, again, left }: { week: string; again: boolean; left: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className={ui.row}>
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending || left <= 0}
        onClick={() =>
          start(async () => {
            const r = await generateReview(week)
            if (!r.ok) setMsg(r.message ?? 'No se ha podido escribir la revisión.')
            else router.refresh()
          })
        }
      >
        {pending ? 'Escribiendo tu revisión… (unos segundos)' : again ? 'Volver a escribir con IA' : 'Escribir mi revisión con IA'}
      </button>
      <small className="muted">
        {left > 0 ? `Te quedan ${left} revisiones con IA este mes.` : 'Has usado tus revisiones con IA de este mes.'}
      </small>
      {msg && (
        <p className="notice notice-error" role="alert" style={{ width: '100%' }}>
          {msg}
        </p>
      )}
    </div>
  )
}

export function AdoptButton({ week }: { week: string }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className={ui.row}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={pending || Boolean(msg)}
        onClick={() =>
          start(async () => {
            const r = await adoptImprovement(week)
            setMsg(r.message ?? (r.ok ? 'Hecho.' : 'No se ha podido.'))
          })
        }
      >
        Añadir como protocolo
      </button>
      {msg && <span className="muted">{msg}</span>}
    </div>
  )
}

export function NotesForm({ week, initial }: { week: string; initial: string }) {
  const [text, setText] = useState(initial)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  return (
    <form
      style={{ display: 'grid', gap: 10 }}
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await saveNotes(week, text)
          setMsg({ ok: r.ok, t: r.ok ? 'Notas guardadas.' : (r.message ?? 'No se han podido guardar.') })
        })
      }}
    >
      <label className="field">
        <span className="field-label">Tus notas de la semana</span>
        <textarea
          className="input"
          rows={5}
          maxLength={3000}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setMsg(null)
          }}
          placeholder="Qué te llevas de esta semana, qué vas a cambiar y cómo te has sentido."
        />
      </label>
      <div className={ui.row}>
        <button type="submit" className="btn btn-ghost btn-sm" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar notas'}
        </button>
        {msg && <span className={msg.ok ? 'muted' : ''}>{msg.t}</span>}
      </div>
    </form>
  )
}

export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
      Descargar PDF
    </button>
  )
}
