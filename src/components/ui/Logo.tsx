import Link from 'next/link'
import styles from './Logo.module.css'

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <span className={styles.mark} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.53} height={size * 0.53} viewBox="0 0 18 18">
        <rect x="2" y="7" width="3.2" height="7" rx="1" fill="currentColor" />
        <rect x="7.4" y="3" width="3.2" height="9" rx="1" fill="currentColor" />
        <rect x="12.8" y="1" width="3.2" height="7" rx="1" fill="currentColor" />
      </svg>
    </span>
  )
}

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className={styles.logo} aria-label="Time to Trade, inicio">
      <LogoMark />
      <span>
        Time to <span className="hl">Trade</span>
      </span>
    </Link>
  )
}
