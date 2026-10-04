import { describe, expect, it } from 'vitest'
import { buildChecklist, overlaps, proposeWeek, rulesSchema, sessionsOf, type RulesInput } from './plan'

const base: RulesInput = {
  name: 'Alex',
  markets: ['GER40', 'US100'],
  s1Start: '09:00',
  s1End: '12:30',
  s2Start: '15:30',
  s2End: '18:00',
  risk: '0,5',
  maxTrades: '3',
  maxLoss: '2',
  setup: 'Ruptura y retesteo',
  management: 'Stop bajo mínimo, objetivo 2R',
}
const parse = (over: Partial<RulesInput> = {}) => rulesSchema.safeParse({ ...base, ...over })

describe('reglas', () => {
  it('acepta reglas válidas y convierte la coma decimal', () => {
    const r = parse()
    expect(r.success && r.data.risk).toBe(0.5)
    expect(r.success && r.data.maxTrades).toBe(3)
  })
  it('exige al menos un mercado', () => expect(parse({ markets: [] }).success).toBe(false))
  it('limita el riesgo a 10 %', () => expect(parse({ risk: '12' }).success).toBe(false))
  it('detecta sesiones solapadas', () => {
    const r = parse({ s2Start: '11:00', s2End: '13:00' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]!.message).toMatch(/solapan/)
  })
  it('exige completar la sesión 2 si se empieza', () => expect(parse({ s2End: '' }).success).toBe(false))
  it('permite una sola sesión', () => {
    const r = parse({ s2Start: '', s2End: '' })
    expect(r.success && sessionsOf(r.data)).toEqual([[540, 750]])
  })
})

describe('checklist', () => {
  it('usa solo las reglas del usuario', () => {
    const r = parse()
    if (!r.success) throw new Error('reglas inválidas')
    const c = buildChecklist(r.data)
    expect(c[0]).toBe('Estoy dentro de mi horario (09:00–12:30 o 15:30–18:00)')
    expect(c).toContain('He calculado el tamaño con un riesgo de 0,5 % o menos')
    expect(c).toContain('No he llegado a mi pérdida máxima del día (−2 R)')
  })
})

describe('semana propuesta', () => {
  const r = parse()
  if (!r.success) throw new Error('reglas inválidas')
  const pro = proposeWeek({ nivel: 'profesional', tiempo_diario: 'h6_10', energia: 'variable' }, r.data)

  it('no genera solapes entre semana', () => {
    for (const d of [1, 2, 3, 4, 5]) expect(overlaps(pro, d)).toEqual([])
  })
  it('parte las sesiones largas con pausas activas', () => {
    expect(pro.filter((b) => b.type === 'pausa').length).toBeGreaterThan(0)
  })
  it('incluye vida: comida, sueño, desconexión y fin de semana', () => {
    const types = new Set(pro.map((b) => b.type))
    for (const t of ['comida', 'sueno', 'desconexion', 'personal'] as const) expect(types.has(t)).toBe(true)
    expect(pro.some((b) => b.days.includes(6))).toBe(true)
  })
  it('da formación a quien empieza con poco tiempo', () => {
    const short = parse({ s2Start: '', s2End: '', s1Start: '15:30', s1End: '17:00' })
    if (!short.success) throw new Error()
    const w = proposeWeek({ nivel: 'empezando', tiempo_diario: 'h2', energia: 'bien' }, short.data)
    expect(w.some((b) => b.type === 'formacion')).toBe(true)
    for (const d of [1, 2, 3, 4, 5]) expect(overlaps(w, d)).toEqual([])
  })
  it('todos los bloques caben en el día', () => {
    for (const b of pro) expect(b.start + b.duration).toBeLessThanOrEqual(1440)
  })
})

import { nowInZone, formatDuration } from './time'
describe('hora del usuario', () => {
  it('calcula día y minuto en Madrid', () => {
    // 2026-10-05 (lunes) 07:30 UTC = 09:30 en Madrid (horario de verano)
    const n = nowInZone('Europe/Madrid', new Date('2026-10-05T07:30:00Z'))
    expect(n).toEqual({ day: 1, minutes: 570, isoDate: '2026-10-05' })
  })
  it('formatea duraciones', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(90)).toBe('1 h 30 min')
    expect(formatDuration(120)).toBe('2 h')
  })
})
