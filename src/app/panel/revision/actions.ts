'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAccess, has } from '@/lib/access'
import { getEntries, getPlanContent } from '@/lib/data'
import { addDays, COMPLIANCE, computeStats, EMOTIONS, ERRORS, fmtR, weekStart } from '@/lib/domain/journal'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

const week = z.iso.date().refine((d) => weekStart(d) === d, 'La semana debe empezar en lunes.')

export async function generateReview(weekIso: string): Promise<{ ok: boolean; message?: string }> {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()])
  if (!user || !supabase || !week.safeParse(weekIso).success) return { ok: false, message: 'Semana no válida.' }
  const end = addDays(weekIso, 6)
  const [entries, prev, plan, protos] = await Promise.all([
    getEntries(user.id, { from: weekIso, to: end }),
    getEntries(user.id, { from: addDays(weekIso, -7), to: addDays(weekIso, -1) }),
    getPlanContent(user.id),
    supabase.from('protocols').select('title').eq('user_id', user.id).eq('is_active', true).limit(12),
  ])
  if (!entries.length) return { ok: false, message: 'No hay entradas esta semana. Registra tus operaciones para poder revisarla.' }
  const s = computeStats(entries)
  const p = computeStats(prev)
  const r = plan?.rules
  const lines = [
    r
      ? `Plan: riesgo ${r.risk} % por operación, máximo ${r.maxTrades} operaciones/día, pérdida máxima −${r.maxLoss} R/día. Mercados: ${r.markets.join(', ')}. Setup: ${r.setup || '(sin escribir)'}.`
      : 'Plan: aún sin crear.',
    `Protocolos activos: ${(protos.data ?? []).map((x) => x.title).join('; ') || 'ninguno'}.`,
    `Semana del ${weekIso}: ${s.trades} operaciones, ${s.skipped} no realizadas, cumplimiento ${s.compliancePct ?? '—'} %, resultado ${fmtR(s.totalR)}, ganadoras ${s.winPct ?? '—'} %, R medio ${s.avgR ?? '—'}.`,
    `Semana anterior: ${p.trades} operaciones, cumplimiento ${p.compliancePct ?? '—'} %, resultado ${fmtR(p.totalR)}.`,
    'Entradas (fecha · mercado · resultado · cumplió plan · emoción · error · nota):',
    ...entries
      .slice(0, 80)
      .reverse()
      .map((e) =>
        e.type === 'trade'
          ? `- ${e.date} ${e.time ?? ''} · ${e.asset} · ${fmtR(e.resultR ?? 0)} · ${e.compliance ? COMPLIANCE[e.compliance] : '—'} · ${e.emotion ? EMOTIONS[e.emotion] : '—'} · ${e.error ? ERRORS[e.error] : '—'} · ${(e.lesson ?? '').slice(0, 200)}`
          : `- ${e.date} · ${e.asset} · NO REALIZADA: ${(e.skipReason ?? '').slice(0, 150)} · ${e.emotion ? EMOTIONS[e.emotion] : '—'}`,
      ),
  ]
  const { writeWeeklyReview } = await import('@/lib/ai/review')
  const res = await writeWeeklyReview(supabase, user.id, weekIso, lines.join('\n'), s)
  if (res.ok) revalidatePath('/panel/revision')
  return res.ok ? { ok: true } : { ok: false, message: res.message }
}

export async function saveNotes(weekIso: string, notes: string): Promise<{ ok: boolean; message?: string }> {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()])
  const p = z.object({ w: week, n: z.string().max(3000, 'Máximo 3000 caracteres.') }).safeParse({ w: weekIso, n: notes })
  if (!user || !supabase || !p.success) return { ok: false, message: p.success ? 'Tu sesión ha caducado.' : p.error.issues[0]?.message }
  if (!has(await getAccess(), 'weekly_summary')) return { ok: false, message: 'La revisión semanal está incluida en Core y Pro.' }
  const { error } = await supabase
    .from('weekly_reviews')
    .upsert({ user_id: user.id, week_start: p.data.w, user_notes: p.data.n.trim() || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id,week_start' })
  if (error) return { ok: false, message: 'No se han podido guardar tus notas.' }
  revalidatePath('/panel/revision')
  return { ok: true }
}

/** Convierte la mejora propuesta en un protocolo propio (activo). */
export async function adoptImprovement(weekIso: string): Promise<{ ok: boolean; message?: string }> {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()])
  if (!user || !supabase || !week.safeParse(weekIso).success) return { ok: false, message: 'Semana no válida.' }
  const { data } = await supabase.from('weekly_reviews').select('ai').eq('user_id', user.id).eq('week_start', weekIso).maybeSingle()
  const m = (data?.ai as { mejora?: { titulo: string; como: string } } | null)?.mejora
  if (!m) return { ok: false, message: 'Esta semana no tiene una mejora propuesta.' }
  const { error } = await supabase.from('protocols').insert({
    user_id: user.id,
    category: 'otro',
    title: m.titulo.slice(0, 80),
    trigger_text: 'Mejora de la revisión semanal',
    body: m.como.slice(0, 600),
    sort_order: 90,
  })
  if (error) return { ok: false, message: 'No se ha podido añadir a tus protocolos.' }
  revalidatePath('/panel/plan')
  return { ok: true, message: 'Añadida a tus protocolos.' }
}
