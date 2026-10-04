import { describe, expect, it } from 'vitest'
import { needsCrisisHelp, violatesPolicy } from './guardrails'

describe('detección de crisis', () => {
  it('detecta expresiones de riesgo', () => {
    expect(needsCrisisHelp('a veces pienso en quitarme la vida')).toBe(true)
    expect(needsCrisisHelp('Quiero hacerme daño')).toBe(true)
  })
  it('no salta con frustración normal de trading', () => {
    expect(needsCrisisHelp('he perdido 3R hoy y estoy fatal')).toBe(false)
    expect(needsCrisisHelp('quiero acabar la sesión ya')).toBe(false)
  })
})

describe('política de respuestas', () => {
  it('bloquea órdenes de mercado y promesas', () => {
    expect(violatesPolicy('Compra ya, es tu momento')).toBe(true)
    expect(violatesPolicy('Te recomiendo vender el oro')).toBe(true)
    expect(violatesPolicy('Con esto tienes rentabilidad garantizada')).toBe(true)
    expect(violatesPolicy('El precio va a subir mañana')).toBe(true)
  })
  it('permite hablar del proceso', () => {
    expect(violatesPolicy('Repasa tu checklist antes de decidir si entras.')).toBe(false)
    expect(violatesPolicy('No operar también es cumplir tu plan.')).toBe(false)
    expect(violatesPolicy('¿Cumple tu setup? Si no, mejor esperar.')).toBe(false)
  })
})
