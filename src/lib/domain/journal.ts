/* ------------------------------------------------------------------ *
 * Journal: etiquetas, resumen, patrones y modo fondeo.
 * Funciones puras (se prueban sin base de datos).
 * Tono: observar sin juzgar. "Puede indicar", nunca "tu problema es".
 * ------------------------------------------------------------------ */

export const EMOTIONS = {
  tranquilo: 'Tranquilo/a',
  con_prisa: 'Con prisa',
  ansioso: 'Ansioso/a',
  aburrido: 'Aburrido/a',
  frustrado: 'Frustrado/a',
  cansado: 'Cansado/a',
} as const
export type Emotion = keyof typeof EMOTIONS

export const COMPLIANCE = { si: 'Sí', en_parte: 'En parte', no: 'No' } as const
export type Compliance = keyof typeof COMPLIANCE

export const ERRORS = {
  ninguno: 'Ninguno',
  entrada_anticipada: 'Entré antes de la señal',
  movi_sl: 'Moví el stop',
  mas_riesgo: 'Arriesgué más de lo previsto',
  cierre_anticipado: 'Cerré antes de tiempo',
  sobreopere: 'Operé de más',
} as const
export type MainError = keyof typeof ERRORS

export const ACCOUNT_KINDS = { personal: 'Personal', fondeo: 'Fondeo', demo: 'Demo' } as const
export type AccountKind = keyof typeof ACCOUNT_KINDS

export type Entry = {
  id: string
  type: 'trade' | 'skipped'
  date: string // YYYY-MM-DD
  time: string | null // HH:MM
  asset: string
  direction: 'long' | 'short' | null
  resultR: number | null
  amount: number | null
  emotion: Emotion | null
  compliance: Compliance | null
  error: MainError | null
  lesson: string | null
  skipReason: string | null
  accountId: string | null
}

