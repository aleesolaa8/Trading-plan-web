import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageHead } from '@/components/app/PageHead'
import { ReminderToggle } from '@/components/app/Reminders'
import ui from '@/components/app/ui.module.css'
import { getAccess, has, trialDaysLeft } from '@/lib/access'
import { stripeConfigured } from '@/lib/billing/stripe'
import { getPlans } from '@/lib/content'
import { getAccounts, getAssets, getProfile } from '@/lib/data'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { PlanPicker } from './PlanPicker'
import { Accounts, AssetsList, DeleteAccount, ProfileForm } from './Settings'
import styles from './ajustes.module.css'

export const metadata: Metadata = { title: 'Ajustes' }

const PAGO: Record<string, [string, string]> = {
  ok: ['notice-ok', '¡Gracias! Tu pago se ha completado. Tu plan se activa en unos segundos; si no lo ves, recarga la página.'],
  cancelado: ['notice-info', 'Has salido del pago sin completarlo. No se ha cobrado nada.'],
  error: ['notice-error', 'No hemos podido abrir la página de pago. Inténtalo de nuevo en unos minutos.'],
  pendiente: ['notice-info', 'Los pagos se activan muy pronto. Mientras tanto, sigues con tu plan actual.'],
  'sin-cliente': ['notice-info', 'Aún no tienes ninguna suscripción que gestionar.'],
}
const STATUS: Record<string, string> = {
  active: 'Activa',
  trialing: 'Activa',
  past_due: 'Pago pendiente',
  unpaid: 'Impagada',
  canceled: 'Cancelada',
  paused: 'En pausa',
  incomplete: 'Pendiente de pago',
  incomplete_expired: 'Caducada',
}
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—')

