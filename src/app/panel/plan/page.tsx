import type { Metadata } from 'next'
import { ComingSoon, PageHead } from '@/components/app/PageHead'

export const metadata: Metadata = { title: 'Mi plan' }

export default function PlanPage() {
  return (
    <>
      <PageHead eyebrow="Plan" title="Mi plan">
        Tu plan escrito con tus reglas, tus protocolos y su historial de versiones.
      </PageHead>
      <ComingSoon step={3} what="Diagnóstico, plan y protocolos" items={['Diagnóstico explicativo de 7 preguntas (paso 3)', 'Plan redactado con tus reglas y versiones (paso 4)', 'Protocolos de conducta editables (paso 4)']} />
    </>
  )
}
