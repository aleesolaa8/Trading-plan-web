import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getMyPlan, getQuiz } from '@/lib/content'
import type { Answers, RulesInput } from '@/lib/domain/plan'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { Onboarding } from './Onboarding'

export const metadata: Metadata = { title: 'Diagnóstico' }

export default async function DiagnosticoPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/panel/diagnostico')

  const [quiz, plan, supabase] = await Promise.all([getQuiz(), getMyPlan(user.id), createClient()])
  const { data: profile } = (await supabase?.from('profiles').select('display_name').eq('id', user.id).maybeSingle()) ?? {
    data: null,
  }

  // Si ya hay plan, partimos de las respuestas y reglas actuales
  const initialAnswers: Answers = {}
  if (plan) {
    const { data } = (await supabase
      ?.from('quiz_responses')
      .select('attempt, question:quiz_questions(slug), option:quiz_options(slug)')
      .eq('user_id', user.id)
      .order('attempt', { ascending: false })) ?? { data: null }
    const rows = (data ?? []) as unknown as { attempt: number; question: { slug: string }; option: { slug: string } }[]
    const last = rows[0]?.attempt
    for (const r of rows) if (r.attempt === last) initialAnswers[r.question.slug] = r.option.slug
  }
  const r = plan?.content.rules
  const initialRules: RulesInput | null = r
    ? { ...r, risk: String(r.risk).replace('.', ','), maxTrades: String(r.maxTrades), maxLoss: String(r.maxLoss).replace('.', ',') }
    : null

  return (
    <Onboarding
      quiz={quiz}
      initialAnswers={initialAnswers}
      initialRules={initialRules}
      defaultName={profile?.display_name ?? user.name ?? ''}
      hasCalendar={(plan?.blocks.length ?? 0) > 0}
      draftKey={`ttt-onboarding-${user.id}`}
    />
  )
}
