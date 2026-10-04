import { NextResponse, type NextRequest } from 'next/server'
import { safeNext } from '@/lib/routes'
import { createClient } from '@/lib/supabase/server'

/** Destino de los enlaces de email (confirmación de cuenta y recuperación de contraseña). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? { error: true }
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }
  return NextResponse.redirect(new URL('/login?error=enlace', origin))
}
