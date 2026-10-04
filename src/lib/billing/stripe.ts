import 'server-only'
import Stripe from 'stripe'

/* Stripe: suscripciones mensuales y anuales de Core y Pro.
   Los precios (price_xxx) se crean en el panel de Stripe y se pasan por variables de entorno. */

export type PaidPlan = 'core' | 'pro'
export type Interval = 'month' | 'year'

let client: Stripe | null = null

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function stripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY as string, { maxNetworkRetries: 2, timeout: 20_000 })
  return client
}

const PRICE_ENV: Record<PaidPlan, Record<Interval, string>> = {
  core: { month: 'STRIPE_PRICE_CORE', year: 'STRIPE_PRICE_CORE_ANNUAL' },
  pro: { month: 'STRIPE_PRICE_PRO', year: 'STRIPE_PRICE_PRO_ANNUAL' },
}

export function priceFor(plan: PaidPlan, interval: Interval): string | null {
  return process.env[PRICE_ENV[plan][interval]] || null
}

/** price_xxx → plan. Si el precio no es nuestro, null (no se da acceso). */
export function planForPrice(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null
  for (const plan of ['core', 'pro'] as const)
    for (const interval of ['month', 'year'] as const) if (priceFor(plan, interval) === priceId) return plan
  return null
}

/** IVA automático con Stripe Tax (requiere activarlo en el panel). Se puede apagar con STRIPE_AUTOMATIC_TAX=false. */
export function automaticTax(): boolean {
  return process.env.STRIPE_AUTOMATIC_TAX !== 'false'
}
