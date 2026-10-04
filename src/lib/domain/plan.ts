import { z } from 'zod'

/* ------------------------------------------------------------------ *
 * Tipos y reglas del plan. Funciones puras: se prueban sin base de datos.
 * ------------------------------------------------------------------ */

export const LEVEL_LABEL: Record<string, string> = {
  empezando: 'Empezando',
  desarrollo: 'En desarrollo',
  consolidado: 'Consolidado',
  profesional: 'Profesional',
}

/** Respuestas del diagnóstico: slug de pregunta → slug de opción. */
export type Answers = Record<string, string>

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato de hora HH:MM.')
  .or(z.literal(''))

const decimal = (msg: string) =>
  z.preprocess((v) => (typeof v === 'string' ? Number(v.replace(',', '.')) : v), z.number({ error: msg }))

/** Reglas que escribe el usuario. La IA (paso 4) solo las redacta; nunca inventa. */
export const rulesSchema = z
  .object({
    name: z.string().trim().max(40, 'El nombre es demasiado largo.'),
    markets: z
      .array(z.string().trim().min(1).max(30))
      .min(1, 'Elige al menos un mercado.')
      .max(20, 'Elige como máximo 20 mercados.'),
    s1Start: time.refine((v) => v !== '', 'Indica la hora de inicio de tu sesión.'),
    s1End: time.refine((v) => v !== '', 'Indica la hora de fin de tu sesión.'),
    s2Start: time,
    s2End: time,
    risk: decimal('Escribe tu riesgo por operación.').pipe(
      z.number().gt(0, 'El riesgo debe ser mayor que 0.').max(10, 'El riesgo máximo permitido es 10 %.'),
    ),
    maxTrades: decimal('Indica tu máximo de operaciones al día.').pipe(
      z.number().int('Usa un número entero.').min(1, 'Mínimo 1 operación.').max(50, 'Máximo 50 operaciones.'),
    ),
    maxLoss: decimal('Indica tu pérdida máxima diaria en R.').pipe(
      z.number().gt(0, 'La pérdida máxima debe ser mayor que 0.').max(50, 'Máximo 50 R.'),
    ),
    setup: z.string().trim().max(800, 'Máximo 800 caracteres.'),
    management: z.string().trim().max(800, 'Máximo 800 caracteres.'),
  })
  .superRefine((r, ctx) => {
    const s1 = toMin(r.s1Start)
    const e1 = toMin(r.s1End)
    if (s1 != null && e1 != null && e1 <= s1)
      ctx.addIssue({ code: 'custom', path: ['s1End'], message: 'El fin debe ser posterior al inicio.' })
    const s2 = toMin(r.s2Start)
    const e2 = toMin(r.s2End)
    if ((s2 == null) !== (e2 == null))
      ctx.addIssue({ code: 'custom', path: ['s2End'], message: 'Completa la sesión 2 con inicio y fin, o déjala vacía.' })
    else if (s2 != null && e2 != null) {
      if (e2 <= s2) ctx.addIssue({ code: 'custom', path: ['s2End'], message: 'El fin debe ser posterior al inicio.' })
      else if (s1 != null && e1 != null && s2 < e1 && s1 < e2)
        ctx.addIssue({ code: 'custom', path: ['s2Start'], message: 'Las dos sesiones se solapan.' })
    }
  })

export type Rules = z.output<typeof rulesSchema>
export type RulesInput = z.input<typeof rulesSchema>

export function toMin(t: string | null | undefined): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function hhmm(min: number): string {
  const m = Math.max(0, Math.min(1440, Math.round(min)))
  if (m === 1440) return '24:00'
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function sessionsOf(r: Pick<Rules, 's1Start' | 's1End' | 's2Start' | 's2End'>): [number, number][] {
  return (
    [
      [toMin(r.s1Start), toMin(r.s1End)],
      [toMin(r.s2Start), toMin(r.s2End)],
    ] as const
  ).filter((s): s is [number, number] => s[0] != null && s[1] != null && s[1] > s[0]).map(([a, b]) => [a, b])
}

const fmtNum = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 })

/** Checklist antes de cada entrada, construido solo con las reglas del usuario. */
export function buildChecklist(r: Rules): string[] {
  const win = sessionsOf(r)
    .map(([s, e]) => `${hhmm(s)}–${hhmm(e)}`)
    .join(' o ')
  return [
    `Estoy dentro de mi horario (${win})`,
    'El setup cumple exactamente lo que tengo escrito',
    `He calculado el tamaño con un riesgo de ${fmtNum(r.risk)} % o menos`,
    `Llevo menos de ${r.maxTrades} operaciones hoy`,
    `No he llegado a mi pérdida máxima del día (−${fmtNum(r.maxLoss)} R)`,
    'Mi energía está bien. Si no, mitad de riesgo o solo análisis',
    'Sé dónde está mi stop y mi salida antes de entrar',
  ]
}

/* ------------------------------------------------------------------ *
 * Semana propuesta (el usuario la ajusta después en el calendario)
 * ------------------------------------------------------------------ */

