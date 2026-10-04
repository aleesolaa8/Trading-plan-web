import { SCREEN_TYPES, type BlockType } from './plan'

/* Calendario: colocación de bloques que se solapan y avisos. Funciones puras. */

export type CalBlock = { id: string; title: string; type: BlockType; start: number; duration: number; days: number[]; notes?: string | null }

/** Columnas para bloques solapados de un día: cada grupo que se pisa se reparte el ancho. */
export function layoutDay(blocks: CalBlock[]): Map<string, { col: number; cols: number }> {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.duration - a.duration)
  const out = new Map<string, { col: number; cols: number }>()
  let cluster: CalBlock[] = []
  let clusterEnd = -1
  const flush = () => {
    const colsEnd: number[] = []
    const assigned: [string, number][] = []
    for (const b of cluster) {
      let c = colsEnd.findIndex((end) => end <= b.start)
      if (c === -1) {
        c = colsEnd.length
        colsEnd.push(0)
      }
      colsEnd[c] = b.start + b.duration
      assigned.push([b.id, c])
    }
    for (const [id, col] of assigned) out.set(id, { col, cols: colsEnd.length })
    cluster = []
  }
  for (const b of sorted) {
    if (cluster.length && b.start >= clusterEnd) flush()
    cluster.push(b)
    clusterEnd = Math.max(clusterEnd, b.start + b.duration)
  }
  if (cluster.length) flush()
  return out
}

/** Minutos de pantalla que el usuario dijo tener al día en el diagnóstico. */
export const SCREEN_LIMIT: Record<string, number> = { h2: 120, h3_6: 360, h6_10: 600 }

export function screenMinutes(blocks: CalBlock[], day: number): number {
  return blocks.filter((b) => b.days.includes(day) && SCREEN_TYPES.has(b.type)).reduce((s, b) => s + b.duration, 0)
}

export type CalWarning = { day: number; kind: 'overlap' | 'screen' | 'outside'; text: string }

export function calendarWarnings(
  blocks: CalBlock[],
  opts: { screenLimit?: number; sessions?: [number, number][] } = {},
): CalWarning[] {
  const out: CalWarning[] = []
  for (let day = 1; day <= 7; day++) {
    const bs = blocks.filter((b) => b.days.includes(day)).sort((a, b) => a.start - b.start)
    for (let i = 0; i < bs.length; i++)
      for (let j = i + 1; j < bs.length; j++)
        if (bs[j]!.start < bs[i]!.start + bs[i]!.duration)
          out.push({ day, kind: 'overlap', text: `«${bs[i]!.title}» y «${bs[j]!.title}» se solapan.` })
    const screen = screenMinutes(blocks, day)
    if (opts.screenLimit && screen > opts.screenLimit + 30)
      out.push({
        day,
        kind: 'screen',
        text: `${fmtH(screen)} de pantalla, más de lo que dijiste tener (${fmtH(opts.screenLimit)}). Puede pasar factura a tu concentración.`,
      })
    if (opts.sessions?.length)
      for (const b of bs.filter((x) => x.type === 'trading'))
        if (!opts.sessions.some(([s, e]) => b.start >= s && b.start + b.duration <= e))
          out.push({ day, kind: 'outside', text: `«${b.title}» queda fuera de las sesiones de tu plan.` })
  }
  return out
}

function fmtH(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export const snap = (min: number, step = 15) => Math.round(min / step) * step
export const clampBlock = (start: number, duration: number) => {
  const d = Math.max(5, Math.min(1440, duration))
  const s = Math.max(0, Math.min(1440 - d, start))
  return { start: s, duration: d }
}
