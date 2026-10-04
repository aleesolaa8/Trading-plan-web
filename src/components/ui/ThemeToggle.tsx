'use client'

import { THEME_COOKIE } from '@/lib/theme'

export function ThemeToggle({ className, label }: { className?: string; label?: string }) {
  function toggle() {
    const root = document.documentElement
    const next = root.dataset.theme === 'light' ? 'dark' : 'light'
    root.dataset.theme = next
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  }
  return (
    <button type="button" className={className} onClick={toggle} aria-label="Cambiar entre tema claro y oscuro">
      {label ?? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}
