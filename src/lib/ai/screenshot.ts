import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AI_MODEL, aiConfigured, anthropic, FALLBACK_BETA } from './client'
import { SCREENSHOT_RULES, violatesPolicy } from './guardrails'
import { recordTokens, refundQuota, takeQuota } from './quota'

const MEDIA: Record<string, 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

/** La IA compara la captura de una entrada con el setup escrito en el plan. Guarda el comentario. */
export async function reviewScreenshot(supabase: SupabaseClient, userId: string, entryId: string): Promise<{ ok: boolean; message?: string; text?: string }> {
  if (!aiConfigured()) return { ok: false, message: 'La revisión con IA aún no está activada en este entorno.' }
  const { data: entry } = await supabase
    .from('journal_entries')
    .select('id, screenshot_path, asset_name, direction, result_r, plan_compliance, main_error, lesson, entry_type, skip_reason')
    .eq('id', entryId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!entry?.screenshot_path) return { ok: false, message: 'Esta entrada no tiene captura.' }
  const ext = entry.screenshot_path.split('.').pop()?.toLowerCase() ?? ''
  const media = MEDIA[ext]
  if (!media) return { ok: false, message: 'Formato de imagen no compatible.' }

  const { data: plan } = await supabase
    .from('trading_plans')
    .select('current:plan_versions!trading_plans_current_fk(content)')
    .eq('user_id', userId)
    .maybeSingle()
  const rules = (plan as unknown as { current: { content: { rules?: { setup?: string; management?: string } } } | null } | null)?.current?.content?.rules

  const q = await takeQuota(supabase, 'screenshot')
  if (!q.ok) return { ok: false, message: q.message }
  try {
    const { data: file, error } = await supabase.storage.from('journal').download(entry.screenshot_path)
    if (error || !file) throw error ?? new Error('download')
    const b64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    const datos = [
      `Setup escrito: ${rules?.setup || '(sin escribir)'}`,
      `Gestión escrita: ${rules?.management || '(sin escribir)'}`,
      `Mercado: ${entry.asset_name}`,
      entry.entry_type === 'skipped'
        ? `Operación no realizada. Motivo: ${entry.skip_reason ?? ''}`
        : `Dirección: ${entry.direction === 'long' ? 'compra' : 'venta'} · Resultado: ${entry.result_r} R · Cumplió el plan: ${entry.plan_compliance} · Error principal: ${entry.main_error ?? 'ninguno'}`,
      entry.lesson ? `Nota del trader: ${entry.lesson}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    const res = await anthropic().beta.messages.create({
      model: AI_MODEL,
      max_tokens: 900,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SCREENSHOT_RULES, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: media, data: b64 } },
            { type: 'text', text: `<datos_usuario>\n${datos}\n</datos_usuario>\n\nCompara la captura con mi setup escrito.` },
          ],
        },
      ],
    })
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
      .trim()
    if (res.stop_reason === 'refusal' || !text || violatesPolicy(text)) {
      await refundQuota(supabase, q.usageId)
      return { ok: false, message: 'No hemos podido revisar esta captura. Inténtalo de nuevo.' }
    }
    await supabase.from('journal_entries').update({ ai_feedback: text }).eq('id', entryId).eq('user_id', userId)
    await recordTokens(supabase, q.usageId, res.usage)
    return { ok: true, text }
  } catch {
    await refundQuota(supabase, q.usageId)
    return { ok: false, message: 'No hemos podido revisar esta captura ahora. Inténtalo en unos minutos.' }
  }
}
