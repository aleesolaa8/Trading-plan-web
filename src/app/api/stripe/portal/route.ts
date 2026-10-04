import { NextResponse, type NextRequest } from 'next/server'
import { stripe, stripeConfigured } from '@/lib/billing/stripe'
import { siteUrl } from '@/lib/env'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/** Portal de cliente de Stripe: cambiar de plan, tarjeta, facturas o cancelar. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin && origin !== siteUrl()) return new NextResponse('Origen no permitido', { status: 403 })
  const user = await getCurrentUser()
  const supabase = await createClient()
  if (!user || !supabase) return NextResponse.redirect(new URL('/login?next=/panel/ajustes', req.url), 303)
  const back = (q: string) => NextResponse.redirect(new URL(`/panel/ajustes?${q}#plan`, req.url), 303)
  if (!stripeConfigured()) return back('pago=pendiente')

  const { data: customer } = await supabase.from('stripe_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle()
  if (!customer) return back('pago=sin-cliente')
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      locale: 'es',
      return_url: `${siteUrl()}/panel/ajustes#plan`,
    })
    return NextResponse.redirect(session.url, 303)
  } catch (e) {
    console.error('stripe portal', e)
    return back('pago=error')
  }
}
