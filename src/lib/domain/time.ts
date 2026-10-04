/** Día de la semana (1 = lunes … 7 = domingo) y minuto del día en la zona horaria del usuario. */
export function nowInZone(timeZone: string, date = new Date()): { day: number; minutes: number; isoDate: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return {
    day: days.indexOf(get('weekday')) + 1,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    isoDate: `${get('year')}-${get('month')}-${get('day')}`,
  }
}

export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
