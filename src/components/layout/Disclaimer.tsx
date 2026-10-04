/** Aviso legal obligatorio: landing, registro, onboarding y pie. Un único texto para todos. */
export const DISCLAIMER_SHORT =
  'Herramienta de planificación y registro. No es asesoramiento financiero. Los CFD conllevan un riesgo elevado de perder dinero.'

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) return <p className="muted" style={{ fontSize: 13 }}>{DISCLAIMER_SHORT}</p>
  return (
    <p>
      <strong>Aviso importante.</strong> Time to Trade es una herramienta de planificación y registro. No ofrece
      asesoramiento financiero, de inversión ni médico, y no recomienda comprar o vender ningún instrumento. Los CFD son
      instrumentos complejos y conllevan un riesgo elevado de perder dinero rápidamente debido al apalancamiento. Valora
      si comprendes cómo funcionan y si puedes permitirte asumir ese riesgo. Los resultados pasados no garantizan
      resultados futuros.
    </p>
  )
}
