import type { Metadata } from 'next'
import { ComingSoon, PageHead } from '@/components/app/PageHead'

export const metadata: Metadata = { title: 'Calculadora' }

export default function CalculadoraPage() {
  return (
    <>
      <PageHead eyebrow="Riesgo" title="Calculadora">
        El tamaño exacto antes de cada entrada, con los datos de tu bróker.
      </PageHead>
      <ComingSoon step={6} what="Calculadora y checklist" items={['US100, GER40 o personalizado, con tus valores guardados', 'Lotes redondeados hacia abajo al paso', 'Avisos de lote mínimo y de límite de riesgo de tu plan']} />
    </>
  )
}
