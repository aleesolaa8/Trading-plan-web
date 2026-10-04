import type { Metadata } from 'next'
import { ComingSoon, PageHead } from '@/components/app/PageHead'
import { ButtonLink } from '@/components/ui/Button'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Inicio' }

export default async function PanelHome() {
  const user = await getCurrentUser()
  const supabase = await createClient()
  const { data: profile } = (await supabase
    ?.from('profiles')
    .select('display_name, onboarding_done')
    .eq('id', user?.id ?? '')
    .maybeSingle()) ?? { data: null }
  const name = profile?.display_name ?? user?.name ?? 'trader'

  return (
    <>
      <PageHead eyebrow="Tu panel" title={<>Hola, <span className="hl">{name}</span>.</>}>
        Este es tu espacio. Desde aquí verás tu plan, tu próxima sesión y cómo vas cumpliendo.
      </PageHead>
      {!profile?.onboarding_done && (
        <section className="card" style={{ display: 'grid', gap: 16, maxWidth: 720, marginBottom: 16 }}>
          <span className="chip">Primer paso</span>
          <h2 style={{ fontSize: 'clamp(24px, 3.4vw, 32px)', letterSpacing: '-0.035em', lineHeight: 1.1 }}>
            Haz tu diagnóstico de 7 preguntas
          </h2>
          <p className="muted">Con tus respuestas construimos tu plan, tu calendario y tus protocolos. Son unos 3 minutos.</p>
          <div>
            <ButtonLink href="/panel/plan" arrow>
              Empezar diagnóstico
            </ButtonLink>
          </div>
        </section>
      )}
      <ComingSoon
        step={7}
        what="Tu resumen diario"
        items={['Cumplimiento del plan esta semana', 'Próximo bloque de tu calendario', 'Protocolos activos', 'R acumulado y operaciones no realizadas']}
      />
    </>
  )
}
