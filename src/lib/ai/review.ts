import 'server-only'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AI_MODEL, aiConfigured, anthropic, FALLBACK_BETA } from './client'
import { REVIEW_RULES, violatesPolicy } from './guardrails'
import { recordTokens, refundQuota, takeQuota } from './quota'

export const reviewSchema = z.object({
  resumen: z.string().describe('2 o 3 frases sobre cómo fue la semana, de tú, sin juicio.'),
  bien: z.array(z.string()).describe('1 a 3 cosas concretas que hizo bien, basadas en los datos.'),
  observaciones: z.array(z.string()).describe('1 a 3 observaciones con "puede indicar". Vacío si no hay datos suficientes.'),
  mejora: z
    .object({ titulo: z.string().describe('Nombre corto de la mejora.'), como: z.string().describe('Regla concreta y medible para la semana que viene.') })
    .describe('Una sola mejora prioritaria.'),
  pregunta: z.string().describe('Una pregunta para que el trader reflexione en sus notas.'),
})
export type AiReview = z.infer<typeof reviewSchema> & { generatedAt: string }

/** La IA escribe la revisión de la semana a partir de los números y las notas del journal. */
export async function writeWeeklyReview(
  supabase: SupabaseClient,
  userId: string,
  weekStartIso: string,
  context: string,
  stats: Record<string, unknown>,
): Promise<{ ok: true; review: AiReview } | { ok: false; message: string }> {
  if (!aiConfigured()) return { ok: false, message: 'La revisión con IA aún no está activada en este entorno.' }
  const q = await takeQuota(supabase, 'review')
  if (!q.ok) return { ok: false, message: q.message }
  try {
    const res = await anthropic().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(reviewSchema) },
      system: [{ type: 'text', text: REVIEW_RULES, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `<datos_usuario>\n${context}\n</datos_usuario>\n\nEscribe mi revisión de la semana.` }],
    })
    const out = res.parsed_output
    const text = out ? [out.resumen, ...out.bien, ...out.observaciones, out.mejora.titulo, out.mejora.como, out.pregunta].join('\n') : ''
    if (res.stop_reason === 'refusal' || !out || violatesPolicy(text)) {
      await refundQuota(supabase, q.usageId)
      return { ok: false, message: 'No hemos podido escribir tu revisión ahora. Inténtalo de nuevo.' }
    }
    const review: AiReview = { ...out, generatedAt: new Date().toISOString() }
    const { error } = await supabase
      .from('weekly_reviews')
      .upsert({ user_id: userId, week_start: weekStartIso, stats, ai: review, ai_text: out.resumen, updated_at: new Date().toISOString() }, { onConflict: 'user_id,week_start' })
    if (error) throw error
    await recordTokens(supabase, q.usageId, res.usage)
    return { ok: true, review }
  } catch {
    await refundQuota(supabase, q.usageId)
    return { ok: false, message: 'No hemos podido escribir tu revisión ahora. Inténtalo en unos minutos.' }
  }
}
