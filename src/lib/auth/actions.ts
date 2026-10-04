'use server'

import { redirect } from 'next/navigation'
import { siteUrl } from '@/lib/env'
import { safeNext } from '@/lib/routes'
import { createClient } from '@/lib/supabase/server'
import {
  authErrorMessage,
  fieldErrorsOf,
  newPasswordSchema,
  resetSchema,
  signInSchema,
  signUpSchema,
  type FormState,
} from './schemas'

const NOT_CONFIGURED: FormState = {
  message: 'El acceso todavía no está activado en este entorno (faltan las claves de Supabase).',
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? '')

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const values = { email: str(fd, 'email') }
  const parsed = signInSchema.safeParse({ email: str(fd, 'email'), password: str(fd, 'password') })
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values }

  const supabase = await createClient()
  if (!supabase) return { ...NOT_CONFIGURED, values }
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { message: authErrorMessage(error.message), values }

  redirect(safeNext(str(fd, 'next')))
}

export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  const values = { name: str(fd, 'name'), email: str(fd, 'email') }
  const parsed = signUpSchema.safeParse({
    name: str(fd, 'name'),
    email: str(fd, 'email'),
    password: str(fd, 'password'),
    accept: fd.get('accept') ?? undefined,
  })
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values }

  const supabase = await createClient()
  if (!supabase) return { ...NOT_CONFIGURED, values }
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/panel/diagnostico`,
      data: { display_name: parsed.data.name, disclaimer_accepted_at: new Date().toISOString() },
    },
  })
  if (error) return { message: authErrorMessage(error.message), values }

  // Con confirmación de email desactivada, Supabase ya devuelve sesión.
  if (data.session) redirect('/panel/diagnostico')
  return {
    ok: true,
    message: `Te hemos enviado un enlace a ${parsed.data.email}. Ábrelo para activar tu cuenta.`,
  }
}

export async function requestPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  const values = { email: str(fd, 'email') }
  const parsed = resetSchema.safeParse(values)
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values }

  const supabase = await createClient()
  if (!supabase) return { ...NOT_CONFIGURED, values }
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/nueva-contrasena`,
  })
  if (error && /rate limit|too many/i.test(error.message)) return { message: authErrorMessage(error.message), values }

  // Mismo mensaje exista o no la cuenta, para no revelar qué emails están registrados.
  return { ok: true, message: 'Si hay una cuenta con ese email, te llegará un enlace para crear una nueva contraseña.' }
}

export async function updatePassword(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({ password: str(fd, 'password'), confirm: str(fd, 'confirm') })
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) }

  const supabase = await createClient()
  if (!supabase) return NOT_CONFIGURED
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { message: authErrorMessage(error.message) }

  redirect('/panel')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase?.auth.signOut()
  redirect('/')
}
