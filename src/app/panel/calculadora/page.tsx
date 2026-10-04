import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageHead } from '@/components/app/PageHead'
import { getAccounts, getAssets, getEntries, getPlanContent, getToday } from '@/lib/data'
import { computeStats, fmtR } from '@/lib/domain/journal'
import { getCurrentUser } from '@/lib/supabase/server'
import { Calculator } from './Calculator'

export const metadata: Metadata = { title: 'Calculadora' }

export default async function CalculadoraPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/panel/calculadora')
  const today = await getToday(user.id)
  const [plan, assets, accounts, todays] = await Promise.all([
    getPlanContent(user.id),
    getAssets(user.id),
    getAccounts(user.id),
    getEntries(user.id, { from: today.isoDate, to: today.isoDate }),
  ])
  const rules = plan?.rules
  const s = computeStats(todays)
  const stopTrades = rules && s.trades >= rules.maxTrades
  const stopLoss = rules && s.totalR <= -rules.maxLoss

  return (
    <>
      <PageHead eyebrow="Riesgo" title={<>Calcula <span className="hl-grad">antes</span> de entrar.</>}>
        El tamaño exacto con los datos de tu bróker, y tu checklist justo al lado.
      </PageHead>
      {rules && (
        <p className={`notice ${stopTrades || stopLoss ? 'notice-error' : 'notice-info'}`} role="status" style={{ marginBottom: 16 }}>
          {stopTrades || stopLoss
            ? `Has llegado a tu límite de hoy (${stopTrades ? `${s.trades} de ${rules.maxTrades} operaciones` : `${fmtR(s.totalR)} de −${rules.maxLoss} R`}). Tu protocolo: cierra la plataforma. Mañana, más.`
            : `Hoy: ${s.trades} de ${rules.maxTrades} operaciones · ${fmtR(s.totalR)} (límite −${rules.maxLoss} R) · riesgo de tu plan ${rules.risk.toLocaleString('es-ES')} %`}
        </p>
      )}
      <Calculator
        assets={assets}
        accounts={accounts}
        planMarkets={rules?.markets ?? []}
        planRisk={rules?.risk ?? null}
        checklist={plan?.checklist ?? []}
      />
    </>
  )
}
