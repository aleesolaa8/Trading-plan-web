import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

type Kind = 'plan' | 'review' | 'screenshot' | 'chat'
export type Quota = { ok: true; usageId: number } | { ok: false; message: string }

const LOCKED: Record<Kind, string> = {
  review: 'La revisión semanal escrita por IA está incluida en Pro.',
  screenshot: 'La revisión de capturas con IA está incluida en Pro.',
  plan: 'Has usado tus redacciones con IA de este mes.',
  chat: 'Has usado tus mensajes de este mes.',
}

/** Comprueba y descuenta un uso de IA en la base de datos. */
export async function takeQuota(supabase: SupabaseClient, kind: Kind): Promise<Quota> {
  const { data } = await supabase.rpc('consume_ai_quota', { p_kind: kind })
  const q = data as { allowed: boolean; limit: number; usage_id?: number } | null
  if (!q?.allowed || !q.usage_id)
    return { ok: false, message: q && q.limit > 0 ? `Has usado tus ${q.limit} usos de este mes. Se renuevan el día 1.` : LOCKED[kind] }
  return { ok: true, usageId: q.usage_id }
}

export async function refundQuota(supabase: SupabaseClient, usageId: number) {
  await supabase.rpc('refund_ai_quota', { p_usage_id: usageId })
}

export async function recordTokens(
  supabase: SupabaseClient,
  usageId: number,
  u: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null },
) {
  await supabase.rpc('record_ai_tokens', {
    p_usage_id: usageId,
    p_in: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    p_out: u.output_tokens ?? 0,
  })
}
