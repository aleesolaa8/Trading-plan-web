'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'

type FieldProps = {
  name: string
  label: string
  type?: string
  autoComplete?: string
  defaultValue?: string
  error?: string
  hint?: string
  autoFocus?: boolean
}

export function Field({ name, label, type = 'text', autoComplete, defaultValue, error, hint, autoFocus }: FieldProps) {
  const id = `f-${name}`
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        className="input"
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        autoFocus={autoFocus}
      />
      {hint && !error && (
        <span id={`${id}-hint`} className="muted" style={{ fontSize: 13 }}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-err`} className="field-error">
          {error}
        </span>
      )}
    </div>
  )
}

export function Submit({ children, pending: pendingLabel }: { children: React.ReactNode; pending: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="xl" block arrow={!pending} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </Button>
  )
}

export function FormMessage({ ok, message }: { ok?: boolean; message?: string }) {
  if (!message) return null
  return (
    <p role={ok ? 'status' : 'alert'} className={`notice ${ok ? 'notice-ok' : 'notice-error'}`}>
      {message}
    </p>
  )
}
