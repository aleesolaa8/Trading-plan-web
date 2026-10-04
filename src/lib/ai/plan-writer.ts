import 'server-only'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { AI_MODEL, aiConfigured, anthropic, FALLBACK_BETA } from './client'
import { userContext } from './context'
import { PLAN_WRITER_RULES, violatesPolicy } from './guardrails'

export const aiPlanSchema = z.object({
  resumen: z.string().describe('2 o 3 frases que resumen el plan del trader, de tú.'),
  secciones: z
    .array(z.object({ titulo: z.string(), texto: z.string() }))
    .describe('Entre 4 y 7 secciones: horario y mercados, riesgo, entrada, gestión, protocolos, rutina y vida, revisión.'),
  preguntas: z.array(z.string()).describe('Preguntas concretas sobre lo que falta y el trader debe escribir. Vacío si no falta nada.'),
})
export type AiPlan = z.infer<typeof aiPlanSchema> & { model: string; generatedAt: string }

export type WriteResult = { ok: true } | { ok: false; message: string; code?: 'quota' | 'no_plan' | 'config' | 'error' }

/** Redacta el plan con las reglas del usuario y lo guarda como nueva versión (source = 'ai'). */
export async function writePlanWithAI(supabase: SupabaseClient, userId: string): Promise<WriteResult> {
  if (!aiConfigured()) return { ok: false, code: 'config', message: 'La redacción con IA aún no está activada en este entorno.' }

  const { data: plan } = await supabase
    .from('trading_plans')
    .select('id, current:plan_versions!trading_plans_current_fk(version, content, inputs, max_risk_pct, max_trades_day, max_daily_loss_r)')
    .eq('user_id', userId)
    .maybeSingle()
  const current = (plan as unknown as { id: string; current: Record<string, unknown> & { content: Record<string, unknown> } | null } | null)
  if (!current?.current) return { ok: false, code: 'no_plan', message: 'Primero crea tu plan con el diagnóstico.' }

  const { data: q } = await supabase.rpc('consume_ai_quota', { p_kind: 'plan' })
  const quota = q as { allowed: boolean; limit: number; plan: string | null; usage_id?: number }
  if (!quota?.allowed)
    return {
      ok: false,
      code: 'quota',
      message: quota?.plan
        ? `Has usado tus ${quota.limit} redacciones con IA de este mes. Con Pro tienes más.`
        : 'Tu prueba ha terminado. Elige un plan para seguir usando la IA.',
    }
  const refund = () => supabase.rpc('refund_ai_quota', { p_usage_id: quota.usage_id })

  try {
    const context = await userContext(supabase, userId)
    const res = await anthropic().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 8000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(aiPlanSchema) },
      system: [{ type: 'text', text: PLAN_WRITER_RULES, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `${context}\n\nRedacta mi plan de trading con estos datos.` }],
    })
    const out = res.parsed_output
    if (res.stop_reason === 'refusal' || !out) {
      await refund()
      return { ok: false, code: 'error', message: 'No hemos podido redactar tu plan ahora. Inténtalo de nuevo en unos minutos.' }
    }
    const allText = [out.resumen, ...out.secciones.flatMap((s) => [s.titulo, s.texto]), ...out.preguntas].join('\n')
    if (violatesPolicy(allText)) {
      await refund()
      return { ok: false, code: 'error', message: 'La redacción no ha pasado nuestras reglas de calidad. Vuelve a intentarlo.' }
    }

    const c = current.current
    const { data: last } = await supabase.from('plan_versions').select('version').eq('plan_id', current.id).order('version', { ascending: false }).limit(1).single()
    const ai: AiPlan = { ...out, model: res.model, generatedAt: new Date().toISOString() }
    const { data: ver, error } = await supabase
      .from('plan_versions')
      .insert({
        plan_id: current.id,
        user_id: userId,
        version: (last?.version ?? 0) + 1,
        source: 'ai',
        inputs: c.inputs,
        content: { ...c.content, ai },
        max_risk_pct: c.max_risk_pct,
        max_trades_day: c.max_trades_day,
        max_daily_loss_r: c.max_daily_loss_r,
        change_note: 'Plan redactado con IA a partir de tus reglas',
      })
      .select('id')
      .single()
    if (error || !ver) throw error ?? new Error('insert')
    await supabase.from('trading_plans').update({ current_version_id: ver.id }).eq('id', current.id)
    await supabase.rpc('record_ai_tokens', {
      p_usage_id: quota.usage_id,
      p_in: (res.usage.input_tokens ?? 0) + (res.usage.cache_read_input_tokens ?? 0),
      p_out: res.usage.output_tokens ?? 0,
    })
    return { ok: true }
  } catch {
    await refund()
    return { ok: false, code: 'error', message: 'No hemos podido redactar tu plan ahora. Inténtalo de nuevo en unos minutos.' }
  }
}
