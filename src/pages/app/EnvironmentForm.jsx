import { useState } from 'react'
import ErrorBanner from '../../components/ErrorBanner'

// Add or change an environment (O1): code, name, description, gate. The
// controls are the administrators' (A2).
export default function EnvironmentForm({ env, saveLabel, onSave, onCancel }) {
  const [f, setF] = useState({
    envCode: env?.envCode ?? '', envName: env?.envName ?? '', envDescription: env?.envDescription ?? '',
    promoGate: env?.promoGate === 'Y',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (name) => (e) => setF((x) => ({ ...x, [name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave({
        envCode: f.envCode.trim().toUpperCase(), envName: f.envName.trim(), envDescription: f.envDescription.trim(),
        promoGate: f.promoGate ? 'Y' : 'N',
      })
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl basis-full flex-col gap-3 rounded-md bg-surface-2 p-3">
      {error && <ErrorBanner error={error} />}
      <div className="flex gap-3">
        <label className="flex w-32 flex-col gap-1 text-[13px]">
          Code
          <input className="input font-mono uppercase" required maxLength={8} value={f.envCode} onChange={set('envCode')} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[13px]">
          Name
          <input className="input" required maxLength={60} value={f.envName} onChange={set('envName')} />
        </label>
      </div>
      <span className="-mt-2 text-[12px] text-fg-3">
        The code: A-Z and 0-9, at most 8. The jobs see it as <code className="font-mono">{'${LWDENV}'}</code>.
      </span>
      <label className="flex flex-col gap-1 text-[13px]">
        Description (optional)
        <textarea className="input h-16 py-1.5" maxLength={1000} value={f.envDescription} onChange={set('envDescription')} />
      </label>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={f.promoGate} onChange={set('promoGate')} />
        Promotion gate: a version must have succeeded in the previous environment first
      </label>
      {!env && (
        <p className="text-[12px] text-fg-3">
          A new environment needs approval and has no deploy userid: it can&apos;t be deployed to until an
          administrator sets its controls.
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : saveLabel}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
