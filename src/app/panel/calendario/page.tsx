import type { Metadata } from 'next'
import { ComingSoon, PageHead } from '@/components/app/PageHead'

export const metadata: Metadata = { title: 'Calendario' }

export default function CalendarioPage() {
  return (
    <>
      <PageHead eyebrow="Calendario" title="Calendario">
        Trading, sueño, comida, ejercicio y desconexión en una misma semana.
      </PageHead>
      <ComingSoon step={5} what="Bloques que mueves a tu ritmo" items={['Arrastrar y soltar, con flechas en el móvil', 'Hora libre, duración, tipo y repetición por días', 'Avisos de solapes y de demasiadas horas de pantalla']} />
    </>
  )
}
