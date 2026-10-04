/* Tamaño de posición. Función pura: la usan la calculadora y sus pruebas. */

export type SizeInput = {
  balance: number
  riskPct: number
  stop: number // distancia del stop en puntos/pips
  valuePerPoint: number // valor de 1 punto con 1 lote, en la moneda de la cuenta
  minLot: number
  lotStep: number
}

export type SizeResult =
  | { ok: false; reason: 'invalid' }
  | {
      ok: true
      riskMoney: number // lo que el usuario quiere arriesgar
      lots: number // redondeado hacia abajo al paso
      realRisk: number // lo que arriesga de verdad con esos lotes
      realPct: number
      belowMin: boolean // ni el lote mínimo cabe en su riesgo
      minLotRisk: number // riesgo si opera el lote mínimo
      decimals: number
    }

export function stepDecimals(step: number): number {
  const s = String(step)
  if (s.includes('e-')) return Number(s.split('e-')[1])
  return Math.min(6, (s.split('.')[1] ?? '').length)
}

export function positionSize(i: SizeInput): SizeResult {
  const vals = [i.balance, i.riskPct, i.stop, i.valuePerPoint, i.minLot, i.lotStep]
  if (!vals.every((v) => Number.isFinite(v) && v > 0)) return { ok: false, reason: 'invalid' }
  const riskMoney = (i.balance * i.riskPct) / 100
  const raw = riskMoney / (i.stop * i.valuePerPoint)
  const decimals = stepDecimals(i.lotStep)
  // Hacia abajo al paso; el épsilon evita que 0,3 / 0,1 = 2,9999 se quede en 0,2
  const steps = Math.floor(raw / i.lotStep + 1e-9)
  const lots = Number((steps * i.lotStep).toFixed(decimals))
  const belowMin = lots < i.minLot
  const realRisk = belowMin ? 0 : lots * i.stop * i.valuePerPoint
  return {
    ok: true,
    riskMoney,
    lots: belowMin ? 0 : lots,
    realRisk,
    realPct: (realRisk / i.balance) * 100,
    belowMin,
    minLotRisk: i.minLot * i.stop * i.valuePerPoint,
    decimals,
  }
}

/** Convierte texto con coma o punto a número (NaN si no es válido). */
export function parseNum(v: string | number | null | undefined): number {
  if (typeof v === 'number') return v
  if (v == null) return NaN
  const t = v.trim().replace(/\s/g, '').replace(',', '.')
  return t === '' ? NaN : Number(t)
}
