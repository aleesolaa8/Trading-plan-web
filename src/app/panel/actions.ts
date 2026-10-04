'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { friendlyDbError } from '@/lib/db-errors'
import { normalizeMarket } from '@/lib/domain/markets'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

/* Acciones compartidas por varias páginas del panel (cuentas, mercados y perfil). */

export type Result = { ok: boolean; message?: string; id?: string }

async function session() {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()])
  return user && supabase ? { user, supabase } : null
}

const dec = (msg: string) =>
  z.preprocess(
    (v) => (v === '' || v == null ? undefined : typeof v === 'string' ? Number(v.replace(',', '.')) : v),
    z.number({ error: msg }).positive(msg).optional(),
  )

const accountSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1, 'Ponle un nombre.').max(40, 'Máximo 40 caracteres.'),
    kind: z.enum(['personal', 'fondeo', 'demo']),
    balance: dec('El saldo debe ser un número positivo.'),
    currency: z.string().trim().toUpperCase().length(3, 'Moneda de 3 letras (EUR, USD…).'),
    initial: dec('El capital inicial debe ser positivo.'),
    daily: dec('La pérdida diaria debe ser un % positivo.').pipe(z.number().max(100).optional()),
    drawdown: dec('La caída máxima debe ser un % positivo.').pipe(z.number().max(100).optional()),
    target: dec('El objetivo debe ser un % positivo.'),
  })
  .refine((a) => a.kind !== 'fondeo' || a.initial, { path: ['initial'], message: 'Indica el capital inicial de la prueba.' })

export async function saveAccount(input: unknown): Promise<Result> {
  const s = await session()
  if (!s) return { ok: false, message: 'Tu sesión ha caducado.' }
  const p = accountSchema.safeParse(input)
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message }
  const a = p.data
  const funded = a.kind === 'fondeo'
  const row = {
    user_id: s.user.id,
    name: a.name,
    kind: a.kind,
    balance: a.balance ?? null,
    currency: a.currency,
    initial_balance: funded ? (a.initial ?? null) : (a.initial ?? a.balance ?? null),
    daily_loss_pct: funded ? (a.daily ?? null) : null,
    max_drawdown_pct: funded ? (a.drawdown ?? null) : null,
    profit_target_pct: funded ? (a.target ?? null) : null,
  }
  const q = a.id
    ? s.supabase.from('trading_accounts').update(row).eq('id', a.id).eq('user_id', s.user.id).select('id').single()
    : s.supabase.from('trading_accounts').insert(row).select('id').single()
  const { data, error } = await q
  if (error) return { ok: false, message: friendlyDbError(error, 'No se ha podido guardar la cuenta.') }
  revalidatePath('/panel', 'layout')
  return { ok: true, id: data.id }
}

export async function setAccountArchived(id: string, archived: boolean): Promise<Result> {
  const s = await session()
  if (!s || !z.uuid().safeParse(id).success) return { ok: false, message: 'Cuenta no válida.' }
  if (archived) {
    const { count } = await s.supabase
      .from('trading_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', s.user.id)
      .eq('is_archived', false)
    if ((count ?? 0) <= 1) return { ok: false, message: 'Necesitas al menos una cuenta activa.' }
  }
  const { error } = await s.supabase.from('trading_accounts').update({ is_archived: archived }).eq('id', id).eq('user_id', s.user.id)
  if (error) return { ok: false, message: friendlyDbError(error, 'No se ha podido cambiar la cuenta.') }
  revalidatePath('/panel', 'layout')
  return { ok: true }
}

const assetSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().transform(normalizeMarket).pipe(z.string().min(1, 'Escribe el nombre del mercado.')),
  valuePerPoint: dec('Valor por punto no válido.').pipe(z.number({ error: 'Indica el valor por punto.' })),
  minLot: dec('Lote mínimo no válido.').pipe(z.number({ error: 'Indica el lote mínimo.' })),
  lotStep: dec('Paso de lote no válido.').pipe(z.number({ error: 'Indica el paso de lote.' })),
  currency: z.string().trim().toUpperCase().length(3).default('EUR'),
})

export async function saveAsset(input: unknown): Promise<Result> {
  const s = await session()
  if (!s) return { ok: false, message: 'Tu sesión ha caducado.' }
  const p = assetSchema.safeParse(input)
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message }
  const a = p.data
  const row = { user_id: s.user.id, name: a.name, value_per_point: a.valuePerPoint, min_lot: a.minLot, lot_step: a.lotStep, currency: a.currency }
  const { data, error } = a.id
    ? await s.supabase.from('assets').update(row).eq('id', a.id).eq('user_id', s.user.id).select('id').single()
    : await s.supabase.from('assets').upsert(row, { onConflict: 'user_id,name' }).select('id').single()
  if (error) return { ok: false, message: 'No se han podido guardar los datos del mercado.' }
  revalidatePath('/panel/calculadora')
  revalidatePath('/panel/ajustes')
  return { ok: true, id: data.id }
}

export async function deleteAsset(id: string): Promise<Result> {
  const s = await session()
  if (!s || !z.uuid().safeParse(id).success) return { ok: false }
  const { error } = await s.supabase.from('assets').delete().eq('id', id).eq('user_id', s.user.id)
  if (error) return { ok: false, message: 'No se ha podido borrar.' }
  revalidatePath('/panel/calculadora')
  revalidatePath('/panel/ajustes')
  return { ok: true }
}

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Escribe tu nombre.').max(40, 'Máximo 40 caracteres.'),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat('es-ES', { timeZone: tz })
      return true
    } catch {
      return false
    }
  }, 'Zona horaria no válida.'),
})

export async function updateProfile(input: unknown): Promise<Result> {
  const s = await session()
  if (!s) return { ok: false, message: 'Tu sesión ha caducado.' }
  const p = profileSchema.safeParse(input)
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message }
  const { error } = await s.supabase.from('profiles').update({ display_name: p.data.name, timezone: p.data.timezone }).eq('id', s.user.id)
  if (error) return { ok: false, message: 'No se ha podido guardar.' }
  revalidatePath('/panel', 'layout')
  return { ok: true }
}
