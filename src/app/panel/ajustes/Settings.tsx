'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { deleteAsset, saveAccount, setAccountArchived, updateProfile } from '@/app/panel/actions'
import ui from '@/components/app/ui.module.css'
import type { Account, Asset } from '@/lib/data'
import { ACCOUNT_KINDS, type AccountKind } from '@/lib/domain/journal'
import { deleteMyAccount } from './actions'
import styles from './ajustes.module.css'

const ZONES = [
  'Europe/Madrid',
  'Atlantic/Canary',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Caracas',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'UTC',
]

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null
  return (
    <p className={`notice ${m.ok ? 'notice-ok' : 'notice-error'}`} role={m.ok ? 'status' : 'alert'}>
      {m.text}
    </p>
  )
}

export function ProfileForm({ name, timezone }: { name: string; timezone: string }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const zones = ZONES.includes(timezone) ? ZONES : [timezone, ...ZONES]
  return (
    <form
      className={ui.formGrid}
      onSubmit={(e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        start(async () => {
          const r = await updateProfile({ name: f.get('name'), timezone: f.get('timezone') })
          setMsg({ ok: r.ok, text: r.ok ? 'Guardado.' : (r.message ?? 'No se ha podido guardar.') })
        })
      }}
    >
      <label className="field">
        <span className="field-label">Tu nombre</span>
        <input className="input" name="name" defaultValue={name} maxLength={40} required />
      </label>
      <label className="field">
        <span className="field-label">Zona horaria</span>
        <select className={`input ${ui.select}`} name="timezone" defaultValue={timezone}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, ' ').replace('/', ' · ')}
            </option>
          ))}
        </select>
      </label>
      <div className={`${ui.full} ${ui.row}`}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        <Msg m={msg} />
      </div>
    </form>
  )
}

type Draft = { id?: string; name: string; kind: AccountKind; balance: string; currency: string; initial: string; daily: string; drawdown: string; target: string }
const str = (n: number | null) => (n == null ? '' : String(n).replace('.', ','))
const money = (n: number | null, c: string) => (n == null ? '—' : `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ${c}`)

