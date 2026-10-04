import { ButtonLink } from '@/components/ui/Button'
import styles from './landing.module.css'

/* Velas ilustrativas deterministas: impulso, retroceso a la entrada y continuación. */
const CLOSES = [248, 240, 244, 232, 226, 229, 214, 206, 210, 196, 186, 190, 176, 168, 172, 160, 150, 156, 164, 160, 170, 158, 152, 150, 154, 142, 132, 136, 124, 116, 112]
function candles() {
  let seed = 11
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  let open = 254
  return CLOSES.map((close, i) => {
    const up = close < open
    const hi = Math.min(open, close) - 2 - rnd() * 9
    const lo = Math.max(open, close) + 2 + rnd() * 9
    const c = { x: 14 + i * 15.6, open, close, hi, lo, up }
    open = close
    return c
  })
}

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className={styles.hero}>
      <div className={`wrap ${styles.heroGrid}`}>
        <div className={styles.heroText}>
          <span className="pill">
            <span className="dot" />
            Plan · Disciplina · Estilo de vida
          </span>
          <h1>
            Deja de improvisar. <span className="hl-grad">Opera con un plan</span> que es tuyo.
          </h1>
          <p className="lead">
            Convierte tus reglas en un plan escrito, un calendario que respeta tu vida y un journal que te enseña tus
            patrones. Sin señales. Sin promesas. Proceso.
          </p>
          <div className={styles.ctas}>
            <ButtonLink href={signedIn ? '/panel' : '/registro'} size="xl" arrow>
              {signedIn ? 'Ir a mi panel' : 'Crear mi plan gratis'}
            </ButtonLink>
            <ButtonLink href="/#como" size="xl" variant="ghost">
              Ver cómo funciona
            </ButtonLink>
          </div>
          <div className={styles.trust}>
            <span>7 días gratis, sin tarjeta</span>
            <span>Tus datos, solo tuyos</span>
            <span>Cancela cuando quieras</span>
          </div>
        </div>

        <div className={styles.visual}>
          <div className={styles.terminal}>
            <div className={styles.termTop}>
              <span className="dot dot-green" />
              US100 · Sesión NY
              <span className="chip">Dentro de tu plan</span>
            </div>
            <svg className={styles.chart} viewBox="0 0 520 300" role="img" aria-label="Ilustración de un gráfico con niveles de entrada, stop y objetivo">
              {candles().map((c, i) => (
                <g key={i} className={c.up ? styles.up : styles.down}>
                  <line x1={c.x + 5} x2={c.x + 5} y1={c.hi} y2={c.lo} strokeWidth="1.3" />
                  <rect x={c.x} y={Math.min(c.open, c.close)} width="10" height={Math.max(2, Math.abs(c.close - c.open))} rx="2" stroke="none" />
                </g>
              ))}
              <rect x="300" y="78" width="200" height="74" fill="var(--green)" opacity=".07" />
              <rect x="300" y="152" width="200" height="40" fill="var(--red)" opacity=".07" />
              <line x1="300" x2="500" y1="78" y2="78" stroke="var(--green)" strokeDasharray="5 5" />
              <line x1="300" x2="500" y1="152" y2="152" stroke="var(--blue)" strokeWidth="1.5" />
              <line x1="300" x2="500" y1="192" y2="192" stroke="var(--red)" strokeDasharray="5 5" />
              <text x="496" y="72" textAnchor="end" className={styles.lvl} fill="var(--green)">OBJETIVO · 2R</text>
              <text x="496" y="146" textAnchor="end" className={styles.lvl} fill="var(--blue)">ENTRADA</text>
              <text x="496" y="208" textAnchor="end" className={styles.lvl} fill="var(--red)">STOP · −1R</text>
            </svg>
            <p className={styles.caption}>Vista ilustrativa de la app · no es una operación real ni una recomendación</p>
          </div>
          <div className={styles.floats}>
            <div className={`${styles.float} ${styles.f1}`}>
              Checklist pre-operación
              <b>
                <span className="hl">✓</span> 7 de 7 cumplidos
              </b>
            </div>
            <div className={`${styles.float} ${styles.f2}`}>
              Protocolo activo
              <b>Pausa de 20 min tras pérdida</b>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
