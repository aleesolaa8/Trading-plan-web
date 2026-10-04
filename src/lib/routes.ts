/** Rutas privadas: requieren sesión. (El control por suscripción llega en el paso 8.) */
export const PRIVATE_PREFIX = '/panel'
/** Rutas de acceso: si ya hay sesión, se redirige al panel. */
export const AUTH_ROUTES = ['/login', '/registro', '/recuperar']

/** Evita redirecciones abiertas: solo rutas internas. */
export function safeNext(next: string | null | undefined, fallback = PRIVATE_PREFIX): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
