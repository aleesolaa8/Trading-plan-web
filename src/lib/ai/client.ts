import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

/** Modelo por defecto; se puede cambiar con ANTHROPIC_MODEL sin tocar código. */
export const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5'

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

let client: Anthropic | null = null
/** Cliente único del servidor. La clave nunca llega al navegador. */
export function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 })
  return client
}

/** Cabecera beta del respaldo automático si la IA rechaza una petición. */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01' as const
