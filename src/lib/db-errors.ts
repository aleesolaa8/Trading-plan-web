/** Mensajes claros para los límites que comprueba la base de datos. */
export function friendlyDbError(e: { message?: string; details?: string | null } | null, fallback: string): string {
  const m = e?.message ?? ''
  if (m.includes('journal_limit'))
    return `Has llegado a las ${e?.details ?? 30} entradas de este mes del plan Free. Con Core el journal no tiene límite.`
  if (m.includes('accounts_limit'))
    return Number(e?.details) > 1
      ? `Tu plan permite hasta ${e?.details} cuentas activas. Archiva una para añadir otra.`
      : 'Tu plan incluye 1 cuenta. Con Pro puedes tener hasta 3 (personal, fondeo y demo).'
  if (m.includes('funded_locked')) return 'El modo fondeo, con sus límites y avisos, está incluido en Pro.'
  return fallback
}
