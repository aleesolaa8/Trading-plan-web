'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import type { QuizQuestion } from '@/lib/content'
import { MARKET_CATEGORIES, MARKETS, normalizeMarket, type MarketCategory } from '@/lib/domain/markets'
import type { Answers, RulesInput } from '@/lib/domain/plan'
import { saveOnboarding } from './actions'
import styles from './onboarding.module.css'

const EMPTY_RULES: RulesInput = {
  name: '',
  markets: [],
  s1Start: '15:30',
  s1End: '17:30',
  s2Start: '',
  s2End: '',
  risk: '0,5',
  maxTrades: '2',
  maxLoss: '2',
  setup: '',
  management: '',
}

type Props = {
  quiz: QuizQuestion[]
  initialRules: RulesInput | null
  initialAnswers: Answers
  hasCalendar: boolean
  draftKey: string
  defaultName: string
}

type Draft = { step: number; answers: Answers; rules: RulesInput }

export function Onboarding({ quiz, initialRules, initialAnswers, hasCalendar, draftKey, defaultName }: Props) {
  const router = useRouter()
  const total = quiz.length
  // Paso 0 = bienvenida, 1..total = preguntas, total+1 = reglas
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>(initialAnswers)
  const [rules, setRules] = useState<RulesInput>(initialRules ?? { ...EMPTY_RULES, name: defaultName })
  const [replaceCalendar, setReplaceCalendar] = useState(!hasCalendar)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Recupera un borrador si la persona salió a mitad
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey)
      if (!raw) return
      const d = JSON.parse(raw) as Draft
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restaurar el borrador una vez al montar
      setStep(d.step)
      setAnswers(d.answers)
      setRules(d.rules)
    } catch {}
  }, [draftKey])
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ step, answers, rules } satisfies Draft))
    } catch {}
  }, [draftKey, step, answers, rules])

  const go = (n: number) => {
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const setRule = <K extends keyof RulesInput>(k: K, v: RulesInput[K]) => {
    setRules((r) => ({ ...r, [k]: v }))
    if (errors[k])
      setErrors((e) => {
        const next = { ...e }
        delete next[k]
        return next
      })
  }

  function submit() {
    setMessage(null)
    startTransition(async () => {
      const res = await saveOnboarding({ answers, rules, replaceCalendar })
      if (res.ok) {
        try {
          sessionStorage.removeItem(draftKey)
        } catch {}
        router.push('/panel/plan?nuevo=1')
        return
      }
      setErrors(res.fieldErrors ?? {})
      setMessage(res.message)
    })
  }

  if (!total) {
    return (
      <section className="card">
        <h2>El diagnóstico no está disponible ahora mismo</h2>
        <p className="muted">Vuelve a intentarlo en unos minutos.</p>
      </section>
    )
  }

  /* ---------- Bienvenida ---------- */
  if (step === 0) {
    return (
      <div className={styles.stack}>
        <div className={styles.head}>
          <span className="eyebrow">
            <span className="dot" />
            Diagnóstico · {total} preguntas · unos 3 minutos
          </span>
          <h1>
            Construimos tu plan <span className="hl-grad">contigo</span>.
          </h1>
          <p className="lead">
            Después de cada respuesta te explicamos por qué puede pasar y cómo lo trabajará tu plan. Sin juicios: no hay
            respuestas buenas ni malas.
          </p>
        </div>
        <section className="card">
          <ul className="arrows">
            <li>{total} preguntas sobre tu nivel, tu tiempo, tu riesgo, tus emociones y tu energía</li>
            <li>Después escribes tus reglas: mercados, horario, riesgo, setup y gestión</li>
            <li>Recibes tu plan, tu checklist, tus protocolos y una semana propuesta en el calendario</li>
          </ul>
          <p className={styles.legal}>
            Time to Trade es una herramienta de planificación y registro. No es asesoramiento financiero ni psicológico y
            nunca te dirá qué comprar o vender. Los CFD conllevan un riesgo elevado de perder dinero rápidamente debido al
            apalancamiento.
          </p>
          <Button size="xl" arrow onClick={() => go(1)}>
            Empezar el diagnóstico
          </Button>
        </section>
      </div>
    )
  }

  /* ---------- Preguntas ---------- */
  if (step <= total) {
    const q = quiz[step - 1]!
    const chosen = q.options.find((o) => o.slug === answers[q.slug])
    return (
      <div className={styles.stack}>
        <div className={styles.head}>
          <span className="eyebrow">
            <span className="dot" />
            Diagnóstico · {step} de {total}
          </span>
        </div>
        <section className="card">
          <div className={styles.progress} aria-hidden="true">
            {quiz.map((x, i) => (
              <i key={x.id} className={i < step ? styles.on : ''} />
            ))}
          </div>
          {q.eyebrow && <span className="eyebrow">{q.eyebrow}</span>}
          <h2 id="q-title" className={styles.qTitle}>
            {q.prompt}
          </h2>
          {q.helper && <p className="muted">{q.helper}</p>}
          <div className={styles.opts} role="radiogroup" aria-labelledby="q-title">
            {q.options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={o.slug === answers[q.slug]}
                className={styles.opt}
                onClick={() => setAnswers((a) => ({ ...a, [q.slug]: o.slug }))}
              >
                <span className={styles.radio} aria-hidden="true" />
                <span>
                  <b>{o.label}</b>
                  {o.hint && <small>{o.hint}</small>}
                </span>
              </button>
            ))}
          </div>
        </section>

        {chosen && (
          <section className="card" aria-live="polite">
            <div className={`${styles.tip} ${styles.why}`}>
              <h3>Por qué puede pasar</h3>
              <p>{chosen.why}</p>
            </div>
            <div className={`${styles.tip} ${styles.plan}`}>
              <h3>Cómo lo trabaja tu plan</h3>
              <p>{chosen.plan}</p>
            </div>
            {chosen.protocol && (
              <div className={styles.protoLine}>
                <span className="chip chip-blue">Protocolo</span>
                <div>
                  <b>{chosen.protocol.title}</b>
                  <span className="muted">Se añade a tu plan. Podrás editarlo o crear los tuyos.</span>
                </div>
              </div>
            )}
          </section>
        )}

        <div className={styles.row}>
          <Button variant="ghost" onClick={() => go(step - 1)}>
            ← Anterior
          </Button>
          <Button arrow disabled={!chosen} onClick={() => go(step + 1)}>
            {step < total ? 'Siguiente' : 'Ahora, tus reglas'}
          </Button>
        </div>
      </div>
    )
  }

  /* ---------- Reglas ---------- */
  return (
    <div className={styles.stack}>
      <div className={styles.head}>
        <span className="eyebrow">
          <span className="dot" />
          Paso final · Tus reglas
        </span>
        <h1>
          Tu plan lleva <span className="hl-grad">tus reglas</span>.
        </h1>
        <p className="lead">No inventamos estrategias. Escribe cómo operas tú y lo convertimos en tu plan.</p>
      </div>

      <MarketPicker
        value={rules.markets}
        onChange={(m) => setRule('markets', m)}
        error={errors.markets}
      />

      <section className="card">
        <h2 className={styles.h2}>Horario de mercado</h2>
        <p className="muted">Tu ventana de trading. Si operas dos sesiones, por ejemplo Londres y Nueva York, añade la segunda.</p>
        <div className={styles.grid2}>
          <Field label="Sesión 1 · inicio" id="s1Start" error={errors.s1Start}>
            <input id="s1Start" type="time" className="input" value={rules.s1Start} onChange={(e) => setRule('s1Start', e.target.value)} />
          </Field>
          <Field label="Sesión 1 · fin" id="s1End" error={errors.s1End}>
            <input id="s1End" type="time" className="input" value={rules.s1End} onChange={(e) => setRule('s1End', e.target.value)} />
          </Field>
          <Field label="Sesión 2 · inicio (opcional)" id="s2Start" error={errors.s2Start}>
            <input id="s2Start" type="time" className="input" value={rules.s2Start} onChange={(e) => setRule('s2Start', e.target.value)} />
          </Field>
          <Field label="Sesión 2 · fin" id="s2End" error={errors.s2End}>
            <input id="s2End" type="time" className="input" value={rules.s2End} onChange={(e) => setRule('s2End', e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="card">
        <h2 className={styles.h2}>Riesgo</h2>
        <div className={styles.grid2}>
          <Field label="Cómo quieres que te llamemos" id="name" error={errors.name} full>
            <input id="name" className="input" maxLength={40} autoComplete="given-name" value={rules.name} onChange={(e) => setRule('name', e.target.value)} />
          </Field>
          <Field label="Riesgo por operación (%)" id="risk" error={errors.risk}>
            <input id="risk" className="input" inputMode="decimal" value={String(rules.risk ?? '')} onChange={(e) => setRule('risk', e.target.value)} />
          </Field>
          <Field label="Máx. operaciones al día" id="maxTrades" error={errors.maxTrades}>
            <input id="maxTrades" className="input" inputMode="numeric" value={String(rules.maxTrades ?? '')} onChange={(e) => setRule('maxTrades', e.target.value)} />
          </Field>
          <Field
            label="Pérdida máxima al día (en R)"
            id="maxLoss"
            error={errors.maxLoss}
            hint="1 R es lo que arriesgas en una operación. Con 2 R, paras tras perder dos operaciones completas."
            full
          >
            <input id="maxLoss" className="input" inputMode="decimal" value={String(rules.maxLoss ?? '')} onChange={(e) => setRule('maxLoss', e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="card">
        <h2 className={styles.h2}>Tu forma de operar</h2>
        <Field label="Tu setup: cuándo entras" id="setup" error={errors.setup}>
          <textarea
            id="setup"
            className={`input ${styles.area}`}
            maxLength={800}
            placeholder="Con tus palabras. Ej.: espero ruptura del máximo de la primera hora y entro en el retesteo con vela de confirmación."
            value={rules.setup}
            onChange={(e) => setRule('setup', e.target.value)}
          />
        </Field>
        <Field label="Tu gestión: stop y salida" id="management" error={errors.management}>
          <textarea
            id="management"
            className={`input ${styles.area}`}
            maxLength={800}
            placeholder="Ej.: stop bajo el último mínimo, objetivo 2 R, muevo a break-even al llegar a 1 R."
            value={rules.management}
            onChange={(e) => setRule('management', e.target.value)}
          />
        </Field>
        <p className="muted" style={{ fontSize: 13 }}>
          Si lo dejas vacío, tu plan lo marcará como pendiente. Nunca lo rellenamos por ti.
        </p>
      </section>

      {hasCalendar && (
        <label className={`check ${styles.replace}`}>
          <input type="checkbox" checked={replaceCalendar} onChange={(e) => setReplaceCalendar(e.target.checked)} />
          <span>Proponer de nuevo mi semana en el calendario (reemplaza los bloques que tengo ahora)</span>
        </label>
      )}

      {message && (
        <p className="notice notice-error" role="alert">
          {message}
        </p>
      )}
      <div className={styles.row}>
        <Button variant="ghost" onClick={() => go(total)} disabled={pending}>
          ← Volver al diagnóstico
        </Button>
        <Button size="xl" arrow={!pending} onClick={submit} disabled={pending} aria-busy={pending}>
          {pending ? 'Creando tu plan…' : initialRules ? 'Guardar nueva versión' : 'Crear mi plan'}
        </Button>
      </div>
    </div>
  )
}

function Field({
  label,
  id,
  error,
  hint,
  full,
  children,
}: {
  label: string
  id: string
  error?: string
  hint?: string
  full?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="field" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {hint && !error && <span className="muted" style={{ fontSize: 13 }}>{hint}</span>}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

function MarketPicker({ value, onChange, error }: { value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<MarketCategory | 'all'>('all')
  const [own, setOwn] = useState('')
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return MARKETS.filter(
      (m) =>
        (cat === 'all' || m.category === cat) &&
        (!q || m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
    )
  }, [query, cat])
  const toggle = (s: string) => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s])
  const addOwn = () => {
    const v = normalizeMarket(own)
    if (v && !value.includes(v)) onChange([...value, v])
    setOwn('')
  }

  return (
    <section className="card">
      <h2 className={styles.h2}>¿Qué mercados operas?</h2>
      <p className="muted">Elige todos los que quieras. Si el tuyo no está, añádelo con su nombre.</p>
      <div className={styles.picked} aria-live="polite">
        {value.length ? (
          value.map((m) => (
            <span key={m} className={styles.pk}>
              {m}
              <button type="button" aria-label={`Quitar ${m}`} onClick={() => toggle(m)}>
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="muted" style={{ fontSize: 14 }}>
            Aún no has elegido ninguno.
          </span>
        )}
      </div>
      <label htmlFor="m-q" className="sr-only">
        Buscar mercado
      </label>
      <input
        id="m-q"
        className="input"
        placeholder="Busca: oro, EURUSD, Nasdaq, Bitcoin…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      <div className={styles.cats} role="group" aria-label="Tipo de mercado">
        {(['all', ...Object.keys(MARKET_CATEGORIES)] as const).map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c as MarketCategory | 'all')}>
            {c === 'all' ? 'Todos' : MARKET_CATEGORIES[c as MarketCategory]}
          </button>
        ))}
      </div>
      <div className={styles.mkts}>
        {list.length ? (
          list.map((m) => (
            <button key={m.symbol} type="button" className={styles.mkt} aria-pressed={value.includes(m.symbol)} onClick={() => toggle(m.symbol)}>
              <b>{m.symbol}</b>
              <span>{m.name}</span>
            </button>
          ))
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>
            No está en la lista. Añádelo abajo en «Otro mercado».
          </p>
        )}
      </div>
      <div className={styles.ownRow}>
        <div className="field">
          <label htmlFor="m-own" className="field-label">
            Otro mercado
          </label>
          <input
            id="m-own"
            className="input"
            maxLength={30}
            placeholder="Ej.: Café, USDMXN, Inditex"
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addOwn()
              }
            }}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={addOwn} className={styles.ownBtn}>
          Añadir
        </Button>
      </div>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </section>
  )
}
