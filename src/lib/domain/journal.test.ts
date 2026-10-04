import { describe, expect, it } from 'vitest'
import { addDays, breakdown, computeStats, type Entry, findPatterns, fundedStatus, monthEnd, weekStart } from './journal'
import { positionSize } from './risk'

let n = 0
const t = (p: Partial<Entry>): Entry => ({
  id: String(++n),
  type: 'trade',
  date: '2026-09-07',
  time: '10:00',
  asset: 'GER40',
  direction: 'long',
  resultR: 1,
  amount: null,
  emotion: 'tranquilo',
  compliance: 'si',
  error: 'ninguno',
  lesson: null,
  skipReason: null,
  accountId: null,
  ...p,
})

describe('positionSize', () => {
  it('redondea hacia abajo al paso de lote', () => {
    const r = positionSize({ balance: 10000, riskPct: 0.5, stop: 40, valuePerPoint: 1, minLot: 0.01, lotStep: 0.01 })
    expect(r.ok && r.lots).toBe(1.25)
    const r2 = positionSize({ balance: 10000, riskPct: 1, stop: 30, valuePerPoint: 1, minLot: 0.1, lotStep: 0.1 })
    expect(r2.ok && r2.lots).toBe(3.3) // 3,333 → 3,3
    expect(r2.ok && r2.realRisk).toBeCloseTo(99)
  })
  it('avisa cuando ni el lote mínimo cabe en el riesgo', () => {
    const r = positionSize({ balance: 500, riskPct: 0.5, stop: 100, valuePerPoint: 1, minLot: 0.1, lotStep: 0.1 })
    expect(r.ok && r.belowMin).toBe(true)
    expect(r.ok && r.lots).toBe(0)
    expect(r.ok && r.minLotRisk).toBe(10)
  })
  it('rechaza valores vacíos o negativos', () => {
    expect(positionSize({ balance: 0, riskPct: 1, stop: 1, valuePerPoint: 1, minLot: 1, lotStep: 1 }).ok).toBe(false)
  })
})

describe('journal', () => {
  it('resumen: cumplimiento, R y % ganadoras', () => {
    const s = computeStats([t({ resultR: 2 }), t({ resultR: -1, compliance: 'no' }), t({ type: 'skipped', resultR: null, compliance: null })])
    expect(s).toMatchObject({ trades: 2, skipped: 1, compliancePct: 50, totalR: 1, winPct: 50, avgR: 0.5 })
  })

  it('detecta el patrón tras una pérdida y el de emoción', () => {
    const e: Entry[] = []
    for (let d = 1; d <= 4; d++) {
      const date = `2026-09-0${d}`
      e.push(t({ date, time: '09:30', resultR: -1 }))
      e.push(t({ date, time: '10:00', resultR: -1, compliance: 'no', emotion: 'frustrado' }))
    }
    for (let i = 0; i < 6; i++) e.push(t({ date: `2026-09-1${i}`, resultR: 1.5 }))
    const ids = findPatterns(e).map((p) => p.id)
    expect(ids).toContain('after_loss')
    expect(ids).toContain('emotion_frustrado')
    const text = findPatterns(e).map((p) => p.text).join(' ')
    expect(text).not.toMatch(/tu problema|deber[íi]as|compra|vende/i)
  })

  it('no saca conclusiones con pocas operaciones', () => {
    expect(findPatterns([t({}), t({ resultR: -1 })])).toEqual([])
  })

  it('días sobre el máximo de operaciones y fuera de horario', () => {
    const e = Array.from({ length: 8 }, (_, i) => t({ date: i < 4 ? '2026-09-07' : '2026-09-08', time: i % 2 ? '16:00' : '09:30' }))
    const ids = findPatterns(e, { maxTrades: 3, sessions: [[540, 720]] }).map((p) => p.id)
    expect(ids).toEqual(expect.arrayContaining(['over_trades', 'outside_hours']))
  })

  it('desglose por día de la semana ordenado', () => {
    const b = breakdown([t({ date: '2026-09-08' }), t({ date: '2026-09-07' })], 'weekday')
    expect(b.map((x) => x.label)).toEqual(['Lunes', 'Martes'])
  })

  it('fondeo: margen diario y caída máxima', () => {
    const f = fundedStatus(
      { initial: 100000, dailyLossPct: 5, maxDrawdownPct: 10, profitTargetPct: 8 },
      [
        { date: '2026-09-07', amount: 2000, type: 'trade' },
        { date: '2026-09-08', amount: -4000, type: 'trade' },
      ],
      '2026-09-08',
    )
    expect(f.daily).toEqual({ limit: 5000, left: 1000, usedPct: 80 })
    expect(f.drawdown).toEqual({ limit: 10000, left: 8000, usedPct: 20 })
    expect(f.level).toBe('near')
    expect(f.target?.progressPct).toBe(0)
  })

  it('fechas: lunes de la semana y fin de mes', () => {
    expect(weekStart('2026-10-04')).toBe('2026-09-28') // domingo → lunes anterior
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(monthEnd('2026-02-10')).toBe('2026-02-28')
  })
})
