import type { MetadataRoute } from 'next'

// Permite instalar Time to Trade como app (móvil y ordenador) desde el navegador.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Time to Trade',
    short_name: 'Time to Trade',
    description: 'Tu plan de trading, tu calendario y tu journal. Sin señales.',
    start_url: '/panel',
    scope: '/',
    display: 'standalone',
    background_color: '#05070a',
    theme_color: '#05070a',
    lang: 'es',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
