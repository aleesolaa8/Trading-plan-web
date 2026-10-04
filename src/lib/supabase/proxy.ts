import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseEnv } from '@/lib/env'
import { AUTH_ROUTES, PRIVATE_PREFIX } from '@/lib/routes'

/** Refresca la sesión en cada petición y protege las rutas privadas. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const env = supabaseEnv()
  const { pathname, search } = request.nextUrl
  const isPrivate = pathname === PRIVATE_PREFIX || pathname.startsWith(`${PRIVATE_PREFIX}/`)

  if (!env) {
    // Sin Supabase configurado no hay forma de entrar a la zona privada.
    if (isPrivate) return NextResponse.redirect(new URL('/login', request.url))
    return response
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // No poner código entre createServerClient y getClaims(): puede cerrar sesiones al azar.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims)

  const redirect = (to: URL) => {
    const res = NextResponse.redirect(to)
    response.cookies.getAll().forEach((c) => res.cookies.set(c))
    return res
  }

  if (isPrivate && !signedIn) {
    const to = new URL('/login', request.url)
    to.searchParams.set('next', pathname + search)
    return redirect(to)
  }
  // Crear contraseña nueva solo tiene sentido con la sesión que abre el enlace del email.
  if (pathname === '/nueva-contrasena' && !signedIn) {
    return redirect(new URL('/recuperar', request.url))
  }
  if (signedIn && AUTH_ROUTES.includes(pathname)) {
    return redirect(new URL(PRIVATE_PREFIX, request.url))
  }
  return response
}
