'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useImperativeHandle, useRef, useState, useTransition } from 'react'
import { notifyNow } from '@/components/app/Reminders'
import ui from '@/components/app/ui.module.css'
import type { Account, EntryRow } from '@/lib/data'
import { COMPLIANCE, EMOTIONS, ERRORS, type Compliance, type Emotion, type MainError } from '@/lib/domain/journal'
import { createClient } from '@/lib/supabase/client'
import { saveEntry } from './actions'
import styles from './journal.module.css'

type Draft = {
  id?: string
  type: 'trade' | 'skipped'
  date: string
  time: string
  accountId: string
  asset: string
  direction: 'long' | 'short' | ''
  resultR: string
  amount: string
  emotion: Emotion | ''
  compliance: Compliance | ''
  error: MainError
  lesson: string
  skipReason: string
  screenshotPath: string | null
  checklistRunId: string | null
}

export type FormPreset = { type: 'trade' | 'skipped'; asset?: string; accountId?: string; checklistRunId?: string } | null
export type JournalFormApi = { edit: (e: EntryRow) => void }
const str = (n: number | null) => (n == null ? '' : String(n).replace('.', ','))

/** Botones para registrar y el formulario en un diálogo. También abre una entrada para editarla. */
export function JournalForm({
  userId,
  today,
  nowTime,
  accounts,
  markets,
  preset,
  api,
  showButtons = true,
}: {
  userId: string
  today: string
  nowTime: string
  accounts: Account[]
  markets: string[]
  preset?: FormPreset
  api?: React.Ref<JournalFormApi>
  showButtons?: boolean
}) {
  const router = useRouter()
  const dlg = useRef<HTMLDialogElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const active = accounts.filter((a) => !a.archived)
  const [msg, setMsg] = useState<string | null>(null)
  const [limit, setLimit] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, start] = useTransition()

  const blank = (type: Draft['type'], p?: FormPreset): Draft => ({
    type,
    date: today,
    time: nowTime,
    accountId: p?.accountId ?? active[0]?.id ?? '',
    asset: p?.asset ?? markets[0] ?? '',
    direction: '',
    resultR: '',
    amount: '',
    emotion: '',
    compliance: '',
    error: 'ninguno',
    lesson: '',
    skipReason: '',
    screenshotPath: null,
    checklistRunId: p?.checklistRunId ?? null,
  })

  // Se abre al llegar desde la calculadora (?nueva=…)
  const [d, setD] = useState<Draft | null>(() => (preset ? blank(preset.type, preset) : null))
  useEffect(() => {
    if (d && !dlg.current?.open) dlg.current?.showModal()
  }, [d])

  const open = (draft: Draft) => {
    setMsg(null)
    setD(draft)
  }

  useImperativeHandle(api, () => ({
    edit: (e: EntryRow) =>
      open({
        id: e.id,
        type: e.type,
        date: e.date,
        time: e.time ?? '',
        accountId: e.accountId ?? '',
        asset: e.asset,
        direction: e.direction ?? '',
        resultR: str(e.resultR),
        amount: str(e.amount),
        emotion: e.emotion ?? '',
        compliance: e.compliance ?? '',
        error: e.error ?? 'ninguno',
        lesson: e.lesson ?? '',
        skipReason: e.skipReason ?? '',
        screenshotPath: e.screenshotPath,
        checklistRunId: null,
      }),
  }))

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => (x ? { ...x, [k]: v } : x))
  const funded = active.find((a) => a.id === d?.accountId)?.kind === 'fondeo'

  const upload = async (file: File) => {
    if (!d) return
    if (!file.type.startsWith('image/')) return setMsg('Sube una imagen (PNG, JPG o WebP).')
    if (file.size > 5 * 1024 * 1024) return setMsg('La imagen pesa más de 5 MB.')
    setUploading(true)
    setMsg(null)
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z]/g, '') || 'png'
    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error } = await createClient().storage.from('journal').upload(path, file, { contentType: file.type, upsert: false })
    setUploading(false)
    if (error) return setMsg('No se ha podido subir la captura.')
    set('screenshotPath', path)
  }

  const submit = () =>
    d &&
    start(async () => {
      const r = await saveEntry({ ...d, accountId: d.accountId || null, direction: d.direction || null, emotion: d.emotion || null, compliance: d.compliance || null })
      if (!r.ok) return setMsg(r.message ?? 'No se ha podido guardar.')
      dlg.current?.close()
      if (r.limit) {
        setLimit(r.limit)
        notifyNow('Límite del día', r.limit)
      }
      router.replace('/panel/journal', { scroll: false })
      router.refresh()
    })

  return (
    <>
      {showButtons && (
        <div className={ui.row}>
          <button type="button" className="btn btn-primary" onClick={() => open(blank('trade'))}>
            + Registrar operación
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => open(blank('skipped'))}>
            + No realizada
          </button>
        </div>
      )}
      {limit && (
        <p className="notice notice-error" role="alert" style={{ marginTop: 12 }}>
          {limit}
        </p>
      )}

      <dialog
        ref={dlg}
        className={ui.dialog}
        onClose={() => setD(null)}
        aria-labelledby="jr-title"
      >
        {d && (
          <form
            className={ui.dialogBody}
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <div className={ui.dialogHead}>
              <h2 id="jr-title">{d.id ? 'Editar entrada' : d.type === 'trade' ? 'Nueva operación' : 'Operación no realizada'}</h2>
              <button type="button" className={ui.x} onClick={() => dlg.current?.close()} aria-label="Cerrar">
                ×
              </button>
            </div>
            <div className={ui.seg} role="group" aria-label="Tipo de entrada">
              <button type="button" aria-pressed={d.type === 'trade'} onClick={() => set('type', 'trade')}>
                Operación
              </button>
              <button type="button" aria-pressed={d.type === 'skipped'} onClick={() => set('type', 'skipped')}>
                No realizada
              </button>
            </div>
            {d.checklistRunId && <p className="notice notice-ok">Checklist guardado con esta entrada.</p>}

            <div className={ui.formGrid}>
              <label className="field">
                <span className="field-label">Fecha</span>
                <input className="input" type="date" value={d.date} max={today} onChange={(e) => set('date', e.target.value)} required />
              </label>
              <label className="field">
                <span className="field-label">Hora</span>
                <input className="input" type="time" value={d.time} onChange={(e) => set('time', e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">Mercado</span>
                <input className="input" list="jr-markets" value={d.asset} onChange={(e) => set('asset', e.target.value)} required maxLength={30} />
                <datalist id="jr-markets">
                  {markets.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>
              {active.length > 1 && (
                <label className="field">
                  <span className="field-label">Cuenta</span>
                  <select className={`input ${ui.select}`} value={d.accountId} onChange={(e) => set('accountId', e.target.value)}>
                    {active.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {d.type === 'trade' ? (
              <>
                <div className={ui.formGrid}>
                  <fieldset className={styles.chips}>
                    <legend className="field-label">Dirección</legend>
                    {(['long', 'short'] as const).map((x) => (
                      <label key={x}>
                        <input type="radio" name="dir" checked={d.direction === x} onChange={() => set('direction', x)} />
                        {x === 'long' ? 'Compra' : 'Venta'}
                      </label>
                    ))}
                  </fieldset>
                  <label className="field">
                    <span className="field-label">Resultado en R</span>
                    <input className="input" inputMode="decimal" value={d.resultR} onChange={(e) => set('resultR', e.target.value.replace('−', '-'))} placeholder="2 · −1 · 0,5" required />
                  </label>
                  <label className="field">
                    <span className="field-label">Resultado en dinero{funded ? '' : ' (opcional)'}</span>
                    <input className="input" inputMode="decimal" value={d.amount} onChange={(e) => set('amount', e.target.value.replace('−', '-'))} placeholder="−150" required={funded} />
                  </label>
                </div>
                <fieldset className={styles.chips}>
                  <legend className="field-label">¿Cumpliste tu plan?</legend>
                  {Object.entries(COMPLIANCE).map(([k, v]) => (
                    <label key={k}>
                      <input type="radio" name="comp" checked={d.compliance === k} onChange={() => set('compliance', k as Compliance)} />
                      {v}
                    </label>
                  ))}
                </fieldset>
                <label className="field">
                  <span className="field-label">Error principal</span>
                  <select className={`input ${ui.select}`} value={d.error} onChange={(e) => set('error', e.target.value as MainError)}>
                    {Object.entries(ERRORS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <label className="field">
                <span className="field-label">¿Por qué no entraste?</span>
                <input className="input" value={d.skipReason} onChange={(e) => set('skipReason', e.target.value)} maxLength={300} placeholder="Ej.: no se cumplía el setup, fuera de horario…" required />
              </label>
            )}

            <fieldset className={styles.chips}>
              <legend className="field-label">Cómo estabas antes</legend>
              {Object.entries(EMOTIONS).map(([k, v]) => (
                <label key={k}>
                  <input type="radio" name="emo" checked={d.emotion === k} onChange={() => set('emotion', k as Emotion)} />
                  {v}
                </label>
              ))}
            </fieldset>
            <label className="field">
              <span className="field-label">Lección o nota</span>
              <textarea className="input" value={d.lesson} onChange={(e) => set('lesson', e.target.value)} maxLength={1000} placeholder="Qué repetirías y qué no" />
            </label>
            <div className="field">
              <span className="field-label">Captura (opcional)</span>
              <div className={ui.row}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void upload(f)
                    e.target.value = ''
                  }}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? 'Subiendo…' : d.screenshotPath ? 'Cambiar captura' : 'Subir captura'}
                </button>
                {d.screenshotPath && (
                  <>
                    <span className="chip">Captura lista</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('screenshotPath', null)}>
                      Quitar
                    </button>
                  </>
                )}
              </div>
            </div>
            {msg && (
              <p className="notice notice-error" role="alert">
                {msg}
              </p>
            )}
            <div className={ui.dialogActions}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => dlg.current?.close()}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={pending || uploading}>
                {pending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  )
}
