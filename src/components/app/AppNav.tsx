'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './AppShell.module.css'

const ICONS: Record<string, React.ReactNode> = {
  inicio: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  plan: <path d="M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6" />,
  calendario: <path d="M4 6h16v15H4zM4 10h16M9 3v5M15 3v5" />,
  calculadora: <path d="M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" />,
  journal: <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11" />,
  ajustes: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />,
}

export const NAV = [
  { href: '/panel', key: 'inicio', label: 'Inicio' },
  { href: '/panel/plan', key: 'plan', label: 'Mi plan' },
  { href: '/panel/calendario', key: 'calendario', label: 'Calendario' },
  { href: '/panel/calculadora', key: 'calculadora', label: 'Calculadora' },
  { href: '/panel/journal', key: 'journal', label: 'Journal' },
  { href: '/panel/ajustes', key: 'ajustes', label: 'Ajustes' },
] as const

export function AppNav({ variant }: { variant: 'side' | 'bottom' }) {
  const pathname = usePathname()
  const items = variant === 'bottom' ? NAV.filter((n) => n.key !== 'ajustes') : NAV
  return (
    <nav className={variant === 'side' ? styles.sideNav : styles.bottomNav} aria-label="Secciones">
      {items.map((n) => {
        const active = n.href === '/panel' ? pathname === '/panel' : pathname.startsWith(n.href)
        return (
          <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className={styles.navItem}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONS[n.key]}
            </svg>
            <span>{n.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
