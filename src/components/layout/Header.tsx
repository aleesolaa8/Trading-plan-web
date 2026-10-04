'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import styles from './Header.module.css'

const LINKS = [
  { href: '/#como', label: 'Cómo funciona' },
  { href: '/#diagnostico', label: 'Diagnóstico' },
  { href: '/#herramientas', label: 'Herramientas' },
  { href: '/#precio', label: 'Precio' },
  { href: '/#faq', label: 'Preguntas' },
]

export function Header({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  // El menú queda ligado a la página donde se abrió: al navegar se cierra solo.
  const [openAt, setOpenAt] = useState<string | null>(null)
  const open = openAt === pathname
  const setOpen = (value: boolean | ((v: boolean) => boolean)) =>
    setOpenAt((typeof value === 'function' ? value(open) : value) ? pathname : null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenAt(null)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const cta = signedIn ? { href: '/panel', label: 'Mi panel' } : { href: '/registro', label: 'Empezar' }

  return (
    <>
      <header className={`${styles.header} ${scrolled || open ? styles.scrolled : ''}`}>
        <div className={`wrap ${styles.bar}`}>
          <div className={styles.brand}>
            <Logo />
          </div>
          <nav className={styles.nav} aria-label="Principal">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
            {!signedIn && <Link href="/login">Entrar</Link>}
          </nav>
          <ThemeToggle className={`${styles.iconBtn} ${styles.themeDesktop}`} />
          <ButtonLink href={cta.href} size="sm" arrow>
            {cta.label}
          </ButtonLink>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.burger} ${open ? styles.burgerOpen : ''}`}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            aria-controls="menu-principal"
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>
        </div>
      </header>

      <div
        id="menu-principal"
        className={`${styles.menu} ${open ? styles.menuOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        inert={!open}
      >
        <nav>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label} <span className="hl">→</span>
            </Link>
          ))}
          <Link href={signedIn ? '/panel' : '/login'} onClick={() => setOpen(false)}>
            {signedIn ? 'Mi panel' : 'Entrar'} <span className="hl">→</span>
          </Link>
        </nav>
        <ThemeToggle className={`btn btn-ghost btn-sm ${styles.themeMobile}`} label="Cambiar tema claro / oscuro" />
        <ButtonLink href={cta.href} size="xl" arrow className={styles.menuCta} onClick={() => setOpen(false)}>
          {signedIn ? 'Ir a mi panel' : 'Crear mi plan'}
        </ButtonLink>
      </div>
    </>
  )
}
