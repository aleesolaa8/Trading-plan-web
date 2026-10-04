import { CalcDemo } from '@/components/landing/CalcDemo'
import { Faq } from '@/components/landing/Faq'
import { Hero } from '@/components/landing/Hero'
import { Pricing } from '@/components/landing/Pricing'
import { QuizDemo } from '@/components/landing/QuizDemo'
import styles from '@/components/landing/landing.module.css'
import { StatsBand } from '@/components/layout/StatsBand'
import { Ticker } from '@/components/layout/Ticker'
import { ButtonLink } from '@/components/ui/Button'
import { FAQ } from '@/content/faq'
import { getPlans, getQuiz } from '@/lib/content'
import { getCurrentUser } from '@/lib/supabase/server'

// Los precios y el diagnóstico salen de la base de datos: se refrescan cada 10 minutos.
export const revalidate = 600

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="eyebrow">
    <span className="dot" />
    {children}
  </span>
)

export default async function Home() {
  const [user, quiz, plans] = await Promise.all([getCurrentUser(), getQuiz(), getPlans()])
  const demoIndex = Math.max(0, quiz.findIndex((q) => q.slug === 'tras_perdida'))
  const demoQuestion = quiz[demoIndex]
  const total = quiz.length || 7
  const cta = user ? '/panel' : '/registro'

  return (
    <>
      <Hero signedIn={Boolean(user)} />
      <Ticker />

      <div className={styles.stats}>
        <StatsBand
          stats={[
            { value: String(total), label: 'preguntas para un diagnóstico que te explica el porqué' },
            { value: '1', label: 'plan escrito con tus reglas, versionado' },
            { value: '0', label: 'señales de compra o venta. Nunca.' },
            { value: '24 h', label: 'copiloto para hablar cuando lo necesites' },
          ]}
        />
      </div>

      <section className={styles.sec} id="como">
        <div className="wrap">
          <div className={styles.secHead}>
            <Eyebrow>Cómo funciona</Eyebrow>
            <h2>
              Tres pasos. <span className="hl">Un sistema</span> que te sostiene los días difíciles.
            </h2>
          </div>
          <div className={styles.steps}>
            <article className="card">
              <div className={styles.stepN}>01</div>
              <h3>Diagnóstico que explica, no que juzga</h3>
              <p>
                {total} preguntas sobre tu nivel, tu tiempo, tu riesgo, tus emociones y tu energía. En cada respuesta te
                contamos por qué puede pasar y cómo lo trabajará tu plan.
              </p>
            </article>
            <article className="card">
              <div className={styles.stepN}>02</div>
              <h3>Tu plan, con tus reglas</h3>
              <p>
                No inventamos estrategias. Recibes un plan escrito, un checklist, protocolos de conducta y una semana
                propuesta en tu calendario.
              </p>
            </article>
            <article className="card">
              <div className={styles.stepN}>03</div>
              <h3>Ejecuta, registra, revisa</h3>
              <p>
                Calculadora, checklist y journal en el día a día. Tu copiloto te acompaña a cualquier hora y cada semana
                ves en qué mejorar, sin culparte.
              </p>
            </article>
          </div>
        </div>
      </section>

      {demoQuestion && (
        <section className={styles.sec} id="diagnostico">
          <div className="wrap">
            <div className={styles.secHead}>
              <Eyebrow>Pruébalo ahora</Eyebrow>
              <h2>
                Una pregunta del diagnóstico. <span className="hl">Responde con honestidad.</span>
              </h2>
            </div>
            <QuizDemo question={demoQuestion} index={demoIndex} total={total} />
          </div>
        </section>
      )}

      <section className={styles.sec} id="herramientas">
        <div className="wrap">
          <div className={styles.secHead}>
            <Eyebrow>Herramientas</Eyebrow>
            <h2>
              Todo lo que necesitas para <span className="hl">cumplir tu plan.</span> Nada que te distraiga.
            </h2>
          </div>
          <div className={styles.bento}>
            <article className={`card ${styles.bCalc}`}>
              <span className="chip">Calculadora de riesgo</span>
              <h3>El tamaño exacto, antes de cada entrada.</h3>
              <p>Cualquier mercado: índices, forex, oro, cripto o acciones. Pones los datos de tu bróker una vez y se guardan.</p>
              <CalcDemo />
            </article>
            <article className={`card ${styles.bJournal}`}>
              <span className="chip chip-blue">Journal con patrones</span>
              <h3>Tu journal te habla. Sin juicios.</h3>
              <p>Emoción antes de entrar, cumplimiento del plan y error principal. Las operaciones que no haces también cuentan.</p>
              <div className={styles.demo}>
                <div className={styles.jsum}>
                  <div>
                    <span>Cumplimiento</span>
                    <b className="hl">82 %</b>
                  </div>
                  <div>
                    <span>R acumulado</span>
                    <b>+6,4 R</b>
                  </div>
                  <div>
                    <span>No realizadas</span>
                    <b>5</b>
                  </div>
                </div>
                <div className={styles.pattern}>
                  <h4>Un patrón, sin juicio</h4>
                  «Con prisa» aparece en 3 de las operaciones donde no seguiste el plan. Puede indicar que entras con el
                  tiempo justo. <b>Idea:</b> empieza la sesión 10 minutos antes y repasa el checklist.
                </div>
                <p className={styles.note}>Datos de muestra para ilustrar la pantalla.</p>
              </div>
            </article>
            <article className={`card ${styles.bCal}`}>
              <span className="chip chip-amber">Calendario de vida</span>
              <h3>Trading, sueño, comida y desconexión. En un mismo plan.</h3>
              <p>Te proponemos tu semana según tu plan y la ajustas arrastrando bloques. Te avisamos si encadenas demasiadas horas de pantalla.</p>
              <div className={styles.demo} aria-hidden="true">
                <div className={styles.week}>
                  <span />
                  {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'].map((d) => (
                    <span key={d} className={styles.h}>
                      {d}
                    </span>
                  ))}
                  {(
                    [
                      ['07:00', 'bLife', ['Ejercicio', 'Paseo', 'Ejercicio', 'Paseo', 'Ejercicio']],
                      ['14:30', 'bStudy', ['Análisis', 'Análisis', 'Backtest', 'Análisis', 'Formación']],
                      ['15:30', 'bTrade', ['Sesión NY', 'Sesión NY', 'Sesión NY', 'Sesión NY', 'Sesión NY']],
                      ['17:30', 'bOff', ['Desconexión', 'Desconexión', 'Desconexión', 'Desconexión', 'Desconexión']],
                    ] as const
                  ).flatMap(([t, cls, items]) => [
                    <span key={t} className={styles.t}>
                      {t}
                    </span>,
                    ...items.map((it, i) => (
                      <div key={`${t}${i}`} className={`${styles.blk} ${styles[cls]}`}>
                        {it}
                      </div>
                    )),
                  ])}
                </div>
              </div>
            </article>
            <article className={`card ${styles.bAi}`}>
              <span className="chip">Copiloto 24 h</span>
              <h3>Un mentor a cualquier hora.</h3>
              <ul className="arrows" style={{ marginTop: 16 }}>
                <li>Conoce tu plan, tu día y tu journal</li>
                <li>Te devuelve a tus reglas cuando dudas</li>
                <li>Te acompaña tras un mal día</li>
                <li>Nunca dice compra o vende</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.sec}>
        <div className="wrap">
          <div className={styles.secHead}>
            <Eyebrow>Transparencia</Eyebrow>
            <h2>
              Lo que somos. <span className="hl">Y lo que nunca seremos.</span>
            </h2>
          </div>
          <div className={styles.vs}>
            <div className={`card ${styles.yes}`}>
              <h3>Sí</h3>
              <ul className="arrows">
                <li>Una herramienta para escribir y cumplir tu plan</li>
                <li>Un registro honesto de lo que haces y cómo te sientes</li>
                <li>Un calendario que incluye tu vida, no solo el gráfico</li>
                <li>Propuestas de mejora basadas en tus propios datos</li>
              </ul>
            </div>
            <div className="card">
              <h3>No</h3>
              <ul className={`arrows ${styles.crosses}`}>
                <li>Señales de compra o venta</li>
                <li>Estrategias «ganadoras» vendidas como atajo</li>
                <li>Promesas de rentabilidad</li>
                <li>Asesoramiento financiero ni psicológico</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.sec} id="precio">
        <div className="wrap">
          <div className={`${styles.secHead} ${styles.center}`}>
            <Eyebrow>Precio</Eyebrow>
            <h2>
              Dos planes. <span className="hl">Los dos completos.</span>
            </h2>
            <p className="lead">
              Core tiene todo lo necesario para operar con un plan. Pro suma la IA sin límites y las herramientas de quien
              opera muchas horas o varias cuentas.
            </p>
          </div>
          <Pricing plans={plans} />
        </div>
      </section>

      <section className={styles.sec} id="faq">
        <div className="wrap">
          <div className={styles.secHead}>
            <Eyebrow>Preguntas frecuentes</Eyebrow>
            <h2>
              Lo que nos <span className="hl">suelen preguntar.</span>
            </h2>
          </div>
          <Faq groups={FAQ} />
        </div>
      </section>

      <section className={styles.final}>
        <div className="wrap">
          <span className="eyebrow">
            <span className="dot dot-green" />
            Tu siguiente sesión empieza aquí
          </span>
          <h2>
            El mercado no cambia. <span className="hl-grad">Tu proceso, sí.</span>
          </h2>
          <ButtonLink href={cta} size="xl" arrow>
            {user ? 'Ir a mi panel' : 'Hacer el diagnóstico'}
          </ButtonLink>
        </div>
      </section>
    </>
  )
}
