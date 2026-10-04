'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { REPLACE_MARK } from '@/lib/ai/protocol'
import styles from './Copilot.module.css'

type Msg = { id: string; role: 'user' | 'assistant' | 'help'; content: string }
type Quota = { plan: string | null; used: number; limit: number }
type Upsell = { text: string; code: string } | null

const QUICK = [
  'Estoy agobiado/a y no sé qué hacer',
  'No sé si entrar en esta operación',
  'Acabo de perder y quiero recuperarlo',
  'Llevo días sin cumplir mi plan',
  'Hoy estoy cansado/a, ¿opero?',
  'Ayúdame a organizar mi semana',
]
const UNLIMITED = 1000
let seq = 0
const uid = () => `m${Date.now()}${seq++}`

export function Copilot({ name }: { name: string }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [ready, setReady] = useState(true)
  const [messages, setMessages] = useState<Msg[]>([])
  const [quota, setQuota] = useState<Quota | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [upsell, setUpsell] = useState<Upsell>(null)
  const [error, setError] = useState<string | null>(null)
  const ctl = useRef<AbortController | null>(null)
  const body = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

  const scroll = () => requestAnimationFrame(() => body.current?.scrollTo({ top: body.current.scrollHeight }))

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/ai/chat', { cache: 'no-store' })
      if (!r.ok) throw new Error()
      const d = (await r.json()) as { messages: Msg[]; quota: Quota; ready: boolean }
      setMessages(d.messages.map((m) => ({ ...m, id: String(m.id) })))
      setQuota(d.quota)
      setReady(d.ready)
    } catch {
      setError('No hemos podido cargar tu conversación.')
    } finally {
      setLoaded(true)
      scroll()
    }
  }, [])

  const show = () => {
    setOpen(true)
    if (!loaded) load()
    setTimeout(() => inputRef.current?.focus(), 60)
  }
  const hide = useCallback(() => {
    setOpen(false)
    ctl.current?.abort()
    fabRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide()
    window.addEventListener('keydown', onKey)
    const mobile = window.matchMedia('(max-width: 699px)').matches
    if (mobile) document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, hide])

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || busy) return
    setInput('')
    setError(null)
    setUpsell(null)
    const mine: Msg = { id: uid(), role: 'user', content: text }
    const reply: Msg = { id: uid(), role: 'assistant', content: '' }
    setMessages((m) => [...m, mine, reply])
    scroll()
    setBusy(true)
    ctl.current = new AbortController()
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: ctl.current.signal,
      })
      if (!r.ok || !r.body) {
        const d = (await r.json().catch(() => ({}))) as { error?: string; code?: string; quota?: Quota }
        setMessages((m) => m.filter((x) => x.id !== reply.id && x.id !== mine.id))
        setInput(text)
        if (d.quota) setQuota(d.quota)
        if (r.status === 402) setUpsell({ text: d.error ?? 'Has llegado al límite de tu plan.', code: d.code ?? '' })
        else setError(d.error ?? 'No hemos podido enviar tu mensaje. Inténtalo de nuevo.')
        scroll()
        return
      }
      const used = Number(r.headers.get('X-Quota-Used'))
      const limit = Number(r.headers.get('X-Quota-Limit'))
      setQuota({ plan: r.headers.get('X-Quota-Plan') || null, used, limit })
      if (r.headers.get('X-Help') === '1') setMessages((m) => [...m.slice(0, -1), { id: uid(), role: 'help', content: HELP }, m[m.length - 1]!])

      const reader = r.body.getReader()
      const dec = new TextDecoder()
      let acc = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream: true })
        const i = acc.lastIndexOf(REPLACE_MARK)
        const shown = i >= 0 ? acc.slice(i + REPLACE_MARK.length) : acc
        setMessages((m) => m.map((x) => (x.id === reply.id ? { ...x, content: shown } : x)))
        scroll()
      }
    } catch {
      // Cancelado por la persona: se deja lo recibido
      setMessages((m) => m.filter((x) => !(x.id === reply.id && !x.content)))
    } finally {
      setBusy(false)
      ctl.current = null
    }
  }

  async function newThread() {
    ctl.current?.abort()
    await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'new' }) })
    setMessages([])
    setUpsell(null)
    setError(null)
    inputRef.current?.focus()
  }

  const limited = quota && quota.limit > 0 && quota.limit < UNLIMITED
  const left = quota ? Math.max(0, quota.limit - quota.used) : 0
  const intro = `Hola${name ? `, ${name}` : ''}. Conozco tu plan, tu calendario de hoy y tu journal. Escríbeme cuando quieras: antes de una sesión, si dudas en una entrada o si el día se ha torcido. ¿Cómo estás?`

  return (
    <>
      <button ref={fabRef} type="button" className={styles.fab} onClick={show} aria-haspopup="dialog" aria-controls="copilot" hidden={open}>
        <Bubble />
        <span>Copiloto 24 h</span>
        <i className={styles.pulse} aria-hidden="true" />
      </button>

      <div id="copilot" className={styles.win} role="dialog" aria-modal="true" aria-label="Copiloto" hidden={!open}>
        <div className={styles.head}>
          <span className={styles.avatar} aria-hidden="true">
            <Bubble />
          </span>
          <div className={styles.title}>
            <b>Tu copiloto</b>
            <span>
              <i className="dot dot-green" style={{ width: 7, height: 7 }} />
              {limited ? `Te quedan ${left} de ${quota!.limit} mensajes este mes` : 'Disponible 24 h · conoce tu plan'}
            </span>
          </div>
          {messages.length > 0 && (
            <button type="button" className={`btn btn-ghost btn-sm ${styles.newBtn}`} onClick={newThread}>
              Nueva
            </button>
          )}
          <button type="button" className={styles.close} onClick={hide} aria-label="Cerrar copiloto">
            ×
          </button>
        </div>

        <div className={styles.body} ref={body} aria-live="polite">
          <div className={`${styles.msg} ${styles.ai}`}>{intro}</div>
          {loaded && !messages.length && (
            <div className={styles.quick}>
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => send(q)} disabled={!ready}>
                  {q}
                </button>
              ))}
            </div>
          )}
          {messages.map((m) =>
            m.role === 'help' ? (
              <div key={m.id} className={styles.help}>
                {m.content}
              </div>
            ) : (
              <div key={m.id} className={`${styles.msg} ${m.role === 'user' ? styles.me : styles.ai} ${m.role === 'assistant' && !m.content ? styles.thinking : ''}`}>
                {m.content || 'Escribiendo'}
              </div>
            ),
          )}
          {!ready && loaded && <p className={styles.notice}>El copiloto se activará muy pronto en tu cuenta.</p>}
          {error && (
            <p className={styles.notice} role="alert">
              {error}
            </p>
          )}
          {upsell && (
            <div className={styles.upsell} role="alert">
              <b>{upsell.code === 'no_plan' ? 'Tu prueba ha terminado' : 'Has llegado a tu límite del mes'}</b>
              <p>{upsell.text}</p>
              <Link href="/panel/ajustes#plan" className="btn btn-primary btn-sm" onClick={hide}>
                {upsell.code === 'no_plan' ? 'Elegir mi plan' : 'Pasar a Pro'}
              </Link>
            </div>
          )}
        </div>

        <form
          className={styles.foot}
          onSubmit={(e) => {
            e.preventDefault()
            if (busy) ctl.current?.abort()
            else send(input)
          }}
        >
          <div className={styles.composer}>
            <label htmlFor="copilot-input" className="sr-only">
              Escribe a tu copiloto
            </label>
            <textarea
              id="copilot-input"
              ref={inputRef}
              className="input"
              rows={1}
              maxLength={1500}
              placeholder="Cuéntame…"
              value={input}
              disabled={!ready}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(140, e.target.scrollHeight)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
            />
            <button type="submit" className="btn btn-primary" disabled={!ready || (!busy && !input.trim())}>
              {busy ? 'Parar' : 'Enviar'}
            </button>
          </div>
          <p className={styles.note}>Copiloto de proceso: no da señales ni asesoramiento financiero.</p>
        </form>
      </div>
    </>
  )
}

const HELP = 'Si te sientes así, no lo pases a solas: el 024 atiende gratis las 24 h, y el 112 si hay peligro inmediato.'

function Bubble() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />
    </svg>
  )
}
