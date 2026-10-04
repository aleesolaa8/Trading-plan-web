'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Field, FormMessage, Submit } from '@/components/auth/FormParts'
import { signIn } from '@/lib/auth/actions'
import type { FormState } from '@/lib/auth/schemas'
import styles from '../auth.module.css'

export function LoginForm({ next, linkError }: { next?: string; linkError: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(signIn, {})
  return (
    <section className={styles.card} aria-labelledby="login-title">
      <div className={styles.head}>
        <span className="eyebrow">
          <span className="dot" />
          Bienvenido de nuevo
        </span>
        <h1 id="login-title">
          Es <span className="hl">hora</span> de entrar.
        </h1>
      </div>
      {linkError && (
        <p className="notice notice-error" role="alert">
          El enlace ha caducado o ya se usó. Entra con tu contraseña o pide uno nuevo.
        </p>
      )}
      <form action={action} className={styles.form} noValidate>
        <input type="hidden" name="next" value={next ?? ''} />
        <Field name="email" label="Email" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} autoFocus />
        <Field name="password" label="Contraseña" type="password" autoComplete="current-password" error={state.fieldErrors?.password} />
        <div className={styles.row}>
          <Link href="/recuperar" className={styles.inline}>
            He olvidado mi contraseña
          </Link>
        </div>
        <FormMessage message={state.message} ok={state.ok} />
        <Submit pending="Entrando…">Entrar</Submit>
      </form>
      <p className={styles.alt}>
        ¿Aún no tienes cuenta? <Link href="/registro">Crea tu plan</Link>
      </p>
    </section>
  )
}
