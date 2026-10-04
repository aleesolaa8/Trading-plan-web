'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Field, FormMessage, Submit } from '@/components/auth/FormParts'
import { signUp } from '@/lib/auth/actions'
import type { FormState } from '@/lib/auth/schemas'
import styles from '../auth.module.css'

export function SignUpForm() {
  const [state, action] = useActionState<FormState, FormData>(signUp, {})

  if (state.ok) {
    return (
      <section className={styles.card} aria-labelledby="check-title">
        <div className={styles.head}>
          <span className="eyebrow">
            <span className="dot dot-green" />
            Casi listo
          </span>
          <h1 id="check-title">
            Revisa tu <span className="hl">correo</span>.
          </h1>
        </div>
        <FormMessage ok message={state.message} />
        <p className="muted">Si no lo ves en un par de minutos, mira en la carpeta de spam o promociones.</p>
      </section>
    )
  }

  return (
    <section className={styles.card} aria-labelledby="signup-title">
      <div className={styles.head}>
        <span className="eyebrow">
          <span className="dot" />
          Paso 1 de 2 · Tu cuenta
        </span>
        <h1 id="signup-title">
          Empieza tu <span className="hl-grad">plan</span>.
        </h1>
        <p className="muted">Después harás un diagnóstico de 6 preguntas para construirlo contigo.</p>
      </div>
      <form action={action} className={styles.form} noValidate>
        <Field name="name" label="Tu nombre" autoComplete="given-name" defaultValue={state.values?.name} error={state.fieldErrors?.name} autoFocus />
        <Field name="email" label="Email" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} />
        <Field name="password" label="Contraseña" type="password" autoComplete="new-password" hint="Mínimo 8 caracteres." error={state.fieldErrors?.password} />

        <div className={styles.risk}>
          <p>
            <strong>Antes de seguir.</strong> Time to Trade es una herramienta de planificación y registro. No es
            asesoramiento financiero y nunca te dirá qué comprar o vender. Los CFD conllevan un riesgo elevado de perder
            dinero rápidamente por el apalancamiento.
          </p>
          <label className="check">
            <input type="checkbox" name="accept" aria-invalid={state.fieldErrors?.accept ? true : undefined} aria-describedby={state.fieldErrors?.accept ? 'accept-err' : undefined} />
            <span>
              He leído y entiendo el <Link href="/legal/riesgo" target="_blank" className={styles.inline}>aviso de riesgo</Link>.
            </span>
          </label>
          {state.fieldErrors?.accept && (
            <span id="accept-err" className="field-error">
              {state.fieldErrors.accept}
            </span>
          )}
        </div>

        <FormMessage message={state.message} ok={state.ok} />
        <Submit pending="Creando tu cuenta…">Crear mi cuenta</Submit>
      </form>
      <p className={styles.alt}>
        ¿Ya tienes cuenta? <Link href="/login">Entra</Link>
      </p>
    </section>
  )
}
