'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

export type ActionResult = { ok: boolean; message?: string }

export async function toggleProtocol(id: string, active: boolean): Promise<ActionResult> {
  const user = await getCurrentUser()
  const supabase = await createClient()
  if (!user || !supabase) return { ok: false, message: 'Tu sesión ha caducado.' }
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) return { ok: false, message: 'Protocolo no válido.' }
  const { error } = await supabase.from('protocols').update({ is_active: active }).eq('id', parsed.data).eq('user_id', user.id)
  if (error) return { ok: false, message: 'No se ha podido guardar el cambio.' }
  revalidatePath('/panel/plan')
  return { ok: true }
}

const ownSchema = z.object({
  trigger: z.string().trim().min(3, 'Escribe cuándo se aplica.').max(80, 'Máximo 80 caracteres.'),
  body: z.string().trim().min(3, 'Escribe qué haces.').max(240, 'Máximo 240 caracteres.'),
})

export async function addProtocol(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  const supabase = await createClient()
  if (!user || !supabase) return { ok: false, message: 'Tu sesión ha caducado.' }
  const p = ownSchema.safeParse(input)
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message }
  const title = p.data.body.length > 60 ? `${p.data.body.slice(0, 58)}…` : p.data.body
  const { error } = await supabase.from('protocols').insert({
    user_id: user.id,
    category: 'otro',
    title,
    trigger_text: p.data.trigger,
    body: p.data.body,
    sort_order: 100,
  })
  if (error) return { ok: false, message: 'No se ha podido guardar el protocolo.' }
  revalidatePath('/panel/plan')
  return { ok: true }
}

export async function deleteProtocol(id: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  const supabase = await createClient()
  if (!user || !supabase) return { ok: false, message: 'Tu sesión ha caducado.' }
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) return { ok: false }
  const { error } = await supabase.from('protocols').delete().eq('id', parsed.data).eq('user_id', user.id).is('source_id', null)
  if (error) return { ok: false, message: 'No se ha podido borrar.' }
  revalidatePath('/panel/plan')
  return { ok: true }
}

export async function draftWithAI(): Promise<ActionResult> {
  const user = await getCurrentUser()
  const supabase = await createClient()
  if (!user || !supabase) return { ok: false, message: 'Tu sesión ha caducado.' }
  const { writePlanWithAI } = await import('@/lib/ai/plan-writer')
  const r = await writePlanWithAI(supabase, user.id)
  if (r.ok) revalidatePath('/panel/plan')
  return r.ok ? { ok: true } : { ok: false, message: r.message }
}
