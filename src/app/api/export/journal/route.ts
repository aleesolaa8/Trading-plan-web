import { NextResponse } from 'next/server'
import { getAccess, has } from '@/lib/access'
import { getAccounts, getEntries } from '@/lib/data'
import { COMPLIANCE, EMOTIONS, ERRORS } from '@/lib/domain/journal'
import { getCurrentUser } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  // Evita fórmulas al abrir en Excel y escapa comillas
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
const n = (x: number | null) => (x == null ? '' : String(x).replace('.', ','))

/** Journal completo en CSV (separador ; para Excel en español). */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('No autorizado', { status: 401 })
  if (!has(await getAccess(), 'export_csv')) return new NextResponse('Incluido en Core y Pro', { status: 403 })
  const [entries, accounts] = await Promise.all([getEntries(user.id, { limit: 20000 }), getAccounts(user.id)])
  const acc = new Map(accounts.map((a) => [a.id, a.name]))
  const head = ['Fecha', 'Hora', 'Tipo', 'Cuenta', 'Mercado', 'Dirección', 'Resultado (R)', 'Resultado (dinero)', 'Emoción', 'Cumplí el plan', 'Error principal', 'Motivo (no realizada)', 'Lección']
  const rows = entries.map((e) => [
    e.date,
    e.time ?? '',
    e.type === 'trade' ? 'Operación' : 'No realizada',
    e.accountId ? (acc.get(e.accountId) ?? '') : '',
    e.asset,
    e.direction === 'long' ? 'Compra' : e.direction === 'short' ? 'Venta' : '',
    n(e.resultR),
    n(e.amount),
    e.emotion ? EMOTIONS[e.emotion] : '',
    e.compliance ? COMPLIANCE[e.compliance] : '',
    e.error ? ERRORS[e.error] : '',
    e.skipReason ?? '',
    e.lesson ?? '',
  ])
  const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="journal-time-to-trade-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
