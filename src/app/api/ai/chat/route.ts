import Anthropic from '@anthropic-ai/sdk'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { AI_MODEL, aiConfigured, anthropic, FALLBACK_BETA } from '@/lib/ai/client'
import { userContext } from '@/lib/ai/context'
import { REPLACE_MARK } from '@/lib/ai/protocol'
import { COPILOT_RULES, CRISIS_HELP, needsCrisisHelp, SAFE_REPLACEMENT, violatesPolicy } from '@/lib/ai/guardrails'
import { createClient, getCurrentUser } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const HISTORY_LIMIT = 20

type Quota = { plan: string | null; used: number; limit: number }

async function session() {
  const user = await getCurrentUser()
  const supabase = await createClient()
  if (!user || !supabase) return null
  return { user, supabase }
}

async function latestThread(s: NonNullable<Awaited<ReturnType<typeof session>>>) {
  const { data } = await s.supabase
    .from('chat_threads')
    .select('id')
    .eq('user_id', s.user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id as string | undefined
}

/** Conversación actual y cupo del mes. */
export async function GET() {
  const s = await session()
  if (!s) return NextResponse.json({ error: 'Tu sesión ha caducado.' }, { status: 401 })
  const threadId = await latestThread(s)
  const [{ data: messages }, { data: quota }] = await Promise.all([
    threadId
      ? s.supabase.from('chat_messages').select('id, role, content').eq('thread_id', threadId).order('id').limit(200)
      : Promise.resolve({ data: [] }),
    s.supabase.rpc('ai_quota', { p_kind: 'chat' }),
  ])
  return NextResponse.json({ threadId: threadId ?? null, messages: messages ?? [], quota: quota as Quota, ready: aiConfigured() })
}

const bodySchema = z.union([
  z.object({ action: z.literal('new') }),
  z.object({ message: z.string().trim().min(1, 'Escribe un mensaje.').max(1500, 'Máximo 1.500 caracteres.') }),
])

export async function POST(req: NextRequest) {
  const s = await session()
  if (!s) return NextResponse.json({ error: 'Tu sesión ha caducado. Vuelve a entrar.' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Mensaje no válido.' }, { status: 400 })

  // Nueva conversación
  if ('action' in parsed.data) {
    const { data } = await s.supabase.from('chat_threads').insert({ user_id: s.user.id }).select('id').single()
    return NextResponse.json({ threadId: data?.id ?? null })
  }

  if (!aiConfigured())
    return NextResponse.json({ error: 'El copiloto aún no está activado en este entorno.' }, { status: 503 })

  const text = parsed.data.message

  // 1. Cupo según el plan (se descuenta en la base de datos, de forma atómica)
  const { data: q, error: qErr } = await s.supabase.rpc('consume_ai_quota', { p_kind: 'chat' })
  if (qErr) return NextResponse.json({ error: 'No hemos podido comprobar tu plan. Inténtalo de nuevo.' }, { status: 500 })
  const quota = q as Quota & { allowed: boolean; usage_id?: number }
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: quota.plan
          ? `Has usado tus ${quota.limit} mensajes de este mes. Con Pro el copiloto no tiene límite.`
          : 'Tu prueba ha terminado. Elige un plan para seguir hablando con tu copiloto.',
        code: quota.plan ? 'quota_exhausted' : 'no_plan',
        quota,
      },
      { status: 402 },
    )
  }
  const refund = () => s.supabase.rpc('refund_ai_quota', { p_usage_id: quota.usage_id })

  // 2. Hilo y mensaje del usuario
  let threadId = await latestThread(s)
  if (!threadId) {
    const { data } = await s.supabase.from('chat_threads').insert({ user_id: s.user.id }).select('id').single()
    threadId = data?.id
  }
  if (!threadId) {
    await refund()
    return NextResponse.json({ error: 'No hemos podido abrir la conversación.' }, { status: 500 })
  }
  const help = needsCrisisHelp(text)
  await s.supabase.from('chat_messages').insert([
    { thread_id: threadId, user_id: s.user.id, role: 'user', content: text },
    ...(help ? [{ thread_id: threadId, user_id: s.user.id, role: 'help', content: CRISIS_HELP }] : []),
  ])
  await s.supabase.from('chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)

  // 3. Historial reciente (solo user/assistant) + datos del usuario
  const [{ data: rows }, context] = await Promise.all([
    s.supabase
      .from('chat_messages')
      .select('role, content')
      .eq('thread_id', threadId)
      .in('role', ['user', 'assistant'])
      .order('id', { ascending: false })
      .limit(HISTORY_LIMIT),
    userContext(s.supabase, s.user.id),
  ])
  const history: Anthropic.Beta.BetaMessageParam[] = (rows ?? [])
    .reverse()
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content as string }))
  while (history.length && history[0]!.role !== 'user') history.shift()

  // 4. Respuesta en streaming
  const encoder = new TextEncoder()
  const userId = s.user.id
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = ''
      try {
        const ai = anthropic().beta.messages.stream(
          {
            model: AI_MODEL,
            max_tokens: 2000,
            betas: [FALLBACK_BETA],
            fallbacks: 'default',
            output_config: { effort: 'low' },
            system: [
              { type: 'text', text: COPILOT_RULES, cache_control: { type: 'ephemeral' } },
              { type: 'text', text: context },
            ],
            messages: history,
          },
          { signal: req.signal },
        )
        for await (const event of ai) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            answer += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        const final = await ai.finalMessage()
        if (final.stop_reason === 'refusal' || !answer.trim()) answer = SAFE_REPLACEMENT
        // 5. Guardarraíl final: si dijo algo prohibido, se sustituye
        if (violatesPolicy(answer) || final.stop_reason === 'refusal' || !final.content.length) {
          answer = SAFE_REPLACEMENT
          controller.enqueue(encoder.encode(REPLACE_MARK + answer))
        }
        await s.supabase.from('chat_messages').insert({ thread_id: threadId, user_id: userId, role: 'assistant', content: answer })
        await s.supabase.rpc('record_ai_tokens', {
          p_usage_id: quota.usage_id,
          p_in: (final.usage.input_tokens ?? 0) + (final.usage.cache_read_input_tokens ?? 0),
          p_out: final.usage.output_tokens ?? 0,
        })
      } catch (err) {
        // Si falla la IA o la persona corta, el mensaje no cuenta en su cupo
        await refund()
        if (answer) await s.supabase.from('chat_messages').insert({ thread_id: threadId, user_id: userId, role: 'assistant', content: answer })
        const msg =
          err instanceof Anthropic.RateLimitError
            ? 'Hay mucha demanda ahora mismo. Vuelve a enviar tu mensaje en un minuto.'
            : 'Se ha cortado la conexión con el copiloto. Vuelve a enviar tu mensaje.'
        if (!req.signal.aborted) controller.enqueue(encoder.encode(REPLACE_MARK + (answer ? `${answer}\n\n${msg}` : msg)))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Thread-Id': threadId,
      'X-Help': help ? '1' : '0',
      'X-Quota-Used': String(quota.used),
      'X-Quota-Limit': String(quota.limit),
      'X-Quota-Plan': quota.plan ?? '',
    },
  })
}
