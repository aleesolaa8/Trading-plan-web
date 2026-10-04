/* Textos de cada plan. Se usan en la portada y en Ajustes, y salen de plans.features:
   si cambias un límite en la base de datos, cambia aquí sin desplegar. */

export type TierId = 'free' | 'core' | 'pro'
type F = Record<string, number | boolean | null | undefined>

export const TIER_FOR: Record<TierId, string> = {
  free: 'Para empezar con orden, sin pagar nada',
  core: 'Para operar con un plan y cumplirlo cada día',
  pro: 'Para quien opera muchas horas, con fondeo o varias cuentas',
}

export function tierBullets(id: TierId, f: F): { lead?: string; items: string[] } {
  const msgs = Number(f.copilot_messages_per_month ?? 0)
  const drafts = Number(f.ai_plan_generations ?? 0)
  if (id === 'free')
    return {
      items: [
        'Diagnóstico de 7 preguntas y plan con tus reglas',
        'Protocolos, checklist y calendario semanal',
        'Calculadora de riesgo para cualquier mercado',
        `Journal: ${f.journal_entries_per_month ?? 30} entradas al mes`,
        `Copiloto con IA: ${msgs} mensajes al mes`,
        `${drafts} redacción del plan con IA al mes`,
      ],
    }
  if (id === 'core')
    return {
      lead: 'Todo lo de Free, y además:',
      items: [
        'Journal ilimitado',
        'Patrones sin juicio con un consejo práctico',
        'Resumen semanal de tus números',
        `Copiloto con IA: ${msgs} mensajes al mes`,
        `${drafts} redacciones del plan con IA al mes`,
        'Exporta tus datos cuando quieras (CSV)',
      ],
    }
  return {
    lead: 'Todo lo de Core, y además:',
    items: [
      'Copiloto 24 h sin límite',
      'Revisión semanal escrita por IA con propuestas',
      'La IA revisa tus capturas frente a tu setup escrito',
      'Estadísticas por mercado, hora, día y emoción',
      `Hasta ${f.max_accounts ?? 3} cuentas: personal, fondeo y demo`,
      'Modo fondeo: margen diario y caída máxima con avisos',
      'Informe mensual en PDF',
    ],
  }
}

export const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
