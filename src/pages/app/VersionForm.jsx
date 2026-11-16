import { useState } from 'react'
import ErrorBanner from '../../components/ErrorBanner'

// Register or change a version (O4): name, where it is, description
export default function VersionForm({ version, saveLabel, onSave, onCancel }) {
  const [f, setF] = useState({
    versionName: version?.versionName ?? '', locType: version?.locType ?? 'D', location: version?.location ?? '',
    versionDescription: version?.versionDescription ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (name) => (e) => setF((x) => ({ ...x, [name]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave({
        versionName: f.versionName.trim().toUpperCase(), locType: f.locType,
        location: f.locType === 'D' ? f.location.trim().toUpperCase() : f.location.trim(),
        versionDescription: f.versionDescription.trim(),
      })
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-3 rounded-md bg-surface-2 p-3">
      {error && <ErrorBanner error={error} />}
      <label className="flex w-64 flex-col gap-1 text-[13px]">
        Name
        <input className="input font-mono uppercase" required maxLength={30} value={f.versionName} onChange={set('versionName')} />
      </label>
      <span className="-mt-2 text-[12px] text-fg-3">
        A-Z, 0-9, dot, _ and -, at most 30. The jobs see it as <code className="font-mono">{'${LWDVER}'}</code>.
      </span>
      <fieldset className="flex flex-wrap gap-4 text-[13px]">
        <legend className="mb-1">Where the build is</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="locType" value="D" checked={f.locType === 'D'} onChange={set('locType')} />
          Dataset prefix
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="locType" value="U" checked={f.locType === 'U'} onChange={set('locType')} />
          USS path
        </label>
      </fieldset>
      <label className="flex flex-col gap-1 text-[13px]">
        Location
        <input className={`input font-mono ${f.locType === 'D' ? 'uppercase' : ''}`} required
          maxLength={f.locType === 'D' ? 44 : 255} placeholder={f.locType === 'D' ? 'LWD.DEMO.V110' : '/u/lwd/demo/v1.1.0'}
          value={f.location} onChange={set('location')} />
      </label>
      <span className="-mt-2 text-[12px] text-fg-3">
        The jobs see it as <code className="font-mono">{'${LWDLOC}'}</code>; whether it exists is checked by the jobs.
      </span>
      <label className="flex flex-col gap-1 text-[13px]">
        Description (optional)
        <textarea className="input h-16 py-1.5" maxLength={1000} value={f.versionDescription} onChange={set('versionDescription')} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : saveLabel}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