export const BLOCK_TYPES = {
  trading: 'Trading',
  analisis: 'Análisis',
  backtesting: 'Backtesting',
  formacion: 'Formación',
  revision: 'Revisión',
  comida: 'Comida',
  ejercicio: 'Ejercicio',
  sueno: 'Sueño',
  pausa: 'Pausa',
  personal: 'Personal',
  desconexion: 'Desconexión',
  otro: 'Otro',
} as const
export type BlockType = keyof typeof BLOCK_TYPES
export const SCREEN_TYPES: ReadonlySet<BlockType> = new Set(['trading', 'analisis', 'backtesting', 'formacion', 'revision'])

export type ProposedBlock = { title: string; type: BlockType; start: number; duration: number; days: number[] }

const WEEKDAYS = [1, 2, 3, 4, 5]
const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7]

export function proposeWeek(answers: Answers, r: Rules): ProposedBlock[] {
  const out: ProposedBlock[] = []
  const add = (title: string, type: BlockType, start: number, duration: number, days = WEEKDAYS) => {
    if (!(duration > 0)) return
    const s = Math.max(5 * 60, Math.round(start / 5) * 5)
    const d = Math.min(duration, 1440 - s)
    if (d >= 5) out.push({ title, type, start: s, duration: d, days: [...days] })
  }
  const sessions = sessionsOf(r)
  if (!sessions.length) return out
  const firstStart = sessions[0]![0]
  const lastEnd = sessions[sessions.length - 1]![1]
  const short = answers.tiempo_diario === 'h2'
  const long = answers.tiempo_diario === 'h6_10'
  const study = answers.nivel === 'empezando' || answers.nivel === 'desarrollo'
  const senior = answers.nivel === 'consolidado' || answers.nivel === 'profesional'
  const mk = r.markets.slice(0, 2).join(' · ')

  add('Despertar y movimiento', 'ejercicio', Math.min(7 * 60 + 30, firstStart - 150), answers.energia === 'bien' ? 20 : 30)
  add(
    short ? 'Repasar el análisis preparado' : 'Análisis y checklist pre-sesión',
    'analisis',
    firstStart - (short ? 20 : 45),
    short ? 15 : 40,
  )
  sessions.forEach(([s, e], i) => {
    const label = `Sesión ${sessions.length > 1 ? `${i + 1} · ` : ''}${mk}`
    if (e - s <= 120) return add(label, 'trading', s, e - s)
    // Jornadas largas: bloques de 90 min con pausa activa de 10
    let t = s
    while (t < e) {
      let end = Math.min(e, t + 90)
      if (e - end < 40) end = e
      add(label, 'trading', t, end - t)
      if (end < e) {
        add('Pausa activa: levántate y muévete', 'pausa', end, 10)
        t = end + 10
      } else t = end
    }
  })
  const gap = sessions.length > 1 ? sessions[1]![0] - sessions[0]![1] : 0
  if (gap >= 60) add('Comida lejos de la pantalla', 'comida', sessions[0]![1] + 10, 45)
  else {
    const lunch =
      [13 * 60 + 30, 14 * 60 + 30, 12 * 60 + 30, 15 * 60, 16 * 60].find(
        (t) => !sessions.some(([s, e]) => t < e + 5 && s < t + 50),
      ) ?? 12 * 60
    add('Comida lejos de la pantalla', 'comida', lunch, 45)
  }
  add('Revisión del día y journal', 'revision', lastEnd + 10, 20)
  let tail = lastEnd + 30
  if (!short) {
    const d = long ? 60 : 45
    add(study ? 'Backtesting y formación' : 'Análisis de métricas', study ? 'backtesting' : 'revision', tail + 10, d)
    tail += 10 + d
  } else if (study) add('Formación (20 min)', 'formacion', 21 * 60 + 30, 20)
  add('Desconexión: plataformas cerradas', 'desconexion', tail, 15)
  add('Pantallas fuera · rutina de sueño', 'sueno', 22 * 60 + 45, 30, EVERY_DAY)
  add('Revisión semanal del journal', 'revision', 10 * 60 + 30, senior ? 75 : 45, [6])
  add('Tiempo libre / familia', 'personal', 17 * 60, 120, [6, 7])
  add('Preparar la semana: agenda y niveles', 'analisis', 19 * 60, 40, [7])
  return out
}

/** Pares de bloques que se solapan en un mismo día. */
export function overlaps(blocks: { start: number; duration: number; days: number[]; title: string }[], day: number) {
  const bs = blocks.filter((b) => b.days.includes(day)).sort((a, b) => a.start - b.start)
  const out: [string, string][] = []
  for (let i = 0; i < bs.length; i++)
    for (let j = i + 1; j < bs.length; j++)
      if (bs[j]!.start < bs[i]!.start + bs[i]!.duration) out.push([bs[i]!.title, bs[j]!.title])
  return out
}

/** Contenido guardado en plan_versions.content */
export type PlanContent = {
  level: string | null
  time: string | null
  rules: Rules
  checklist: string[]
}

export function buildPlanContent(answers: Answers, rules: Rules): PlanContent {
  return { level: answers.nivel ?? null, time: answers.tiempo_diario ?? null, rules, checklist: buildChecklist(rules) }
}
