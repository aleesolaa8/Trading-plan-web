'use client'

import { useActionState } from 'react'
import { Field, FormMessage, Submit } from '@/components/auth/FormParts'
import { updatePassword } from '@/lib/auth/actions'
import type { FormState } from '@/lib/auth/schemas'
import styles from '../auth.module.css'

export default function NewPasswordPage() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {})
  return (
    <section className={styles.card} aria-labelledby="np-title">
      <div className={styles.head}>
        <span className="eyebrow">
          <span className="dot" />
          Último paso
        </span>
        <h1 id="np-title">
          Elige tu nueva <span className="hl">contraseña</span>.
        </h1>
      </div>
      <form action={action} className={styles.form} noValidate>
        <Field name="password" label="Nueva contraseña" type="password" autoComplete="new-password" hint="Mínimo 8 caracteres." error={state.fieldErrors?.password} autoFocus />
        <Field name="confirm" label="Repítela" type="password" autoComplete="new-password" error={state.fieldErrors?.confirm} />
        <FormMessage message={state.message} ok={state.ok} />
        <Submit pending="Guardando…">Guardar y entrar</Submit>
      </form>
    </section>
  )
}
