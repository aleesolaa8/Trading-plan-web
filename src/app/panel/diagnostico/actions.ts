'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getQuiz } from '@/lib/content'
import { buildPlanContent, proposeWeek, rulesSchema, type RulesInput } from '@/lib/domain/plan'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

export type SaveResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> }

const payloadSchema = z.object({
  answers: z.record(z.string(), z.string()),
  rules: z.custom<RulesInput>(),
  replaceCalendar: z.boolean(),
})

export async function saveOnboarding(input: unknown): Promise<SaveResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: 'Tu sesión ha caducado. Vuelve a entrar para guardar tu plan.' }

  const payload = payloadSchema.safeParse(input)
  if (!payload.success) return { ok: false, message: 'No hemos podido leer tus respuestas. Recarga la página.' }

  const rules = rulesSchema.safeParse(payload.data.rules)
  if (!rules.success) {
    const fieldErrors: Record<string, string> = {}
    for (const i of rules.error.issues) fieldErrors[String(i.path[0] ?? 'form')] ??= i.message
    return { ok: false, message: 'Revisa los campos marcados.', fieldErrors }
  }

  // Las respuestas deben corresponder a opciones reales y cubrir todas las preguntas
  const quiz = await getQuiz()
  const optionIds: string[] = []
  for (const q of quiz) {
    const opt = q.options.find((o) => o.slug === payload.data.answers[q.slug])
    if (!opt) return { ok: false, message: `Falta responder: «${q.prompt}»` }
    optionIds.push(opt.id)
  }

  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'El servicio no está disponible ahora mismo. Inténtalo en unos minutos.' }

  const blocks = proposeWeek(payload.data.answers, rules.data)
  const { error } = await supabase.rpc('complete_onboarding', {
    p: {
      option_ids: optionIds,
      answers: payload.data.answers,
      rules: rules.data,
      content: buildPlanContent(payload.data.answers, rules.data),
      replace_calendar: payload.data.replaceCalendar,
      blocks,
    },
  })
  if (error) return { ok: false, message: 'No hemos podido guardar tu plan. Inténtalo de nuevo en unos segundos.' }

  revalidatePath('/panel', 'layout')
  return { ok: true }
}
