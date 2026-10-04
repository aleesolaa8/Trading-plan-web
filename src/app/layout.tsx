import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import { THEME_COOKIE } from '@/lib/theme'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Time to Trade · Tu plan de trading, por escrito', template: '%s · Time to Trade' },
  description:
    'Diagnóstico, plan escrito con tus reglas, calendario de vida, calculadora de riesgo y journal con patrones. Sin señales ni promesas.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#05070a',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Oscuro por defecto; el tema se guarda en cookie para pintarlo sin parpadeo.
  const theme = (await cookies()).get(THEME_COOKIE)?.value === 'light' ? 'light' : 'dark'
  return (
    <html lang="es" data-theme={theme} className={inter.variable}>
      <body>
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        <div className="bg-grid" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
