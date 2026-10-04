'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { friendlyDbError } from '@/lib/db-errors'
import { COMPLIANCE, EMOTIONS, ERRORS, computeStats, fmtR } from '@/lib/domain/journal'
import { normalizeMarket } from '@/lib/domain/markets'
import { rulesSchema } from '@/lib/domain/plan'
import { nowInZone } from '@/lib/domain/time'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { toEntry } from '@/lib/data'

export type JournalResult = { ok: boolean; message?: string; limit?: string; id?: string }

const keys = <T extends object>(o: T) => Object.keys(o) as [Extract<keyof T, string>, ...Extract<keyof T, string>[]]
const num = (msg: string) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : typeof v === 'string' ? Number(v.replace(',', '.')) : v), z.number({ error: msg }).optional())

const entrySchema = z
  .object({
    id: z.uuid().optional(),
    type: z.enum(['trade', 'skipped']),
    date: z.iso.date({ error: 'Fecha no válida.' }),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .or(z.literal(''))
      .optional(),
    accountId: z.uuid().nullable().optional(),
    asset: z.string().transform(normalizeMarket).pipe(z.string().min(1, 'Indica el mercado.')),
    direction: z.enum(['long', 'short']).nullable().optional(),
    resultR: num('Resultado en R no válido.').pipe(z.number().min(-100).max(100).optional()),
    amount: num('Resultado en dinero no válido.'),
    emotion: z.enum(keys(EMOTIONS)).nullable().optional(),
    compliance: z.enum(keys(COMPLIANCE)).nullable().optional(),
    error: z.enum(keys(ERRORS)).nullable().optional(),
    lesson: z.string().trim().max(1000, 'Máximo 1000 caracteres.').optional(),
    skipReason: z.string().trim().max(300, 'Máximo 300 caracteres.').optional(),
    screenshotPath: z.string().max(200).nullable().optional(),
    checklistRunId: z.uuid().nullable().optional(),
  })
  .superRefine((e, ctx) => {
    if (e.type === 'trade') {
      if (!e.direction) ctx.addIssue({ code: 'custom', path: ['direction'], message: 'Indica si fue compra o venta.' })
      if (e.resultR == null) ctx.addIssue({ code: 'custom', path: ['resultR'], message: 'Escribe el resultado en R (por ejemplo 2 o −1).' })
      if (!e.compliance) ctx.addIssue({ code: 'custom', path: ['compliance'], message: '¿Cumpliste tu plan?' })
    } else if (!e.skipReason) ctx.addIssue({ code: 'custom', path: ['skipReason'], message: 'Escribe por qué no entraste.' })
  })

export async function saveEntry(input: unknown): Promise<JournalResult> {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()])
  if (!user || !supabase) return { ok: false, message: 'Tu sesión ha caducado.' }
  const p = entrySchema.safeParse(input)
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message }
  const e = p.data
  // La captura debe estar en la carpeta del propio usuario
  if (e.screenshotPath && !e.screenshotPath.startsWith(`${user.id}/`)) return { ok: false, message: 'Captura no válida.' }
  const trade = e.type === 'trade'
  const row = {
    user_id: user.id,
    entry_type: e.type,
    trade_date: e.date,
    trade_time: e.time || null,
    account_id: e.accountId || null,
    asset_name: e.asset,
    direction: trade ? e.direction : null,
    result_r: trade ? e.resultR : null,
    result_amount: trade ? (e.amount ?? null) : null,
    emotion_before: e.emotion || null,
    plan_compliance: trade ? e.compliance : null,
    main_error: trade ? e.error || 'ninguno' : null,
    lesson: e.lesson || null,
    skip_reason: trade ? null : e.skipReason,
    screenshot_path: e.screenshotPath || null,
    checklist_run_id: e.checklistRunId || null,
  }
  let prevShot: string | null = null
  if (e.id) {
    const { data: prev } = await supabase.from('journal_entries').select('screenshot_path').eq('id', e.id).eq('user_id', user.id).maybeSingle()
    prevShot = prev?.screenshot_path ?? null
  }
  const { data, error } = e.id
    ? await supabase
        .from('journal_entries')
        .update({ ...row, ai_feedback: prevShot !== row.screenshot_path ? null : undefined })
        .eq('id', e.id)
        .eq('user_id', user.id)
        .select('id')
        .single()
    : await supabase.from('journal_entries').insert(row).select('id').single()
  if (error) return { ok: false, message: friendlyDbError(error, 'No se ha podido guardar la entrada.') }
  if (prevShot && prevShot !== row.screenshot_path) await supabase.storage.from('journal').remove([prevShot])
  if (e.checklistRunId) await supabase.from('checklist_runs').update({ journal_entry_id: data.id }).eq('id', e.checklistRunId).eq('user_id', user.id)

  revalidatePath('/panel', 'layout')
  return { ok: true, id: data.id, limit: trade ? await limitMessage(supabase, user.id) : undefined }
}

/** Si con esta operación llega a su límite del día, se lo decimos (sin bloquear). */
async function limitMessage(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, userId: string): Promise<string | undefined> {
  const [{ data: prof }, { data: plan }] = await Promise.all([
    supabase.from('profiles').select('timezone').eq('id', userId).maybeSingle(),
    supabase.from('trading_plans').select('current:plan_versions!trading_plans_current_fk(content)').eq('user_id', userId).maybeSingle(),
  ])
  const rules = rulesSchema.safeParse((plan as unknown as { current: { content: { rules: unknown } } | null } | null)?.current?.content?.rules)
  if (!rules.success) return
  const today = nowInZone(prof?.timezone ?? 'Europe/Madrid').isoDate
  const { data } = await supabase.from('journal_entries').select('*').eq('user_id', userId).eq('trade_date', today)
  const s = computeStats((data ?? []).map((r) => toEntry(r)))
  if (s.totalR <= -rules.data.maxLoss) return `Has llegado a tu pérdida máxima de hoy (${fmtR(s.totalR)}). Tu protocolo: cierra la plataforma. Mañana es otra sesión.`
  if (s.trades >= rules.data.maxTrades) return `Has hecho ${s.trades} de ${rules.data.maxTrades} operaciones: tu día de trading termina aquí.`
}

export async function deleteEntry(id: string): Promise<JournalResult> {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()])
  if (!user || !supabase || !z.uuid().safeParse(id).success) return { ok: false, message: 'Entrada no válida.' }
  const { data } = await supabase.from('journal_entries').delete().eq('id', id).eq('user_id', user.id).select('screenshot_path').maybeSingle()
  if (data?.screenshot_path) await supabase.storage.from('journal').remove([data.screenshot_path])
  revalidatePath('/panel', 'layout')
  return { ok: true }
}

export async function reviewShot(id: string): Promise<{ ok: boolean; message?: string }> {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()])
  if (!user || !supabase || !z.uuid().safeParse(id).success) return { ok: false, message: 'Entrada no válida.' }
  const { reviewScreenshot } = await import('@/lib/ai/screenshot')
  const r = await reviewScreenshot(supabase, user.id, id)
  if (r.ok) revalidatePath('/panel/journal')
  return { ok: r.ok, message: r.message }
}