export default async function AjustesPage({ searchParams }: PageProps<'/panel/ajustes'>) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/panel/ajustes')
  const supabase = await createClient()
  const [sp, access, plans, profile, accounts, assets] = await Promise.all([
    searchParams,
    getAccess(),
    getPlans(),
    getProfile(user.id),
    getAccounts(user.id),
    getAssets(user.id),
  ])
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
  const [chat, draft, journal] = await Promise.all([
    supabase?.rpc('ai_quota', { p_kind: 'chat' }),
    supabase?.rpc('ai_quota', { p_kind: 'plan' }),
    supabase?.from('journal_entries').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', monthStart),
  ])
  const q = (r: typeof chat) => (r?.data ?? { used: 0, limit: 0 }) as { used: number; limit: number }
  const sub = access.subscription
  const subscribed = access.source === 'subscription' && !!sub
  const pago = typeof sp.pago === 'string' ? PAGO[sp.pago] : undefined
  const days = trialDaysLeft(access)
  const journalLimit = access.features.journal_entries_per_month

  return (
    <>
      <PageHead eyebrow="Cuenta" title="Ajustes">
        Tu plan, tu perfil, tus cuentas de trading y tus datos.
      </PageHead>
      {pago && (
        <p className={`notice ${pago[0]}`} role="status" style={{ marginBottom: 18 }}>
          {pago[1]}
        </p>
      )}

      <section id="plan" className={`card ${ui.section}`}>
        <div className={ui.secHead}>
          <span className={ui.secN}>Tu plan</span>
          {access.source === 'trial' && <span className="chip chip-blue">Prueba de Pro</span>}
        </div>
        <div className={styles.planNow}>
          <div>
            <h2 className={ui.h2}>
              {access.planName ?? 'Sin plan'}
              {subscribed && <span className="muted"> · {sub!.interval === 'year' ? 'anual' : 'mensual'}</span>}
            </h2>
            <p className="muted">
              {access.source === 'trial' &&
                `Te ${days === 1 ? 'queda 1 día' : `quedan ${days} días`} de prueba con todo Pro incluido. Después pasas a Free automáticamente, sin cobros.`}
              {access.source === 'free' && 'Gratis para siempre. Cuando quieras más, elige Core o Pro.'}
              {subscribed &&
                (sub!.cancel_at_period_end
                  ? `Cancelada: mantienes el acceso hasta el ${date(sub!.current_period_end)}. Después pasas a Free.`
                  : `${STATUS[sub!.status] ?? sub!.status} · se renueva el ${date(sub!.current_period_end)}.`)}
            </p>
          </div>
          {sub && (
            <form method="post" action="/api/stripe/portal">
              <button type="submit" className="btn btn-ghost btn-sm">
                Gestionar suscripción y facturas
              </button>
            </form>
          )}
        </div>
        {sub?.status === 'past_due' && (
          <p className="notice notice-warn">No hemos podido cobrar tu última cuota. Actualiza tu forma de pago en «Gestionar suscripción» para no perder el acceso.</p>
        )}

        <div className={ui.tiles}>
          <div className={ui.tile}>
            <span>Copiloto este mes</span>
            <b>{q(chat).limit >= 1000 ? 'Sin límite' : `${q(chat).used} / ${q(chat).limit}`}</b>
            <small>mensajes</small>
          </div>
          <div className={ui.tile}>
            <span>Journal este mes</span>
            <b>{journalLimit ? `${journal?.count ?? 0} / ${journalLimit}` : `${journal?.count ?? 0}`}</b>
            <small>{journalLimit ? 'entradas' : 'entradas · sin límite'}</small>
          </div>
          <div className={ui.tile}>
            <span>Redacciones con IA</span>
            <b>
              {q(draft).used} / {q(draft).limit}
            </b>
            <small>este mes</small>
          </div>
        </div>

        {(!subscribed || sub?.cancel_at_period_end) && (
          <>
            <h3>{access.source === 'trial' ? 'Elige tu plan cuando quieras' : 'Mejora tu plan'}</h3>
            {!stripeConfigured() && <p className="notice notice-info">Los pagos se activan muy pronto. Mientras tanto, puedes usar tu plan actual.</p>}
            <PlanPicker plans={plans} current={access.plan} subscribed={false} />
          </>
        )}
        {subscribed && !sub!.cancel_at_period_end && (
          <p className="muted" style={{ fontSize: 14 }}>
            Para cambiar entre Core y Pro, o entre mensual y anual, entra en «Gestionar suscripción». El cambio se prorratea solo.
          </p>
        )}
      </section>

      <section id="perfil" className={`card ${ui.section}`}>
        <span className={ui.secN}>Perfil</span>
        <ProfileForm name={profile.name} timezone={profile.timezone} />
        <p className="muted" style={{ fontSize: 14 }}>
          Email de acceso: <b>{user.email}</b>. El tema claro u oscuro se cambia con el botón de la luna.
        </p>
      </section>

      <section id="avisos" className={`card ${ui.section}`}>
        <span className={ui.secN}>Recordatorios</span>
        <p className="muted">Te avisamos 10 minutos antes de cada bloque de trading de tu calendario y al llegar a tu pérdida máxima del día.</p>
        <ReminderToggle />
      </section>

      <section id="cuentas" className={`card ${ui.section}`}>
        <span className={ui.secN}>Cuentas de trading</span>
        <Accounts accounts={accounts} max={Number(access.features.max_accounts ?? 1)} funded={has(access, 'funded_mode')} />
      </section>

      <section id="mercados" className={`card ${ui.section}`}>
        <span className={ui.secN}>Datos de tus mercados</span>
        <p className="muted">Valor por punto, lote mínimo y paso de lote de tu bróker. Los usa la calculadora.</p>
        <AssetsList assets={assets} />
      </section>

      <section id="datos" className={`card ${ui.section}`}>
        <span className={ui.secN}>Tus datos</span>
        <div className={ui.row}>
          {has(access, 'export_csv') ? (
            <a className="btn btn-ghost btn-sm" href="/api/export/journal" download>
              Descargar mi journal (CSV)
            </a>
          ) : (
            <span className="muted">Descargar tu journal en CSV está incluido en Core y Pro.</span>
          )}
        </div>
        <details className={styles.danger}>
          <summary>Eliminar mi cuenta</summary>
          <p className="muted">Se borran tu plan, calendario, journal, capturas y conversaciones. Si tienes una suscripción, se cancela. No se puede deshacer.</p>
          <DeleteAccount />
        </details>
      </section>
    </>
  )
}
