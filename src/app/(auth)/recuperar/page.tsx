'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Field, FormMessage, Submit } from '@/components/auth/FormParts'
import { requestPasswordReset } from '@/lib/auth/actions'
import type { FormState } from '@/lib/auth/schemas'
import styles from '../auth.module.css'

export default function RecoverPage() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {})
  return (
    <section className={styles.card} aria-labelledby="rec-title">
      <div className={styles.head}>
        <span className="eyebrow">
          <span className="dot" />
          Recuperar acceso
        </span>
        <h1 id="rec-title">
          Nueva <span className="hl">contraseña</span>.
        </h1>
        <p className="muted">Te enviaremos un enlace para crear una contraseña nueva.</p>
      </div>
      <form action={action} className={styles.form} noValidate>
        <Field name="email" label="Email" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} autoFocus />
        <FormMessage message={state.message} ok={state.ok} />
        <Submit pending="Enviando…">Enviar enlace</Submit>
      </form>
      <p className={styles.alt}>
        <Link href="/login">Volver a entrar</Link>
      </p>
    </section>
  )
}
