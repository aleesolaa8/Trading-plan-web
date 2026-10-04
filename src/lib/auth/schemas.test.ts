import { describe, expect, it } from 'vitest'
import { authErrorMessage, fieldErrorsOf, newPasswordSchema, signUpSchema } from './schemas'
import { safeNext } from '@/lib/routes'

describe('registro', () => {
  const valid = { name: 'Ana', email: ' Ana@Mail.com ', password: '12345678', accept: 'on' }

  it('acepta datos válidos y normaliza el email', () => {
    const r = signUpSchema.safeParse(valid)
    expect(r.success && r.data.email).toBe('ana@mail.com')
  })

  it('exige aceptar el aviso de riesgo', () => {
    const r = signUpSchema.safeParse({ ...valid, accept: undefined })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrorsOf(r.error).accept).toMatch(/aviso de riesgo/)
  })

  it('pide contraseñas de 8 caracteres o más', () => {
    const r = signUpSchema.safeParse({ ...valid, password: '123' })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrorsOf(r.error).password).toMatch(/8 caracteres/)
  })
})

describe('nueva contraseña', () => {
  it('detecta que no coinciden', () => {
    const r = newPasswordSchema.safeParse({ password: '12345678', confirm: '87654321' })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrorsOf(r.error).confirm).toBe('Las contraseñas no coinciden.')
  })
})

describe('mensajes de Supabase', () => {
  it('traduce credenciales incorrectas', () => {
    expect(authErrorMessage('Invalid login credentials')).toBe('Email o contraseña incorrectos.')
  })
  it('da un mensaje genérico para lo desconocido', () => {
    expect(authErrorMessage('boom')).toMatch(/Inténtalo de nuevo/)
  })
})

describe('safeNext', () => {
  it('permite rutas internas', () => expect(safeNext('/panel/journal')).toBe('/panel/journal'))
  it('bloquea dominios externos', () => {
    expect(safeNext('https://malo.com')).toBe('/panel')
    expect(safeNext('//malo.com')).toBe('/panel')
    expect(safeNext('/\\malo.com')).toBe('/panel')
  })
  it('usa el panel si no hay destino', () => expect(safeNext(null)).toBe('/panel'))
})
