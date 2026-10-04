import 'server-only'
import { cache } from 'react'
import type { AccountKind, Entry } from '@/lib/domain/journal'
import type { PlanContent } from '@/lib/domain/plan'
import { nowInZone } from '@/lib/domain/time'
import { createClient } from '@/lib/supabase/server'

/* Lecturas de datos del usuario para las páginas del panel. Todo con RLS. */

export type Profile = { name: string; timezone: string; createdAt: string }
export const getProfile = cache(async (userId: string): Promise<Profile> => {
  const supabase = await createClient()
  const { data } = (await supabase?.from('profiles').select('display_name, timezone, created_at').eq('id', userId).maybeSingle()) ?? { data: null }
  return { name: data?.display_name ?? '', timezone: data?.timezone ?? 'Europe/Madrid', createdAt: data?.created_at ?? new Date().toISOString() }
})

export const getToday = cache(async (userId: string) => nowInZone((await getProfile(userId)).timezone))

export type Account = {
  id: string
  name: string
  kind: AccountKind
  balance: number | null
  currency: string
  initial: number | null
  daily: number | null
  drawdown: number | null
  target: number | null
  archived: boolean
}
export const getAccounts = cache(async (userId: string): Promise<Account[]> => {
  const supabase = await createClient()
  const { data } = (await supabase
    ?.from('trading_accounts')
    .select('id, name, kind, balance, currency, initial_balance, daily_loss_pct, max_drawdown_pct, profit_target_pct, is_archived, created_at')
    .eq('user_id', userId)
    .order('is_archived')
    .order('created_at')) ?? { data: null }
  return (data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    balance: a.balance != null ? Number(a.balance) : null,
    currency: a.currency,
    initial: a.initial_balance != null ? Number(a.initial_balance) : null,
    daily: a.daily_loss_pct != null ? Number(a.daily_loss_pct) : null,
    drawdown: a.max_drawdown_pct != null ? Number(a.max_drawdown_pct) : null,
    target: a.profit_target_pct != null ? Number(a.profit_target_pct) : null,
    archived: a.is_archived,
  }))
})

export type Asset = { id: string; name: string; valuePerPoint: number | null; minLot: number | null; lotStep: number | null; currency: string }
export const getAssets = cache(async (userId: string): Promise<Asset[]> => {
  const supabase = await createClient()
  const { data } = (await supabase
    ?.from('assets')
    .select('id, name, value_per_point, min_lot, lot_step, currency')
    .eq('user_id', userId)
    .order('name')) ?? { data: null }
  return (data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    valuePerPoint: a.value_per_point != null ? Number(a.value_per_point) : null,
    minLot: a.min_lot != null ? Number(a.min_lot) : null,
    lotStep: a.lot_step != null ? Number(a.lot_step) : null,
    currency: a.currency,
  }))
})

/** Contenido del plan vigente (reglas, checklist…) o null si aún no hay plan. */
export const getPlanContent = cache(async (userId: string): Promise<PlanContent | null> => {
  const supabase = await createClient()
  const { data } = (await supabase
    ?.from('trading_plans')
    .select('current:plan_versions!trading_plans_current_fk(content)')
    .eq('user_id', userId)
    .maybeSingle()) ?? { data: null }
  return ((data as unknown as { current: { content: PlanContent } | null } | null)?.current?.content ?? null) as PlanContent | null
})

export type EntryRow = Entry & { screenshotPath: string | null; aiFeedback: string | null; strategy: string | null; createdAt: string }
const ENTRY_COLS =
  'id, entry_type, trade_date, trade_time, asset_name, direction, strategy, result_r, result_amount, emotion_before, plan_compliance, main_error, lesson, skip_reason, account_id, screenshot_path, ai_feedback, created_at'

type Raw = Record<string, unknown>
export function toEntry(r: Raw): EntryRow {
  return {
    id: r.id as string,
    type: r.entry_type as Entry['type'],
    date: r.trade_date as string,
    time: r.trade_time ? String(r.trade_time).slice(0, 5) : null,
    asset: r.asset_name as string,
    direction: (r.direction as Entry['direction']) ?? null,
    resultR: r.result_r != null ? Number(r.result_r) : null,
    amount: r.result_amount != null ? Number(r.result_amount) : null,
    emotion: (r.emotion_before as Entry['emotion']) ?? null,
    compliance: (r.plan_compliance as Entry['compliance']) ?? null,
    error: (r.main_error as Entry['error']) ?? null,
    lesson: (r.lesson as string) ?? null,
    skipReason: (r.skip_reason as string) ?? null,
    accountId: (r.account_id as string) ?? null,
    screenshotPath: (r.screenshot_path as string) ?? null,
    aiFeedback: (r.ai_feedback as string) ?? null,
    strategy: (r.strategy as string) ?? null,
    createdAt: r.created_at as string,
  }
}

export async function getEntries(userId: string, opts: { from?: string; to?: string; account?: string | null; limit?: number } = {}): Promise<EntryRow[]> {
  const supabase = await createClient()
  if (!supabase) return []
  let q = supabase.from('journal_entries').select(ENTRY_COLS).eq('user_id', userId)
  if (opts.from) q = q.gte('trade_date', opts.from)
  if (opts.to) q = q.lte('trade_date', opts.to)
  if (opts.account) q = q.eq('account_id', opts.account)
  const { data } = await q.order('trade_date', { ascending: false }).order('trade_time', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(opts.limit ?? 2000)
  return (data ?? []).map((r) => toEntry(r as Raw))
}
