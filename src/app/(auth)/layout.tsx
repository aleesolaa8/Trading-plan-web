import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import styles from './auth.module.css'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <Logo />
        <Link href="/" className={styles.back}>
          ← Volver a la web
        </Link>
      </header>
      <main id="contenido" className={styles.main}>
        {children}
      </main>
      <p className={styles.legal}>
        Herramienta de planificación y registro. No es asesoramiento financiero. Los CFD conllevan un riesgo elevado de
        perder dinero. <Link href="/legal/riesgo">Leer el aviso completo</Link>.
      </p>
    </div>
  )
}
