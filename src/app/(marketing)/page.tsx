import { StatsBand } from '@/components/layout/StatsBand'
import { Ticker } from '@/components/layout/Ticker'
import { ButtonLink } from '@/components/ui/Button'
import styles from './home.module.css'

// Paso 2: portada con el sistema de diseño. La landing completa llega en el paso 3.
export default function Home() {
  return (
    <>
      <section className={`wrap ${styles.hero}`}>
        <span className="pill">
          <span className="dot" />
          Plan · Disciplina · Estilo de vida
        </span>
        <h1>
          Deja de improvisar. <span className="hl-grad">Opera con un plan</span> que es tuyo.
        </h1>
        <p className="lead">
          Convierte tus reglas en un plan escrito, un calendario que respeta tu vida y un journal que te enseña tus
          patrones. Sin señales. Sin promesas. Proceso.
        </p>
        <div className={styles.ctas}>
          <ButtonLink href="/registro" size="xl" arrow>
            Crear mi plan
          </ButtonLink>
          <ButtonLink href="/login" size="xl" variant="ghost">
            Ya tengo cuenta
          </ButtonLink>
        </div>
      </section>
      <Ticker />
      <div className={styles.stats}>
        <StatsBand
          stats={[
            { value: '7', label: 'preguntas para un diagnóstico que te explica el porqué' },
            { value: '1', label: 'plan escrito con tus reglas, versionado' },
            { value: '0', label: 'señales de compra o venta. Nunca.' },
            { value: '24 h', label: 'copiloto para hablar cuando lo necesites' },
          ]}
        />
      </div>
    </>
  )
}
