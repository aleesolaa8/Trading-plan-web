import type { Metadata } from 'next'
import { ComingSoon, PageHead } from '@/components/app/PageHead'

export const metadata: Metadata = { title: 'Ajustes' }

export default function AjustesPage() {
  return (
    <>
      <PageHead eyebrow="Cuenta" title="Ajustes">
        Tu cuenta, tus activos, el tema y la facturación.
      </PageHead>
      <ComingSoon step={8} what="Cuenta y suscripción" items={['Datos de tu cuenta y tema claro / oscuro', 'Activos guardados para la calculadora', 'Suscripción Core: 14,99 € + IVA al mes']} />
    </>
  )
}
