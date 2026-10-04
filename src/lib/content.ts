import 'server-only'
import type { BlockType, PlanContent } from '@/lib/domain/plan'
import { createClient } from '@/lib/supabase/server'

/* Lecturas de contenido editable (diagnóstico, planes) y datos del usuario.
   Todo pasa por RLS con la sesión de quien pide la página. */

export type QuizOption = {
  id: string
  slug: string
  label: string
  hint: string | null
  why: string
  plan: string
  protocol: { title: string } | null
}
export type QuizQuestion = {
  id: string
  slug: string
  eyebrow: string | null
  prompt: string
  helper: string | null
  options: QuizOption[]
}

type OptionRow = {
  id: string
  slug: string
  position: number
  label: string
  why_text: string
  plan_text: string
  value: { hint?: string } | null
  protocol: { title: string } | null
}
type QuestionRow = {
  id: string
  slug: string
  position: number
  eyebrow: string | null
  prompt: string
  helper: string | null
  quiz_options: OptionRow[]
}

export async function getQuiz(): Promise<QuizQuestion[]> {
  const supabase = await createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('quiz_questions')
    .select(
      'id, slug, position, eyebrow, prompt, helper, quiz_options(id, slug, position, label, why_text, plan_text, value, protocol:protocols(title))',
    )
    .eq('is_active', true)
    .order('position')
  if (error || !data) return []
  return (data as unknown as QuestionRow[]).map((q) => ({
    id: q.id,
    slug: q.slug,
    eyebrow: q.eyebrow,
    prompt: q.prompt,
    helper: q.helper,
    options: [...q.quiz_options]
      .sort((a, b) => a.position - b.position)
      .map((o) => ({
        id: o.id,
        slug: o.slug,
        label: o.label,
        hint: o.value?.hint ?? null,
        why: o.why_text,
        plan: o.plan_text,
        protocol: o.protocol,
      })),
  }))
}

export type PlanTier = {
  id: 'core' | 'pro'
  name: string
  monthly: number | null
  annual: number | null
  trialDays: number
  features: Record<string, number | boolean>
}

export async function getPlans(): Promise<PlanTier[]> {
  const supabase = await createClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('plans')
    .select('id, name, price_cents, price_cents_annual, trial_days, features, sort_order')
    .eq('is_active', true)
    .in('id', ['core', 'pro'])
    .order('sort_order')
  return (data ?? []).map((p) => ({
    id: p.id as PlanTier['id'],
    name: p.name as string,
    monthly: p.price_cents != null ? (p.price_cents as number) / 100 : null,
    annual: p.price_cents_annual != null ? (p.price_cents_annual as number) / 100 : null,
    trialDays: p.trial_days as number,
    features: (p.features ?? {}) as PlanTier['features'],
  }))
}

export type MyProtocol = {
  id: string
  category: string
  title: string
  trigger: string | null
  body: string
  active: boolean
  own: boolean
}
export type MyBlock = { id: string; title: string; type: BlockType; start: number; duration: number; days: number[] }
export type PlanVersionInfo = { version: number; source: 'ai' | 'user' | 'review'; createdAt: string; note: string | null }
export type MyPlan = {
  versions: PlanVersionInfo[]
  version: number
  createdAt: string
  content: PlanContent
  protocols: MyProtocol[]
  blocks: MyBlock[]
}

export async function getMyPlan(userId: string): Promise<MyPlan | null> {
  const supabase = await createClient()
  if (!supabase) return null
  const { data: plan } = await supabase
    .from('trading_plans')
    .select('current:plan_versions!trading_plans_current_fk(version, created_at, content)')
    .eq('user_id', userId)
    .maybeSingle()
  const current = (plan as unknown as { current: { version: number; created_at: string; content: PlanContent } | null } | null)
    ?.current
  if (!current) return null

  const [{ data: protocols }, { data: blocks }, { data: versions }] = await Promise.all([
    supabase
      .from('protocols')
      .select('id, category, title, trigger_text, body, is_active, source_id, sort_order, created_at')
      .eq('user_id', userId)
      .order('sort_order')
      .order('created_at'),
    supabase.from('calendar_blocks').select('id, title, block_type, start_time, duration_min, days_of_week').eq('user_id', userId),
    supabase
      .from('plan_versions')
      .select('version, source, created_at, change_note')
      .eq('user_id', userId)
      .order('version', { ascending: false })
      .limit(12),
  ])

  return {
    versions: (versions ?? []).map((v) => ({ version: v.version, source: v.source, createdAt: v.created_at, note: v.change_note })),
    version: current.version,
    createdAt: current.created_at,
    content: current.content,
    protocols: (protocols ?? []).map((p) => ({
      id: p.id,
      category: p.category,
      title: p.title,
      trigger: p.trigger_text,
      body: p.body,
      active: p.is_active,
      own: !p.source_id,
    })),
    blocks: (blocks ?? []).map((b) => {
      const [h, m] = String(b.start_time).split(':').map(Number)
      return {
        id: b.id,
        title: b.title,
        type: b.block_type as BlockType,
        start: (h ?? 0) * 60 + (m ?? 0),
        duration: b.duration_min,
        days: b.days_of_week,
      }
    }),
  }
}