export function Accounts({ accounts, max, funded }: { accounts: Account[]; max: number; funded: boolean }) {
  const router = useRouter()
  const dlg = useRef<HTMLDialogElement>(null)
  const [d, setD] = useState<Draft | null>(null)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const active = accounts.filter((a) => !a.archived).length

  const open = (a?: Account) => {
    setMsg(null)
    setD(
      a
        ? { id: a.id, name: a.name, kind: a.kind, balance: str(a.balance), currency: a.currency, initial: str(a.initial), daily: str(a.daily), drawdown: str(a.drawdown), target: str(a.target) }
        : { name: '', kind: 'personal', balance: '', currency: 'EUR', initial: '', daily: '5', drawdown: '10', target: '8' },
    )
    dlg.current?.showModal()
  }
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD((x) => (x ? { ...x, [k]: e.target.value } : x))

  return (
    <>
      <div className={styles.accounts}>
        {accounts.map((a) => (
          <div key={a.id} className={`${styles.account} ${a.archived ? styles.archived : ''}`}>
            <div>
              <div className={ui.row}>
                <b>{a.name}</b>
                <span className={`chip ${a.kind === 'fondeo' ? 'chip-amber' : a.kind === 'demo' ? 'chip-blue' : ''}`}>{ACCOUNT_KINDS[a.kind]}</span>
                {a.archived && <span className="chip chip-red">Archivada</span>}
              </div>
              <small className="muted">
                Saldo {money(a.balance, a.currency)}
                {a.kind === 'fondeo' && a.initial
                  ? ` · Prueba de ${money(a.initial, a.currency)}: −${str(a.daily)} % diario, −${str(a.drawdown)} % máx., objetivo +${str(a.target)} %`
                  : ''}
              </small>
            </div>
            <div className={ui.row}>
              {!a.archived && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(a)}>
                  Editar
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await setAccountArchived(a.id, !a.archived)
                    setMsg(r.ok ? null : { ok: false, text: r.message ?? 'No se ha podido cambiar.' })
                    router.refresh()
                  })
                }
              >
                {a.archived ? 'Recuperar' : 'Archivar'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {!d && <Msg m={msg} />}
      <div className={ui.row}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => open()} disabled={active >= max}>
          Añadir cuenta
        </button>
        <small className="muted">
          {active} de {max} {max === 1 ? 'cuenta' : 'cuentas'} activas.
          {max < 3 && ' Con Pro puedes tener hasta 3 (personal, fondeo y demo).'}
        </small>
      </div>

      <dialog ref={dlg} className={ui.dialog} onClose={() => setD(null)} aria-labelledby="acc-title">
        {d && (
          <form
            className={ui.dialogBody}
            onSubmit={(e) => {
              e.preventDefault()
              start(async () => {
                const r = await saveAccount(d)
                if (r.ok) {
                  dlg.current?.close()
                  router.refresh()
                } else setMsg({ ok: false, text: r.message ?? 'No se ha podido guardar.' })
              })
            }}
          >
            <div className={ui.dialogHead}>
              <h2 id="acc-title">{d.id ? 'Editar cuenta' : 'Nueva cuenta'}</h2>
              <button type="button" className={ui.x} onClick={() => dlg.current?.close()} aria-label="Cerrar">
                ×
              </button>
            </div>
            <div className={ui.formGrid}>
              <label className={`field ${ui.full}`}>
                <span className="field-label">Nombre</span>
                <input className="input" value={d.name} onChange={set('name')} maxLength={40} required placeholder="Ej.: FTMO 100K" />
              </label>
              <label className="field">
                <span className="field-label">Tipo</span>
                <select className={`input ${ui.select}`} value={d.kind} onChange={set('kind')}>
                  <option value="personal">Personal</option>
                  <option value="demo">Demo</option>
                  <option value="fondeo" disabled={!funded}>
                    Fondeo{funded ? '' : ' (Pro)'}
                  </option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Moneda</span>
                <input className="input" value={d.currency} onChange={set('currency')} maxLength={3} />
              </label>
              <label className="field">
                <span className="field-label">Saldo actual</span>
                <input className="input" inputMode="decimal" value={d.balance} onChange={set('balance')} placeholder="10000" />
              </label>
              {d.kind === 'fondeo' && (
                <>
                  <label className="field">
                    <span className="field-label">Capital de la prueba</span>
                    <input className="input" inputMode="decimal" value={d.initial} onChange={set('initial')} placeholder="100000" required />
                  </label>
                  <label className="field">
                    <span className="field-label">Pérdida diaria máx. %</span>
                    <input className="input" inputMode="decimal" value={d.daily} onChange={set('daily')} />
                  </label>
                  <label className="field">
                    <span className="field-label">Caída máxima %</span>
                    <input className="input" inputMode="decimal" value={d.drawdown} onChange={set('drawdown')} />
                  </label>
                  <label className="field">
                    <span className="field-label">Objetivo %</span>
                    <input className="input" inputMode="decimal" value={d.target} onChange={set('target')} />
                  </label>
                  <p className={`muted ${ui.full}`} style={{ fontSize: 13 }}>
                    Copia las reglas de tu empresa de fondeo. Para ver tu margen, registra el resultado en dinero de cada operación en el journal.
                  </p>
                </>
              )}
            </div>
            <Msg m={msg} />
            <div className={ui.dialogActions}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => dlg.current?.close()}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
                {pending ? 'Guardando…' : 'Guardar cuenta'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  )
}

export function AssetsList({ assets }: { assets: Asset[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (!assets.length)
    return <p className="muted">Aún no has guardado datos de ningún mercado. Se guardan desde la calculadora.</p>
  const n = (x: number | null) => (x == null ? '—' : x.toLocaleString('es-ES', { maximumFractionDigits: 6 }))
  return (
    <div className={ui.scrollX}>
      <table className={ui.table}>
        <thead>
          <tr>
            <th>Mercado</th>
            <th className={ui.num}>Valor/punto</th>
            <th className={ui.num}>Lote mín.</th>
            <th className={ui.num}>Paso</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id}>
              <td>
                <b>{a.name}</b>
              </td>
              <td className={ui.num}>
                {n(a.valuePerPoint)} {a.currency}
              </td>
              <td className={ui.num}>{n(a.minLot)}</td>
              <td className={ui.num}>{n(a.lotStep)}</td>
              <td className={ui.num}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={pending}
                  aria-label={`Borrar ${a.name}`}
                  onClick={() =>
                    start(async () => {
                      await deleteAsset(a.id)
                      router.refresh()
                    })
                  }
                >
                  Borrar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DeleteAccount() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [text, setText] = useState('')
  return (
    <form
      className={ui.formGrid}
      onSubmit={(e) => {
        e.preventDefault()
        if (!confirm('Se borrarán tu cuenta y todos tus datos. No se puede deshacer. ¿Continuar?')) return
        start(async () => {
          const r = await deleteMyAccount(text)
          if (r && !r.ok) setMsg({ ok: false, text: r.message ?? 'No se ha podido borrar la cuenta.' })
        })
      }}
    >
      <label className="field">
        <span className="field-label">Escribe ELIMINAR para confirmar</span>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      </label>
      <div className={`${ui.full} ${ui.row}`}>
        <button type="submit" className={`btn btn-ghost btn-sm ${ui.dangerBtn}`} disabled={pending || text.trim().toUpperCase() !== 'ELIMINAR'}>
          {pending ? 'Borrando…' : 'Eliminar mi cuenta y mis datos'}
        </button>
        <Msg m={msg} />
      </div>
    </form>
  )
}
