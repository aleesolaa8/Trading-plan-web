import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { planForPrice, stripe } from '@/lib/billing/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/* Stripe avisa aquí de cada cambio. Es la única vía por la que se da o se quita acceso de pago.
   - Firma comprobada con STRIPE_WEBHOOK_SECRET.
   - Idempotente: un evento repetido no hace nada.
   - Un evento antiguo que llegue tarde no pisa el estado nuevo (event_created). */

const HANDLED = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
])

type Admin = NonNullable<ReturnType<typeof createAdminClient>>

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const admin = createAdminClient()
  if (!secret || !admin || !process.env.STRIPE_SECRET_KEY) return new NextResponse('No configurado', { status: 503 })

  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(raw, req.headers.get('stripe-signature') ?? '', secret)
  } catch {
    return new NextResponse('Firma no válida', { status: 400 })
  }
  if (!HANDLED.has(event.type)) return NextResponse.json({ received: true, ignored: true })

  const { data: seen } = await admin.from('stripe_events').select('id').eq('id', event.id).maybeSingle()
  if (seen) return NextResponse.json({ received: true, duplicate: true })

  try {
    if (event.type === 'checkout.session.completed') await onCheckout(admin, event.data.object as Stripe.Checkout.Session)
    else await syncSubscription(admin, event.data.object as Stripe.Subscription, event.created)
  } catch (e) {
    console.error('stripe webhook', event.type, e)
    // 500 → Stripe lo reintenta más tarde
    return new NextResponse('Error al procesar', { status: 500 })
  }
  await admin.from('stripe_events').insert({ id: event.id, type: event.type })
  return NextResponse.json({ received: true })
}

async function onCheckout(admin: Admin, s: Stripe.Checkout.Session) {
  const userId = s.client_reference_id ?? s.metadata?.user_id
  const customer = typeof s.customer === 'string' ? s.customer : s.customer?.id
  if (!userId || !customer) return
  const { error } = await admin
    .from('stripe_customers')
    .upsert({ user_id: userId, stripe_customer_id: customer }, { onConflict: 'user_id' })
  if (error) throw error
}

async function syncSubscription(admin: Admin, sub: Stripe.Subscription, created: number) {
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  let userId = sub.metadata?.user_id ?? null
  if (!userId) {
    const { data } = await admin.from('stripe_customers').select('user_id').eq('stripe_customer_id', customer).maybeSingle()
    userId = data?.user_id ?? null
  }
  if (!userId) throw new Error(`Suscripción ${sub.id} sin usuario`)

  // Si el cliente aún no estaba guardado (los eventos pueden llegar en cualquier orden)
  await admin.from('stripe_customers').upsert({ user_id: userId, stripe_customer_id: customer }, { onConflict: 'user_id', ignoreDuplicates: true })

  const item = sub.items.data[0]
  const plan = planForPrice(item?.price.id) ?? (sub.metadata?.plan_id === 'core' || sub.metadata?.plan_id === 'pro' ? sub.metadata.plan_id : null)
  if (!plan) throw new Error(`Precio desconocido en ${sub.id}`)

  const { data: current } = await admin.from('subscriptions').select('event_created').eq('id', sub.id).maybeSingle()
  if (current && current.event_created > created) return

  const row = {
    id: sub.id,
    user_id: userId,
    plan_id: plan,
    status: sub.status,
    billing_interval: item?.price.recurring?.interval === 'year' ? 'year' : 'month',
    current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    event_created: created,
  }
  const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'id' })
  if (error) throw error
}
