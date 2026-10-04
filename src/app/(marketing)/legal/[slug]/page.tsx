import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Disclaimer } from '@/components/layout/Disclaimer'
import styles from './legal.module.css'

const PAGES: Record<string, { title: string; body: React.ReactNode }> = {
  riesgo: { title: 'Aviso de riesgo', body: <Disclaimer /> },
  privacidad: {
    title: 'Privacidad',
    body: (
      <p>
        Tus datos (plan, journal, calendario y respuestas del diagnóstico) se guardan aislados por usuario: solo tú
        puedes leerlos. Texto legal completo pendiente de redacción por un profesional antes del lanzamiento.
      </p>
    ),
  },
  terminos: {
    title: 'Términos',
    body: <p>Términos y condiciones pendientes de redacción por un profesional antes del lanzamiento.</p>,
  },
}

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps<'/legal/[slug]'>): Promise<Metadata> {
  const page = PAGES[(await params).slug]
  return { title: page?.title }
}

export default async function LegalPage({ params }: PageProps<'/legal/[slug]'>) {
  const page = PAGES[(await params).slug]
  if (!page) notFound()
  return (
    <article className={`wrap ${styles.page}`}>
      <span className="eyebrow">
        <span className="dot" />
        Legal
      </span>
      <h1>{page.title}</h1>
      <div className={styles.body}>{page.body}</div>
    </article>
  )
}
