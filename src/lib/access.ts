import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/* Qué puede usar el usuario ahora mismo. La verdad está en la base de datos
   (current_plan / my_access); aquí solo se lee para mostrar u ocultar cosas.
   Los límites importantes se vuelven a comprobar al guardar (triggers y RPC). */

export type Features = {
  ai_plan_generations?: number
  copilot_messages_per_month?: number
  journal_entries_per_month?: number | null
  max_accounts?: number
  patterns?: boolean
  weekly_summary?: boolean
  ai_reviews_per_month?: number
  ai_screenshot_reviews_per_month?: number
  advanced_stats?: boolean
  funded_mode?: boolean
  reminders?: boolean
  export_csv?: boolean
  pdf_reports?: boolean
}

export type Access = {
  plan: 'free' | 'core' | 'pro' | null
  planName: string | null
  features: Features
  source: 'subscription' | 'trial' | 'free' | null
  trialEndsAt: string | null
  subscription: {
    plan: string
    status: string
    interval: 'month' | 'year'
    current_period_end: string | null
    cancel_at_period_end: boolean
  } | null
}

const EMPTY: Access = { plan: null, planName: null, features: {}, source: null, trialEndsAt: null, subscription: null }

export const getAccess = cache(async (): Promise<Access> => {
  const supabase = await createClient()
  if (!supabase) return EMPTY
  const { data } = await supabase.rpc('my_access')
  if (!data) return EMPTY
  const d = data as Record<string, unknown>
  return {
    plan: (d.plan as Access['plan']) ?? null,
    planName: (d.plan_name as string) ?? null,
    features: (d.features as Features) ?? {},
    source: (d.source as Access['source']) ?? null,
    trialEndsAt: (d.trial_ends_at as string) ?? null,
    subscription: (d.subscription as Access['subscription']) ?? null,
  }
})

export function has(a: Access, key: keyof Features): boolean {
  return Boolean(a.features[key])
}

export function trialDaysLeft(a: Access): number {
  if (a.source !== 'trial' || !a.trialEndsAt) return 0
  return Math.max(0, Math.ceil((new Date(a.trialEndsAt).getTime() - Date.now()) / 86_400_000))
}

/** Plan con el que se desbloquea una función (para el texto del aviso). */
export function unlockPlan(key: keyof Features): 'Core' | 'Pro' {
  return (['advanced_stats', 'funded_mode', 'ai_reviews_per_month', 'ai_screenshot_reviews_per_month', 'pdf_reports'] as const).includes(
    key as never,
  )
    ? 'Pro'
    : 'Core'
}
