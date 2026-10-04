import 'server-only'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { supabaseEnv } from '@/lib/env'

/** Cliente con permisos totales (service role). Solo para el webhook de pagos y borrar cuentas.
 *  Nunca se usa con datos que mande el navegador sin comprobar antes quién es el usuario. */
export function createAdminClient() {
  const env = supabaseEnv()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!env || !key) return null
  return createSupabase(env.url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