export type Stats = {
  trades: number
  skipped: number
  compliancePct: number | null
  totalR: number
  winPct: number | null
  avgR: number | null
  totalAmount: number
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const pct = (a: number, b: number) => (b ? round((100 * a) / b, 1) : null)

export function computeStats(entries: Entry[]): Stats {
  const trades = entries.filter((e) => e.type === 'trade')
  const totalR = trades.reduce((s, e) => s + (e.resultR ?? 0), 0)
  return {
    trades: trades.length,
    skipped: entries.length - trades.length,
    compliancePct: pct(trades.filter((e) => e.compliance === 'si').length, trades.length),
    totalR: round(totalR),
    winPct: pct(trades.filter((e) => (e.resultR ?? 0) > 0).length, trades.length),
    avgR: trades.length ? round(totalR / trades.length) : null,
    totalAmount: round(trades.reduce((s, e) => s + (e.amount ?? 0), 0)),
  }
}

/* ---------- Desgloses (estadísticas avanzadas) ---------- */

export type Breakdown = { key: string; label: string; trades: number; totalR: number; avgR: number; winPct: number; compliancePct: number }
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function weekdayOf(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

export function breakdown(entries: Entry[], by: 'asset' | 'weekday' | 'emotion' | 'hour'): Breakdown[] {
  const groups = new Map<string, { label: string; list: Entry[]; order: number }>()
  for (const e of entries) {
    if (e.type !== 'trade') continue
    let key: string | null = null
    let label = ''
    let order = 0
    if (by === 'asset') [key, label] = [e.asset, e.asset]
    else if (by === 'weekday') {
      const d = weekdayOf(e.date)
      ;[key, label, order] = [String(d), WEEKDAYS[d - 1]!, d]
    } else if (by === 'emotion' && e.emotion) [key, label] = [e.emotion, EMOTIONS[e.emotion]]
    else if (by === 'hour' && e.time) {
      const h = Number(e.time.slice(0, 2))
      ;[key, label, order] = [String(h), `${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00`, h]
    }
    if (key == null) continue
    const g = groups.get(key) ?? { label, list: [], order }
    g.list.push(e)
    groups.set(key, g)
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      const s = computeStats(g.list)
      return { key, label: g.label, trades: s.trades, totalR: s.totalR, avgR: s.avgR ?? 0, winPct: s.winPct ?? 0, compliancePct: s.compliancePct ?? 0, order: g.order }
    })
    .sort((a, b) => (by === 'weekday' || by === 'hour' ? a.order - b.order : b.trades - a.trades))
    .map((x) => ({ key: x.key, label: x.label, trades: x.trades, totalR: x.totalR, avgR: x.avgR, winPct: x.winPct, compliancePct: x.compliancePct }))
}

/* ---------- Patrones ---------- */

export type Pattern = { id: string; tone: 'good' | 'watch'; title: string; text: string; tip: string }

const EMOTION_TIP: Record<Emotion, string> = {
  tranquilo: 'Fíjate en qué hiciste antes de esas sesiones (sueño, preparación) y repítelo.',
  con_prisa: 'Antes de entrar, lee tu checklist en voz alta. Si la prisa sigue, espera a la siguiente vela.',
  ansioso: 'Prueba tres respiraciones lentas antes de entrar y opera con la mitad de riesgo ese día.',
  aburrido: 'Si no hay setup, registra «no realizada» y pasa a backtesting: el aburrimiento busca acción, no tu plan.',
  frustrado: 'Tu pausa de 20 minutos está pensada para esto. Vuelve solo después de repasar el checklist.',
  cansado: 'Con poca energía, mitad de riesgo o solo análisis. Tu plan lo permite.',
}
const ERROR_TIP: Record<Exclude<MainError, 'ninguno'>, string> = {
  entrada_anticipada: 'Escribe la condición exacta de entrada en tu checklist y no entres hasta verla cerrada.',
  movi_sl: 'Decide antes de entrar dónde va el stop y cuándo se mueve. Durante la operación, solo ejecutas.',
  mas_riesgo: 'Calcula siempre el tamaño con la calculadora; el límite de tu plan aparece en rojo si lo superas.',
  cierre_anticipado: 'Deja escrito tu objetivo antes de entrar. Si quieres salir antes, que sea por una regla, no por miedo.',
  sobreopere: 'Al llegar a tu máximo de operaciones, cierra la plataforma. Ese es tu protocolo de límite diario.',
}

export type PatternRules = { maxTrades?: number; maxLoss?: number; sessions?: [number, number][] }

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const fmtR = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('es-ES', { maximumFractionDigits: 2 })} R`

/** Observaciones con datos suficientes. Mínimo de muestras para no sacar conclusiones de 1 operación. */
export function findPatterns(entries: Entry[], rules: PatternRules = {}): Pattern[] {
  const out: Pattern[] = []
  const trades = entries.filter((e) => e.type === 'trade').sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
  if (trades.length < 5) return out
  const all = computeStats(trades)

  // 1. Cumplir el plan frente a no cumplirlo
  const yes = trades.filter((e) => e.compliance === 'si')
  const no = trades.filter((e) => e.compliance === 'no' || e.compliance === 'en_parte')
  if (yes.length >= 3 && no.length >= 3) {
    const a = computeStats(yes).avgR ?? 0
    const b = computeStats(no).avgR ?? 0
    if (a > b)
      out.push({
        id: 'compliance',
        tone: 'good',
        title: 'Cumplir tu plan te sienta bien',
        text: `Cuando cumples tu plan, tu resultado medio es ${fmtR(a)}; cuando no, ${fmtR(b)}. Puede indicar que tus reglas funcionan cuando las sigues.`,
        tip: 'Antes de cada entrada, repasa tu checklist. Es la forma más directa de repetir lo que ya te funciona.',
      })
  }

  // 2. La operación siguiente a una pérdida (mismo día)
  const after: Entry[] = []
  for (let i = 1; i < trades.length; i++)
    if (trades[i]!.date === trades[i - 1]!.date && (trades[i - 1]!.resultR ?? 0) < 0) after.push(trades[i]!)
  if (after.length >= 3) {
    const c = computeStats(after).compliancePct ?? 0
    const g = all.compliancePct ?? 0
    if (g - c >= 15)
      out.push({
        id: 'after_loss',
        tone: 'watch',
        title: 'Después de una pérdida',
        text: `La operación que haces justo después de una pérdida cumple tu plan el ${c} % de las veces, frente al ${g} % en general. Puede indicar que la pérdida pesa en la siguiente decisión.`,
        tip: 'Tras cerrar en pérdida, pausa de 20 minutos lejos de la pantalla y checklist antes de volver.',
      })
  }

  // 3. Emoción con peor resultado
  const emo = breakdown(trades, 'emotion').filter((b) => b.trades >= 3 && b.key !== 'tranquilo')
  const worstEmo = emo.sort((a, b) => a.avgR - b.avgR)[0]
  if (worstEmo && worstEmo.avgR < (all.avgR ?? 0) - 0.2)
    out.push({
      id: `emotion_${worstEmo.key}`,
      tone: 'watch',
      title: `Cuando entras ${worstEmo.label.toLowerCase()}`,
      text: `En ${worstEmo.trades} operaciones con esa emoción tu resultado medio es ${fmtR(worstEmo.avgR)} y cumples el plan el ${worstEmo.compliancePct} %. Puede indicar que ese estado influye en cómo ejecutas.`,
      tip: EMOTION_TIP[worstEmo.key as Emotion],
    })

  // 4. Error más repetido
  const errs = new Map<string, number>()
  for (const e of trades) if (e.error && e.error !== 'ninguno') errs.set(e.error, (errs.get(e.error) ?? 0) + 1)
  const top = [...errs.entries()].sort((a, b) => b[1] - a[1])[0]
  if (top && top[1] >= 3 && top[1] / trades.length >= 0.2) {
    const key = top[0] as Exclude<MainError, 'ninguno'>
    out.push({
      id: `error_${key}`,
      tone: 'watch',
      title: `Se repite: «${ERRORS[key].toLowerCase()}»`,
      text: `Aparece en ${top[1]} de ${trades.length} operaciones. Es algo muy común y se trabaja con una regla concreta.`,
      tip: ERROR_TIP[key],
    })
  }

  // 5. Días por encima de los límites del plan
  const byDay = new Map<string, Entry[]>()
  for (const e of trades) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e])
  if (rules.maxTrades) {
    const over = [...byDay.values()].filter((d) => d.length > rules.maxTrades!).length
    if (over >= 2)
      out.push({
        id: 'over_trades',
        tone: 'watch',
        title: 'Días con más operaciones de las previstas',
        text: `En ${over} días superaste tu máximo de ${rules.maxTrades} operaciones. Puede indicar que, tras cierto punto, operas por inercia.`,
        tip: ERROR_TIP.sobreopere,
      })
  }
  if (rules.maxLoss) {
    const over = [...byDay.values()].filter((d) => d.reduce((s, e) => s + (e.resultR ?? 0), 0) < -rules.maxLoss!).length
    if (over >= 1)
      out.push({
        id: 'over_loss',
        tone: 'watch',
        title: 'Pérdida diaria por encima de tu límite',
        text: `En ${over} ${over === 1 ? 'día' : 'días'} la pérdida pasó de −${rules.maxLoss} R. Seguir operando después del límite suele agrandar el día malo.`,
        tip: 'Al llegar a tu pérdida máxima, cierra la plataforma. Mañana es otra sesión con la cabeza limpia.',
      })
  }

  // 6. Operaciones fuera del horario
  if (rules.sessions?.length) {
    const timed = trades.filter((e) => e.time)
    const outside = timed.filter((e) => !rules.sessions!.some(([s, en]) => toMin(e.time!) >= s && toMin(e.time!) < en))
    if (timed.length >= 5 && outside.length >= 2 && outside.length / timed.length >= 0.15) {
      const s = computeStats(outside)
      out.push({
        id: 'outside_hours',
        tone: 'watch',
        title: 'Operaciones fuera de tu horario',
        text: `${outside.length} de ${timed.length} operaciones fueron fuera de tus sesiones, con un resultado medio de ${fmtR(s.avgR ?? 0)}.`,
        tip: 'Fuera de tu ventana, el gráfico se cierra. Pon una alarma al final de cada sesión.',
      })
    }
  }

  // 7. Decir que no también cuenta
  const skipped = entries.filter((e) => e.type === 'skipped').length
  if (skipped >= 3)
    out.push({
      id: 'skipped',
      tone: 'good',
      title: 'Sabes decir que no',
      text: `Has registrado ${skipped} operaciones no realizadas. No entrar cuando no se cumple tu setup también es cumplir tu plan.`,
      tip: 'Sigue apuntándolas: con el tiempo verás cuánto te ahorran.',
    })

  return out
}

/* ---------- Modo fondeo ---------- */

export type FundedRules = { initial: number; dailyLossPct: number | null; maxDrawdownPct: number | null; profitTargetPct: number | null }
export type FundedStatus = {
  todayPL: number
  totalPL: number
  daily: { limit: number; left: number; usedPct: number } | null
  drawdown: { limit: number; left: number; usedPct: number } | null
  target: { amount: number; progressPct: number } | null
  level: 'ok' | 'near' | 'breached'
}

/** Caída máxima estática (desde el capital inicial) y pérdida diaria desde el inicio del día. */
export function fundedStatus(rules: FundedRules, entries: Pick<Entry, 'date' | 'amount' | 'type'>[], today: string): FundedStatus {
  const trades = entries.filter((e) => e.type === 'trade')
  const todayPL = round(trades.filter((e) => e.date === today).reduce((s, e) => s + (e.amount ?? 0), 0))
  const totalPL = round(trades.reduce((s, e) => s + (e.amount ?? 0), 0))
  const gauge = (pctOf: number | null, pl: number) => {
    if (!pctOf) return null
    const limit = round((rules.initial * pctOf) / 100)
    const loss = Math.max(0, -pl)
    return { limit, left: round(Math.max(0, limit - loss)), usedPct: round(Math.min(100, (loss / limit) * 100), 1) }
  }
  const daily = gauge(rules.dailyLossPct, todayPL)
  const drawdown = gauge(rules.maxDrawdownPct, totalPL)
  const target = rules.profitTargetPct
    ? (() => {
        const amount = round((rules.initial * rules.profitTargetPct) / 100)
        return { amount, progressPct: round(Math.max(0, Math.min(100, (totalPL / amount) * 100)), 1) }
      })()
    : null
  const used = Math.max(daily?.usedPct ?? 0, drawdown?.usedPct ?? 0)
  return { todayPL, totalPL, daily, drawdown, target, level: used >= 100 ? 'breached' : used >= 70 ? 'near' : 'ok' }
}

/* ---------- Fechas ---------- */

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** Lunes de la semana de esa fecha. */
export function weekStart(iso: string): string {
  return addDays(iso, 1 - weekdayOf(iso))
}
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}
export function monthEnd(iso: string): string {
  const [y, m] = iso.slice(0, 7).split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}
export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { ...opts, timeZone: 'UTC' })
}
export { fmtR }
