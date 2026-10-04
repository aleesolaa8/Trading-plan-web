import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { signOut } from '@/lib/auth/actions'
import { AppNav } from './AppNav'
import styles from './AppShell.module.css'

export function AppShell({ name, email, children }: { name: string; email: string | null; children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.side}>
        <Logo href="/panel" />
        <AppNav variant="side" />
        <div className={styles.sideFoot}>
          <div className={styles.user}>
            <b>{name}</b>
            {email && <span className="muted">{email}</span>}
          </div>
          <div className={styles.sideActions}>
            <ThemeToggle className={styles.iconBtn} />
            <form action={signOut}>
              <button type="submit" className="btn btn-ghost btn-sm">
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className={styles.top}>
        <div className={styles.topBrand}>
          <Logo href="/panel" />
        </div>
        <ThemeToggle className={styles.iconBtn} />
        <Link href="/panel/ajustes" className={styles.iconBtn} aria-label="Ajustes">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </Link>
      </header>

      <main id="contenido" className={styles.content}>
        <div className={styles.inner}>{children}</div>
      </main>
      <AppNav variant="bottom" />
    </div>
  )
}
