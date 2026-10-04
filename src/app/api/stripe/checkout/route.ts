import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { automaticTax, priceFor, stripe, stripeConfigured } from '@/lib/billing/stripe'
import { siteUrl } from '@/lib/env'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const body = z.object({ plan: z.enum(['core', 'pro']), interval: z.enum(['month', 'year']) })

const back = (req: NextRequest, q: string) => NextResponse.redirect(new URL(`/panel/ajustes?${q}#plan`, req.url), 303)

/** Formulario de Ajustes → página de pago de Stripe. */
export async function POST(req: NextRequest) {
  // Solo desde nuestra propia web
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin && origin !== siteUrl()) return new NextResponse('Origen no permitido', { status: 403 })

  const user = await getCurrentUser()
  const supabase = await createClient()
  if (!user || !supabase) return NextResponse.redirect(new URL('/login?next=/panel/ajustes', req.url), 303)

  const form = await req.formData()
  const p = body.safeParse({ plan: form.get('plan'), interval: form.get('interval') })
  if (!p.success) return back(req, 'pago=error')
  const price = priceFor(p.data.plan, p.data.interval)
  if (!stripeConfigured() || !price) return back(req, 'pago=pendiente')

  // ¿Ya paga? Cambiar de plan o de periodo se hace en el portal (prorratea solo)
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing', 'past_due'])
    .limit(1)
  if (subs?.length) return NextResponse.redirect(new URL('/api/stripe/portal', req.url), 307)

  const { data: customer } = await supabase.from('stripe_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle()
  const base = siteUrl()
  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id,
      ...(customer
        ? { customer: customer.stripe_customer_id, customer_update: { address: 'auto', name: 'auto' } }
        : { customer_email: user.email ?? undefined }),
      subscription_data: { metadata: { user_id: user.id, plan_id: p.data.plan } },
      metadata: { user_id: user.id, plan_id: p.data.plan },
      automatic_tax: { enabled: automaticTax() },
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      allow_promotion_codes: true,
      locale: 'es',
      success_url: `${base}/panel/ajustes?pago=ok#plan`,
      cancel_url: `${base}/panel/ajustes?pago=cancelado#plan`,
    })
    if (!session.url) return back(req, 'pago=error')
    return NextResponse.redirect(session.url, 303)
  } catch (e) {
    console.error('stripe checkout', e)
    return back(req, 'pago=error')
  }
}
