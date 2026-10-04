'use server'

import { z } from 'zod'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

/** Guarda una pasada del checklist (para saber después si cada operación lo cumplía). */
export async function recordChecklist(labels: string[], passed: string[]): Promise<{ ok: boolean; id?: string }> {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()])
  if (!user || !supabase) return { ok: false }
  const p = z
    .object({ labels: z.array(z.string().max(200)).max(30), passed: z.array(z.string().max(200)).max(30) })
    .safeParse({ labels, passed })
  if (!p.success) return { ok: false }
  const ok = p.data.passed.filter((x) => p.data.labels.includes(x))
  const { data, error } = await supabase
    .from('checklist_runs')
    .insert({ user_id: user.id, labels: p.data.labels, passed: ok, all_passed: ok.length === p.data.labels.length })
    .select('id')
    .single()
  return error ? { ok: false } : { ok: true, id: data.id }
}
