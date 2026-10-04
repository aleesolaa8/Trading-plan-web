'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useTransition } from 'react'
import ui from '@/components/app/ui.module.css'
import { calendarWarnings, clampBlock, layoutDay, screenMinutes, snap, type CalBlock } from '@/lib/domain/calendar'
import { BLOCK_TYPES, hhmm, toMin, type BlockType } from '@/lib/domain/plan'
import { formatDuration } from '@/lib/domain/time'
import { deleteBlock, moveBlock, resetWeek, saveBlock } from './actions'
import styles from './calendar.module.css'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAYS_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const H = 52 // píxeles por hora

type Draft = { id?: string; title: string; type: BlockType; start: number; duration: number; days: number[]; notes: string }
type Drag = { id: string; mode: 'move' | 'resize'; y0: number; x0: number; start: number; duration: number; day: number; newDay: number; moved: boolean }

export function WeekCalendar({
  initial,
  today,
  nowMin,
  screenLimit,
  sessions,
}: {
  initial: CalBlock[]
  today: number
  nowMin: number
  screenLimit?: number
  sessions: [number, number][]
}) {
  const router = useRouter()
  const [blocks, setBlocks] = useState(initial)
  const [sel, setSel] = useState(today)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const cols = useRef<(HTMLDivElement | null)[]>([])
  const dlg = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const keyTimer = useRef<number | undefined>(undefined)
  const pointer = useRef('mouse')

  const from = Math.min(5 * 60, Math.floor(Math.min(...blocks.map((b) => b.start), 24 * 60) / 60) * 60)
  const to = 24 * 60
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from / 60 + i)
  const warnings = useMemo(() => calendarWarnings(blocks, { screenLimit, sessions }), [blocks, screenLimit, sessions])

  // Bloque tal y como se ve mientras se arrastra
  const view = (b: CalBlock): CalBlock =>
    drag && drag.id === b.id ? { ...b, start: drag.start, duration: drag.duration, days: drag.newDay !== drag.day ? [drag.newDay] : b.days } : b

  const commit = (id: string, startMin: number, duration: number, days?: number[]) => {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, start: startMin, duration, days: days ?? b.days } : b)))
    start(async () => {
      const r = await moveBlock(id, startMin, duration, days)
      if (!r.ok) {
        setMsg(r.message ?? 'No se ha podido mover.')
        setBlocks(initial)
      } else router.refresh()
    })
  }

  const onDown = (e: React.PointerEvent, b: CalBlock, day: number, mode: Drag['mode']) => {
    // En pantallas táctiles se edita con flechas; el arrastre es para ratón y lápiz
    pointer.current = e.pointerType
    if (e.pointerType === 'touch' || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const d: Drag = { id: b.id, mode, y0: e.clientY, x0: e.clientX, start: b.start, duration: b.duration, day, newDay: day, moved: false }
    dragRef.current = d
    setDrag(d)
    const move = (ev: PointerEvent) => {
      const cur = dragRef.current!
      const dmin = snap(((ev.clientY - cur.y0) / H) * 60)
      const orig = blocks.find((x) => x.id === cur.id)!
      let next: Drag = { ...cur, moved: cur.moved || Math.abs(ev.clientY - cur.y0) > 4 || Math.abs(ev.clientX - cur.x0) > 8 }
      if (cur.mode === 'move') {
        next = { ...next, ...clampBlock(snap(orig.start + dmin, 5), orig.duration) }
        if (orig.days.length === 1) {
          const idx = cols.current.findIndex((c) => {
            if (!c || c.offsetParent === null) return false
            const r = c.getBoundingClientRect()
            return ev.clientX >= r.left && ev.clientX < r.right
          })
          if (idx >= 0) next.newDay = idx + 1
        }
      } else next = { ...next, duration: clampBlock(orig.start, Math.max(15, snap(orig.duration + dmin))).duration }
      dragRef.current = next
      setDrag(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const cur = dragRef.current!
      dragRef.current = null
      setDrag(null)
      const orig = blocks.find((x) => x.id === cur.id)!
      if (!cur.moved) return openEdit(orig)
      const days = cur.newDay !== cur.day ? [cur.newDay] : undefined
      if (cur.start !== orig.start || cur.duration !== orig.duration || days) commit(cur.id, cur.start, cur.duration, days)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onKey = (e: React.KeyboardEvent, b: CalBlock) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const delta = e.key === 'ArrowUp' ? -15 : 15
    const next = e.shiftKey ? clampBlock(b.start, Math.max(15, b.duration + delta)) : clampBlock(b.start + delta, b.duration)
    setBlocks((bs) => bs.map((x) => (x.id === b.id ? { ...x, ...next } : x)))
    window.clearTimeout(keyTimer.current)
    keyTimer.current = window.setTimeout(() => commit(b.id, next.start, next.duration), 500)
  }

  const openEdit = (b?: CalBlock, preset?: Partial<Draft>) => {
    setMsg(null)
    setDraft(
      b
        ? { id: b.id, title: b.title, type: b.type, start: b.start, duration: b.duration, days: b.days, notes: b.notes ?? '' }
        : { title: '', type: 'trading', start: 9 * 60, duration: 60, days: [sel], notes: '', ...preset },
    )
    dlg.current?.showModal()
  }

  const onColClick = (e: React.MouseEvent<HTMLDivElement>, day: number) => {
    if (e.target !== e.currentTarget) return
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    const startMin = clampBlock(snap(from + (y / H) * 60, 15), 60).start
    openEdit(undefined, { start: startMin, days: [day] })
  }

  const nudge = (k: 'start' | 'duration', d: number) =>
    setDraft((x) => {
      if (!x) return x
      const n = k === 'start' ? clampBlock(x.start + d, x.duration) : clampBlock(x.start, Math.max(5, x.duration + d))
      return { ...x, ...n }
    })

  const save = () =>
    draft &&
    start(async () => {
      const r = await saveBlock(draft)
      if (!r.ok) return setMsg(r.message ?? 'No se ha podido guardar.')
      const saved: CalBlock = { ...draft, id: r.id ?? draft.id ?? crypto.randomUUID(), days: [...draft.days].sort() }
      setBlocks((bs) => (draft.id ? bs.map((b) => (b.id === draft.id ? saved : b)) : [...bs, saved]))
      dlg.current?.close()
      router.refresh()
    })

  const remove = () =>
    draft?.id &&
    start(async () => {
      const r = await deleteBlock(draft.id!)
      if (!r.ok) return setMsg(r.message ?? 'No se ha podido borrar.')
      setBlocks((bs) => bs.filter((b) => b.id !== draft.id))
      dlg.current?.close()
      router.refresh()
    })

  return (
    <>
      <div className={`${ui.row} ${styles.toolbar}`}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => openEdit()}>
          + Añadir bloque
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={pending}
          onClick={() => {
            if (!confirm('Se sustituirá tu semana por la propuesta a partir de tu plan. ¿Continuar?')) return
            start(async () => {
              const r = await resetWeek()
              if (!r.ok) setMsg(r.message ?? 'No se ha podido restablecer.')
              else window.location.reload()
            })
          }}
        >
          Restablecer semana propuesta
        </button>
        <span className={`muted ${styles.hint}`}>
          Arrastra un bloque para moverlo o su borde inferior para alargarlo. En el móvil, tócalo y usa las flechas.
        </span>
      </div>
      {msg && !draft && (
        <p className="notice notice-error" role="alert" style={{ marginBottom: 12 }}>
          {msg}
        </p>
      )}

      <div className={styles.dayTabs} role="tablist" aria-label="Día">
        {DAYS.map((d, i) => (
          <button key={d} type="button" role="tab" aria-selected={sel === i + 1} onClick={() => setSel(i + 1)} className={today === i + 1 ? styles.tabToday : ''}>
            {d}
          </button>
        ))}
      </div>

      <div className={`card ${styles.cal}`}>
        <div className={styles.head}>
          <span />
          {DAYS.map((d, i) => {
            const scr = screenMinutes(blocks, i + 1)
            const over = screenLimit && scr > screenLimit + 30
            return (
              <div key={d} className={`${styles.dh} ${i + 1 !== sel ? styles.hideM : ''} ${today === i + 1 ? styles.isToday : ''}`}>
                <b>{DAYS_LONG[i]}</b>
                <small className={over ? styles.over : ''}>{scr ? `${formatDuration(scr)} pantalla` : 'Sin pantalla'}</small>
              </div>
            )
          })}
        </div>
        <div className={styles.scroll}>
          <div className={styles.grid} style={{ height: hours.length * H, ['--h' as string]: `${H}px` }}>
            <div className={styles.gutter}>
              {hours.map((h) => (
                <span key={h} style={{ top: (h * 60 - from) * (H / 60) }}>
                  {String(h).padStart(2, '0')}:00
                </span>
              ))}
            </div>
            {DAYS.map((d, i) => {
              const day = i + 1
              const list = blocks.map(view).filter((b) => b.days.includes(day))
              const lay = layoutDay(list)
              return (
                <div
                  key={d}
                  ref={(el) => {
                    cols.current[i] = el
                  }}
                  className={`${styles.col} ${day !== sel ? styles.hideM : ''} ${today === day ? styles.colToday : ''}`}
                  onClick={(e) => onColClick(e, day)}
                  aria-label={DAYS_LONG[i]}
                >
                  {today === day && nowMin >= from && <i className={styles.now} style={{ top: (nowMin - from) * (H / 60) }} aria-hidden="true" />}
                  {list.map((b) => {
                    const l = lay.get(b.id) ?? { col: 0, cols: 1 }
                    const short = b.duration < 40
                    return (
                      <div
                        key={b.id}
                        role="button"
                        tabIndex={0}
                        className={`${styles.block} ${styles[`t_${b.type}`] ?? ''} ${drag?.id === b.id ? styles.dragging : ''} ${short ? styles.short : b.duration < 60 ? styles.mid : ''}`}
                        style={{
                          top: (b.start - from) * (H / 60),
                          height: Math.max(18, b.duration * (H / 60) - 2),
                          left: `calc(${(l.col / l.cols) * 100}% + 2px)`,
                          width: `calc(${100 / l.cols}% - 4px)`,
                        }}
                        onPointerDown={(e) => onDown(e, b, day, 'move')}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (pointer.current === 'touch' || e.detail === 0) openEdit(b)
                        }}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), openEdit(b)) : onKey(e, b))}
                        aria-label={`${b.title}, ${hhmm(b.start)} a ${hhmm(b.start + b.duration)}. Flechas para mover, Mayúsculas y flechas para cambiar la duración.`}
                      >
                        <b>{b.title}</b>
                        {!short && (
                          <small>
                            {hhmm(b.start)}–{hhmm(b.start + b.duration)}
                          </small>
                        )}
                        <span className={styles.resize} onPointerDown={(e) => onDown(e, b, day, 'resize')} aria-hidden="true" />
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className={styles.legend}>
        {(['trading', 'analisis', 'comida', 'personal', 'desconexion'] as const).map((t) => (
          <span key={t} className={styles[`t_${t}`]}>
            <i />
            {t === 'analisis' ? 'Análisis, estudio y revisión' : t === 'comida' ? 'Cuerpo: comida, ejercicio, sueño, pausas' : BLOCK_TYPES[t]}
          </span>
        ))}
      </div>

      <section className={`card ${ui.section}`} aria-live="polite">
        <span className={ui.secN}>Avisos de tu semana</span>
        {warnings.length ? (
          <ul className={styles.warns}>
            {warnings.map((w, i) => (
              <li key={i} className={w.kind === 'overlap' ? styles.wRed : styles.wAmber}>
                <b>{DAYS_LONG[w.day - 1]}:</b> {w.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Todo en orden: sin solapes y con un tiempo de pantalla dentro de lo que te propusiste.</p>
        )}
      </section>

      <dialog ref={dlg} className={ui.dialog} onClose={() => setDraft(null)} aria-labelledby="blk-title">
        {draft && (
          <form
            className={ui.dialogBody}
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <div className={ui.dialogHead}>
              <h2 id="blk-title">{draft.id ? 'Editar bloque' : 'Nuevo bloque'}</h2>
              <button type="button" className={ui.x} onClick={() => dlg.current?.close()} aria-label="Cerrar">
                ×
              </button>
            </div>
            <div className={ui.formGrid}>
              <label className={`field ${ui.full}`}>
                <span className="field-label">Qué haces</span>
                <input className="input" value={draft.title} maxLength={60} required onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ej.: Sesión de Nueva York" />
              </label>
              <label className="field">
                <span className="field-label">Tipo</span>
                <select className={`input ${ui.select}`} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as BlockType })}>
                  {Object.entries(BLOCK_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Empieza</span>
                <input
                  className="input"
                  type="time"
                  step={300}
                  value={hhmm(draft.start)}
                  onChange={(e) => {
                    const m = toMin(e.target.value)
                    if (m != null) setDraft({ ...draft, ...clampBlock(m, draft.duration) })
                  }}
                />
              </label>
            </div>
            <div className={styles.arrows}>
              <div>
                <span className="field-label">Hora</span>
                <div className={ui.row}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => nudge('start', -15)} aria-label="15 minutos antes">
                    ↑ 15 min antes
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => nudge('start', 15)} aria-label="15 minutos después">
                    ↓ 15 min después
                  </button>
                </div>
              </div>
              <div>
                <span className="field-label">Duración: {formatDuration(draft.duration)}</span>
                <div className={ui.row}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => nudge('duration', -15)} aria-label="15 minutos menos">
                    − 15 min
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => nudge('duration', 15)} aria-label="15 minutos más">
                    + 15 min
                  </button>
                </div>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 14 }}>
              De {hhmm(draft.start)} a {hhmm(draft.start + draft.duration)}
            </p>
            <fieldset className={styles.days}>
              <legend className="field-label">Se repite</legend>
              {DAYS.map((d, i) => (
                <label key={d}>
                  <input
                    type="checkbox"
                    checked={draft.days.includes(i + 1)}
                    onChange={(e) =>
                      setDraft({ ...draft, days: e.target.checked ? [...draft.days, i + 1] : draft.days.filter((x) => x !== i + 1) })
                    }
                  />
                  {d}
                </label>
              ))}
              <button type="button" className={styles.daysQuick} onClick={() => setDraft({ ...draft, days: [1, 2, 3, 4, 5] })}>
                Lun–Vie
              </button>
              <button type="button" className={styles.daysQuick} onClick={() => setDraft({ ...draft, days: [1, 2, 3, 4, 5, 6, 7] })}>
                Todos
              </button>
            </fieldset>
            <label className="field">
              <span className="field-label">Notas (opcional)</span>
              <textarea className="input" maxLength={300} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </label>
            {msg && (
              <p className="notice notice-error" role="alert">
                {msg}
              </p>
            )}
            <div className={ui.dialogActions}>
              {draft.id && (
                <button type="button" className={`btn btn-ghost btn-sm ${ui.dangerBtn}`} onClick={remove} disabled={pending} style={{ marginRight: 'auto' }}>
                  Borrar
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => dlg.current?.close()}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
                {pending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  )
}
