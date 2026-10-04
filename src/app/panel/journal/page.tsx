import type { Metadata } from 'next'
import { ComingSoon, PageHead } from '@/components/app/PageHead'

export const metadata: Metadata = { title: 'Journal' }

export default function JournalPage() {
  return (
    <>
      <PageHead eyebrow="Registro" title="Journal">
        Cada operación y cada operación no realizada, con cómo te sentías.
      </PageHead>
      <ComingSoon step={6} what="Journal con patrones" items={['Emoción, cumplimiento del plan y error principal', 'Resumen: cumplimiento, R acumulado, % ganadoras', 'Patrones sin juicio con un consejo práctico']} />
    </>
  )
}
