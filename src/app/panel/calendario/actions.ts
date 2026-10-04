'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { BLOCK_TYPES, proposeWeek, rulesSchema, SCREEN_TYPES, type BlockType } from '@/lib/domain/plan'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

export type CalResult = { ok: boolean; message?: string; id?: string }

const hhmmss = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`

const blockSchema = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(1, 'Ponle un nombre al bloque.').max(60, 'Máximo 60 caracteres.'),
    type: z.enum(Object.keys(BLOCK_TYPES) as [BlockType, ...BlockType[]]),
    start: z.number().int().min(0).max(1435),
    duration: z.number().int().min(5, 'Mínimo 5 minutos.').max(1440),
    days: z.array(z.number().int().min(1).max(7)).min(1, 'Elige al menos un día.').max(7),
    notes: z.string().trim().max(300, 'Máximo 300 caracteres.').optional().nullable(),
  })
  .refine((b) => b.start + b.duration <= 1440, { path: ['duration'], message: 'El bloque no puede pasar de las 24:00.' })

async function session() {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()])
  return user && supabase ? { user, supabase } : null
}

export async function saveBlock(input: unknown): Promise<CalResult> {
  const s = await session()
  if (!s) return { ok: false, message: 'Tu sesión ha caducado.' }
  const p = blockSchema.safeParse(input)
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message }
  const b = p.data
  const row = {
    user_id: s.user.id,
    title: b.title,
    block_type: b.type,
    start_time: hhmmss(b.start),
    duration_min: b.duration,
    days_of_week: [...new Set(b.days)].sort(),
    is_screen: SCREEN_TYPES.has(b.type),
    notes: b.notes || null,
  }
  const { data, error } = b.id
    ? await s.supabase.from('calendar_blocks').update(row).eq('id', b.id).eq('user_id', s.user.id).select('id').single()
    : await s.supabase.from('calendar_blocks').insert(row).select('id').single()
  if (error) return { ok: false, message: 'No se ha podido guardar el bloque.' }
  revalidatePath('/panel', 'layout')
  return { ok: true, id: data.id }
}

export async function moveBlock(id: string, start: number, duration: number, days?: number[]): Promise<CalResult> {
  const s = await session()
  if (!s) return { ok: false, message: 'Tu sesión ha caducado.' }
  const p = z
    .object({ id: z.uuid(), start: z.number().int().min(0).max(1435), duration: z.number().int().min(5).max(1440), days: z.array(z.number().int().min(1).max(7)).min(1).optional() })
    .refine((x) => x.start + x.duration <= 1440)
    .safeParse({ id, start, duration, days })
  if (!p.success) return { ok: false, message: 'Posición no válida.' }
  const patch: Record<string, unknown> = { start_time: hhmmss(p.data.start), duration_min: p.data.duration }
  if (p.data.days) patch.days_of_week = p.data.days
  const { error } = await s.supabase.from('calendar_blocks').update(patch).eq('id', p.data.id).eq('user_id', s.user.id)
  if (error) return { ok: false, message: 'No se ha podido mover el bloque.' }
  revalidatePath('/panel', 'layout')
  return { ok: true }
}

export async function deleteBlock(id: string): Promise<CalResult> {
  const s = await session()
  if (!s || !z.uuid().safeParse(id).success) return { ok: false, message: 'Bloque no válido.' }
  const { error } = await s.supabase.from('calendar_blocks').delete().eq('id', id).eq('user_id', s.user.id)
  if (error) return { ok: false, message: 'No se ha podido borrar.' }
  revalidatePath('/panel', 'layout')
  return { ok: true }
}

/** Vuelve a la semana propuesta a partir del diagnóstico y las reglas del plan vigente. */
export async function resetWeek(): Promise<CalResult> {
  const s = await session()
  if (!s) return { ok: false, message: 'Tu sesión ha caducado.' }
  const { data } = await s.supabase
    .from('trading_plans')
    .select('current:plan_versions!trading_plans_current_fk(inputs, content)')
    .eq('user_id', s.user.id)
    .maybeSingle()
  const cur = (data as unknown as { current: { inputs: Record<string, string>; content: { rules: unknown } } | null } | null)?.current
  const rules = rulesSchema.safeParse(cur?.content?.rules)
  if (!cur || !rules.success) return { ok: false, message: 'Primero crea tu plan con el diagnóstico.' }
  const blocks = proposeWeek(cur.inputs ?? {}, rules.data)
  const { error: delErr } = await s.supabase.from('calendar_blocks').delete().eq('user_id', s.user.id)
  if (delErr) return { ok: false, message: 'No se ha podido restablecer.' }
  const { error } = await s.supabase.from('calendar_blocks').insert(
    blocks.map((b) => ({
      user_id: s.user.id,
      title: b.title,
      block_type: b.type,
      start_time: hhmmss(b.start),
      duration_min: b.duration,
      days_of_week: b.days,
      is_screen: SCREEN_TYPES.has(b.type),
    })),
  )
  if (error) return { ok: false, message: 'No se ha podido restablecer.' }
  revalidatePath('/panel', 'layout')
  return { ok: true }
}
