'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

/* Recordatorios en este dispositivo: 10 minutos antes de cada bloque de trading.
   Funcionan con la app abierta (pestaña o app instalada). Se guardan por dispositivo. */

const KEY = 'ttt-reminders'
const EVENT = 'ttt-reminders-change'

function read(): 'on' | 'off' | 'unsupported' {
  try {
    if (typeof Notification === 'undefined') return 'unsupported'
    return localStorage.getItem(KEY) === 'on' && Notification.permission === 'granted' ? 'on' : 'off'
  } catch {
    return 'off'
  }
}
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

export function ReminderToggle() {
  const state = useSyncExternalStore(subscribe, read, () => 'off' as const)
  const [denied, setDenied] = useState(false)
  if (state === 'unsupported') return <p className="muted">Este navegador no permite avisos. Prueba a instalar la app o usar Chrome, Edge o Safari.</p>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      {state === 'on' ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            try {
              localStorage.setItem(KEY, 'off')
            } catch {}
            window.dispatchEvent(new Event(EVENT))
          }}
        >
          Desactivar avisos en este dispositivo
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={async () => {
            const p = await Notification.requestPermission()
            if (p !== 'granted') return setDenied(true)
            try {
              localStorage.setItem(KEY, 'on')
            } catch {}
            window.dispatchEvent(new Event(EVENT))
            new Notification('Time to Trade', { body: 'Avisos activados. Te escribiremos antes de cada sesión.', icon: '/icon.svg' })
          }}
        >
          Activar avisos en este dispositivo
        </button>
      )}
      {state === 'on' && <span className="chip">Activados</span>}
      {denied && <span className="muted">El navegador ha bloqueado los avisos. Puedes permitirlos en la configuración del sitio.</span>}
    </div>
  )
}

function minutesIn(tz: string): number {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  return Number(p.find((x) => x.type === 'hour')?.value) * 60 + Number(p.find((x) => x.type === 'minute')?.value)
}

/** Programa los avisos de hoy. Se monta en el panel con los bloques de trading de hoy. */
export function Reminders({ blocks, timezone }: { blocks: { title: string; start: number }[]; timezone: string }) {
  const state = useSyncExternalStore(subscribe, read, () => 'off' as const)
  useEffect(() => {
    if (state !== 'on') return
    const now = minutesIn(timezone)
    const timers = blocks
      .map((b) => ({ b, at: b.start - 10 }))
      .filter(({ at }) => at > now)
      .map(({ b, at }) =>
        window.setTimeout(
          () => {
            try {
              new Notification('Tu sesión empieza en 10 minutos', {
                body: `${b.title}. Repasa tu checklist y calcula el tamaño antes de entrar.`,
                icon: '/icon.svg',
                tag: `block-${b.start}`,
              })
            } catch {}
          },
          (at - now) * 60_000 - new Date().getSeconds() * 1000,
        ),
      )
    return () => timers.forEach(clearTimeout)
  }, [state, blocks, timezone])
  return null
}

/** Aviso inmediato (p. ej. al llegar a la pérdida máxima del día). */
export function notifyNow(title: string, body: string) {
  if (read() !== 'on') return
  try {
    new Notification(title, { body, icon: '/icon.svg' })
  } catch {}
}
