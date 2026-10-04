import { z } from 'zod'

const email = z.string().trim().toLowerCase().email('Escribe un email válido.')
const password = z
  .string()
  .min(8, 'La contraseña necesita al menos 8 caracteres.')
  .max(72, 'La contraseña puede tener como máximo 72 caracteres.')

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

export const signUpSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre (mínimo 2 letras).').max(60, 'El nombre es demasiado largo.'),
  email,
  password,
  accept: z.literal('on', { error: 'Necesitamos que leas y aceptes el aviso de riesgo para continuar.' }),
})

export const resetSchema = z.object({ email })

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden.' })

export type FormState = {
  ok?: boolean
  message?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
}

/** Primer error de cada campo, listo para pintar bajo el input. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] ??= issue.message
  }
  return out
}

/** Traduce los errores de Supabase Auth a mensajes claros en español. */
export function authErrorMessage(message: string | undefined): string {
  const m = (message ?? '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Confirma tu email con el enlace que te enviamos antes de entrar.'
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Ya existe una cuenta con este email. Prueba a entrar o recupera tu contraseña.'
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.'
  if (m.includes('weak') || m.includes('password should'))
    return 'Esa contraseña es demasiado fácil de adivinar. Prueba con otra más larga.'
  if (m.includes('same password')) return 'La nueva contraseña debe ser distinta de la anterior.'
  return 'No hemos podido completar la acción. Inténtalo de nuevo en unos segundos.'
}
