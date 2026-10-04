'use server'

import { redirect } from 'next/navigation'
import { stripe, stripeConfigured } from '@/lib/billing/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

/** Borra la cuenta y todos sus datos (derecho de supresión). Cancela antes cualquier suscripción. */
export async function deleteMyAccount(confirmText: string): Promise<{ ok: boolean; message?: string } | void> {
  if (confirmText.trim().toUpperCase() !== 'ELIMINAR') return { ok: false, message: 'Escribe ELIMINAR para confirmar.' }
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()])
  const admin = createAdminClient()
  if (!user || !supabase) return { ok: false, message: 'Tu sesión ha caducado.' }
  if (!admin) return { ok: false, message: 'Ahora mismo no podemos borrar cuentas. Escríbenos y lo hacemos a mano.' }

  const { data: subs } = await supabase.from('subscriptions').select('id, status').eq('user_id', user.id)
  const live = (subs ?? []).filter((s) => ['active', 'trialing', 'past_due', 'paused', 'unpaid'].includes(s.status))
  if (live.length) {
    if (!stripeConfigured()) return { ok: false, message: 'Cancela antes tu suscripción desde «Gestionar suscripción».' }
    try {
      for (const s of live) await stripe().subscriptions.cancel(s.id)
    } catch {
      return { ok: false, message: 'No hemos podido cancelar tu suscripción. Inténtalo de nuevo en unos minutos.' }
    }
  }

  // Capturas del journal
  const { data: files } = await admin.storage.from('journal').list(user.id, { limit: 1000 })
  if (files?.length) await admin.storage.from('journal').remove(files.map((f) => `${user.id}/${f.name}`))

  // Borrar el usuario borra en cascada todos sus datos (on delete cascade)
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return { ok: false, message: 'No se ha podido borrar la cuenta. Inténtalo de nuevo.' }
  await supabase.auth.signOut()
  redirect('/?cuenta=eliminada')
}
