import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseEnv } from '@/lib/env'

/** Cliente para Server Components, Server Actions y Route Handlers. Respeta RLS con la sesión del usuario. */
export async function createClient() {
  const env = supabaseEnv()
  if (!env) return null
  const cookieStore = await cookies()

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Llamado desde un Server Component: el proxy ya refresca la sesión.
        }
      },
    },
  })
}

/** Usuario verificado (firma del JWT comprobada). Nunca confiar en getSession() en servidor. */
export async function getCurrentUser() {
  const supabase = await createClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return null
  const meta = (data.claims.user_metadata ?? {}) as { display_name?: string }
  return {
    id: data.claims.sub,
    email: (data.claims.email as string | undefined) ?? null,
    name: meta.display_name ?? null,
  }
}
