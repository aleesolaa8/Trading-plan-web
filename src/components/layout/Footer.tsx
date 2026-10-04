import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { Disclaimer } from './Disclaimer'
import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="wrap">
        <div className={styles.top}>
          <Logo />
          <nav className={styles.links} aria-label="Legal">
            <Link href="/legal/riesgo">Aviso de riesgo</Link>
            <Link href="/legal/privacidad">Privacidad</Link>
            <Link href="/legal/terminos">Términos</Link>
          </nav>
        </div>
        <div className={styles.legal}>
          <Disclaimer />
        </div>
        <p className={styles.copy}>© {new Date().getFullYear()} Time to Trade</p>
      </div>
    </footer>
  )
}
