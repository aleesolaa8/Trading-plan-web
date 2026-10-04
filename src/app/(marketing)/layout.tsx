import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { getCurrentUser } from '@/lib/supabase/server'

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <>
      <Header signedIn={Boolean(user)} />
      <main id="contenido">{children}</main>
      <Footer />
    </>
  )
}
