import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHead } from '@/components/app/PageHead'
import { ButtonLink } from '@/components/ui/Button'
import { getMyPlan } from '@/lib/content'
import { hhmm, LEVEL_LABEL, SCREEN_TYPES } from '@/lib/domain/plan'
import { DAY_NAMES, formatDuration, nowInZone } from '@/lib/domain/time'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { Checklist, DraftButton, Protocols } from './PlanInteractive'
import styles from './plan.module.css'

export const metadata: Metadata = { title: 'Mi plan' }

const TIME_LABEL: Record<string, string> = { h2: 'Hasta 2 h al día', h3_6: 'De 3 a 6 h al día', h6_10: 'De 6 a 10 h al día' }
const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 })

export default async function PlanPage({ searchParams }: PageProps<'/panel/plan'>) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/panel/plan')
  const [plan, sp, supabase] = await Promise.all([getMyPlan(user.id), searchParams, createClient()])
  const { data: planQuota } = (await supabase?.rpc('ai_quota', { p_kind: 'plan' })) ?? { data: null }
  const pq = (planQuota ?? { used: 0, limit: 0 }) as { used: number; limit: number }

  if (!plan) {
    return (
      <>
        <PageHead eyebrow="Mi plan" title={<>Tu plan empieza <span className="hl-grad">aquí</span>.</>}>
          Responde 7 preguntas y escribe tus reglas. En unos 3 minutos tendrás tu plan, tu checklist, tus protocolos y
          una semana propuesta.
        </PageHead>
        <ButtonLink href="/panel/diagnostico" size="xl" arrow>
          Empezar diagnóstico
        </ButtonLink>
      </>
    )
  }

  const { data: profile } = (await supabase?.from('profiles').select('timezone, display_name').eq('id', user.id).maybeSingle()) ?? {
    data: null,
  }
  const now = nowInZone(profile?.timezone ?? 'Europe/Madrid')
  const r = plan.content.rules
  const name = r.name || profile?.display_name || user.name || ''
  const today = plan.blocks.filter((b) => b.days.includes(now.day)).sort((a, b) => a.start - b.start)
  const current = today.find((b) => b.start <= now.minutes && now.minutes < b.start + b.duration)
  const next = today.find((b) => b.start > now.minutes)
  const screen = today.filter((b) => SCREEN_TYPES.has(b.type)).reduce((s, b) => s + b.duration, 0)
  const created = new Date(plan.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      {sp.nuevo && (
        <p className="notice notice-ok" role="status" style={{ marginBottom: 20 }}>
          Tu plan está listo. También te hemos propuesto una semana en el calendario: ajústala cuando quieras.
        </p>
      )}
      <PageHead
        eyebrow={`Hoy · ${DAY_NAMES[now.day - 1]}`}
        title={name ? <>Hola, <span className="hl-grad">{name}</span>.</> : <>Tu <span className="hl-grad">plan</span>.</>}
      />

      <div className={styles.today}>
        <div className={`${styles.tile} ${styles.accent}`}>
          <span>{current ? 'Ahora' : 'Próximo bloque'}</span>
          <b>{current?.title ?? next?.title ?? 'Día terminado'}</b>
          <small>
            {current
              ? `${hhmm(current.start)}–${hhmm(current.start + current.duration)}`
              : next
                ? `a las ${hhmm(next.start)}`
                : 'Descansa. Mañana, más.'}
          </small>
        </div>
        <div className={styles.tile}>
          <span>Pantalla hoy</span>
          <b>{formatDuration(screen)}</b>
          <small>según tu calendario</small>
        </div>
        <div className={styles.tile}>
          <span>Límites de hoy</span>
          <b>
            {r.maxTrades} op. · −{fmt(r.maxLoss)} R
          </b>
          <small>riesgo de {fmt(r.risk)} % por operación</small>
        </div>
      </div>

      <section className={`card ${styles.aiCard}`}>
        <div className={styles.secTop}>
          <span className={styles.secN}>Tu plan, redactado</span>
          {plan.content.ai && <span className="chip chip-blue">Redactado con IA · solo con tus reglas</span>}
        </div>
        {plan.content.ai ? (
          <>
            <p className={styles.lede}>{plan.content.ai.resumen}</p>
            <div className={styles.aiSecs}>
              {plan.content.ai.secciones.map((s) => (
                <div key={s.titulo}>
                  <h3>{s.titulo}</h3>
                  <p>{s.texto}</p>
                </div>
              ))}
            </div>
            {plan.content.ai.preguntas.length > 0 && (
              <div className={styles.questions}>
                <h3>Para completar tu plan</h3>
                <ul className="arrows">
                  {plan.content.ai.preguntas.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
                <Link href="/panel/diagnostico" className={styles.link}>
                  Añadirlo a mis reglas →
                </Link>
              </div>
            )}
          </>
        ) : (
          <p className="muted">
            La IA convierte tus reglas en un plan escrito, claro y ordenado. No inventa nada: si falta algo, te lo pregunta.
          </p>
        )}
        <DraftButton hasDraft={Boolean(plan.content.ai)} left={Math.max(0, pq.limit - pq.used)} limit={pq.limit} />
      </section>

      <article className={`card ${styles.doc}`}>
        <section className={styles.sec}>
          <div className={styles.secTop}>
            <span className={styles.secN}>01 · Perfil, mercados y horario</span>
            <span className="chip">
              Versión {plan.version} · {created}
            </span>
          </div>
          <div className={styles.kv}>
            <div>
              <span>Nivel</span>
              <b>{LEVEL_LABEL[plan.content.level ?? ''] ?? '—'}</b>
            </div>
            <div>
              <span>Tiempo</span>
              <b>{TIME_LABEL[plan.content.time ?? ''] ?? '—'}</b>
            </div>
            <div>
              <span>Mercados</span>
              <b>{r.markets.join(', ')}</b>
            </div>
            <div>
              <span>Sesión 1</span>
              <b>
                {r.s1Start}–{r.s1End}
              </b>
            </div>
            {r.s2Start && (
              <div>
                <span>Sesión 2</span>
                <b>
                  {r.s2Start}–{r.s2End}
                </b>
              </div>
            )}
          </div>
        </section>

        <section className={styles.sec}>
          <span className={styles.secN}>02 · Gestión del riesgo</span>
          <div className={styles.kv}>
            <div>
              <span>Riesgo por operación</span>
              <b>{fmt(r.risk)} %</b>
            </div>
            <div>
              <span>Máx. operaciones/día</span>
              <b>{r.maxTrades}</b>
            </div>
            <div>
              <span>Pérdida máx. diaria</span>
              <b>−{fmt(r.maxLoss)} R</b>
            </div>
          </div>
          <p className="muted">
            Al llegar a −{fmt(r.maxLoss)} R o a {r.maxTrades} operaciones, el día de trading termina. Sin excepciones.
          </p>
        </section>

        <section className={styles.sec}>
          <span className={styles.secN}>03 · Mi setup y mi gestión</span>
          {r.setup ? <p className={styles.quote}>{r.setup}</p> : <p className="notice notice-warn">Setup pendiente de escribir. Sin setup escrito, no hay operación.</p>}
          {r.management ? (
            <p className={styles.quote}>{r.management}</p>
          ) : (
            <p className="notice notice-warn">Gestión pendiente de escribir: dónde va el stop y dónde sales.</p>
          )}
        </section>

        <section className={styles.sec}>
          <span className={styles.secN}>04 · Checklist antes de cada entrada</span>
          <Checklist items={plan.content.checklist} />
        </section>

        <section className={styles.sec}>
          <span className={styles.secN}>05 · Mis protocolos</span>
          <p className="muted">Salen de tus respuestas. Desactiva los que no quieras o añade los tuyos.</p>
          <Protocols protocols={plan.protocols} />
        </section>

        <section className={styles.sec}>
          <div className={styles.secTop}>
            <span className={styles.secN}>06 · Mi día ({DAY_NAMES[now.day - 1]!.toLowerCase()})</span>
            <Link href="/panel/calendario" className={styles.link}>
              Ver calendario →
            </Link>
          </div>
          <p className="muted">Sale de tu calendario: si cambias un bloque allí, cambia aquí.</p>
          {today.length ? (
            <div className={styles.day}>
              {today.map((b) => (
                <div key={b.id} className={styles.slot}>
                  <time>
                    {hhmm(b.start)}–{hhmm(b.start + b.duration)}
                  </time>
                  <span className={`${styles.pill} ${styles[`t_${b.type}`] ?? ''}`}>{b.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Hoy no tienes bloques en el calendario.</p>
          )}
        </section>
      </article>

      <section className={`card ${styles.versions}`}>
        <span className={styles.secN}>Historial de versiones</span>
        <ol>
          {plan.versions.map((v) => (
            <li key={v.version} className={v.version === plan.version ? styles.currentV : ''}>
              <b>Versión {v.version}</b>
              <span className="chip" data-source={v.source}>
                {v.source === 'ai' ? 'IA' : v.source === 'review' ? 'Revisión' : 'Tus reglas'}
              </span>
              <span className="muted">
                {new Date(v.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {v.note ? ` · ${v.note}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.actions}>
        <ButtonLink href="/panel/diagnostico" variant="ghost">
          Editar reglas o repetir diagnóstico
        </ButtonLink>
      </div>
    </>
  )
}
