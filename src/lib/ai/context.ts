import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hhmm, LEVEL_LABEL, type PlanContent } from '@/lib/domain/plan'
import { DAY_NAMES, formatDuration, nowInZone } from '@/lib/domain/time'

/** Resumen compacto de los datos del usuario para la IA (solo lo suyo, vía RLS). */
export async function userContext(supabase: SupabaseClient, userId: string): Promise<string> {
  const [{ data: profile }, { data: plan }, { data: protocols }, { data: blocks }, { data: summary }, { data: accounts }] =
    await Promise.all([
      supabase.from('profiles').select('display_name, timezone').eq('id', userId).maybeSingle(),
      supabase
        .from('trading_plans')
        .select('current:plan_versions!trading_plans_current_fk(version, content)')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase.from('protocols').select('title, body').eq('user_id', userId).eq('is_active', true).limit(20),
      supabase.from('calendar_blocks').select('title, start_time, duration_min, days_of_week').eq('user_id', userId),
      supabase.from('journal_summary').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('trading_accounts').select('name, kind, daily_loss_pct, max_drawdown_pct').eq('user_id', userId).eq('is_archived', false),
    ])

  const now = nowInZone(profile?.timezone ?? 'Europe/Madrid')
  const content = (plan as unknown as { current: { version: number; content: PlanContent } | null } | null)?.current?.content
  const lines: string[] = []
  lines.push(`Nombre: ${profile?.display_name ?? 'sin nombre'}`)
  lines.push(`Ahora: ${DAY_NAMES[now.day - 1]} ${hhmm(now.minutes)}`)

  if (!content) {
    lines.push('Aún no ha creado su plan: anímale a hacer el diagnóstico en "Mi plan" (7 preguntas, unos 3 minutos).')
  } else {
    const r = content.rules
    lines.push(`Nivel: ${LEVEL_LABEL[content.level ?? ''] ?? '-'}`)
    lines.push(`Mercados: ${r.markets.join(', ')}`)
    lines.push(`Sesiones: ${r.s1Start}–${r.s1End}${r.s2Start ? ` y ${r.s2Start}–${r.s2End}` : ''}`)
    lines.push(`Riesgo por operación: ${r.risk} % · Máx. operaciones/día: ${r.maxTrades} · Pérdida máx. diaria: ${r.maxLoss} R`)
    lines.push(`Setup (palabras del usuario): ${r.setup || 'pendiente de escribir'}`)
    lines.push(`Gestión (palabras del usuario): ${r.management || 'pendiente de escribir'}`)
    lines.push(`Checklist: ${content.checklist.join(' | ')}`)
  }
  if (protocols?.length) lines.push(`Protocolos activos: ${protocols.map((p) => `${p.title} (${p.body})`).join(' | ')}`)

  const today = (blocks ?? [])
    .filter((b) => (b.days_of_week as number[]).includes(now.day))
    .map((b) => {
      const [h, m] = String(b.start_time).split(':').map(Number)
      return { start: (h ?? 0) * 60 + (m ?? 0), title: b.title as string, dur: b.duration_min as number }
    })
    .sort((a, b) => a.start - b.start)
  lines.push(`Calendario de hoy: ${today.length ? today.map((b) => `${hhmm(b.start)} ${b.title} (${formatDuration(b.dur)})`).join('; ') : 'sin bloques'}`)

  if (summary) {
    lines.push(
      `Journal: ${summary.trades} operaciones, cumplimiento ${summary.compliance_pct ?? 0} %, ${summary.total_r} R acumulado, ${summary.skipped} no realizadas`,
    )
  }
  if (accounts?.length) {
    lines.push(
      `Cuentas: ${accounts
        .map((a) => `${a.name} (${a.kind}${a.kind === 'fondeo' && a.daily_loss_pct ? `, pérdida diaria máx. ${a.daily_loss_pct} %, caída máx. ${a.max_drawdown_pct} %` : ''})`)
        .join('; ')}`,
    )
  }
  return `<datos_usuario>\n${lines.join('\n')}\n</datos_usuario>`
}
