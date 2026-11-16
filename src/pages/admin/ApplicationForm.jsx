import { useState } from 'react'
import ErrorBanner from '../../components/ErrorBanner'
import ListSelect from './ListSelect'

const EMPTY = { appCode: '', appName: '', appDescription: '', accessGroup: '', ownerGroup: '' }

// Create or change an application (A1). groups: the RACFGRP allowlist.
// onSave(fields) returns a promise; its refusal is shown here.
export default function ApplicationForm({ app, groups, onSave, onCancel, saveLabel }) {
  const [fields, setFields] = useState(() => (app ? pick(app) : EMPTY))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (name) => (value) => setFields((f) => ({ ...f, [name]: value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave({ ...fields, appCode: fields.appCode.trim().toUpperCase(), appName: fields.appName.trim(),
        appDescription: fields.appDescription.trim() })
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card flex max-w-xl flex-col gap-4 p-6">
      {error && <ErrorBanner error={error} />}
      <div className="flex gap-4">
        <label className="flex w-32 flex-col gap-1 text-[13px]">
          Code
          <input className="input font-mono uppercase" required maxLength={8} pattern="[A-Za-z0-9]{1,8}"
            value={fields.appCode} onChange={(e) => set('appCode')(e.target.value)} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[13px]">
          Name
          <input className="input" required maxLength={60} value={fields.appName} onChange={(e) => set('appName')(e.target.value)} />
        </label>
      </div>
      <span className="-mt-2 text-[12px] text-fg-3">
        The code: A-Z and 0-9, at most 8. The jobs see it as <code className="font-mono">{'${LWDAPP}'}</code>.
      </span>
      <label className="flex flex-col gap-1 text-[13px]">
        Description (optional)
        <textarea className="input h-20 py-1.5" maxLength={1000} value={fields.appDescription}
          onChange={(e) => set('appDescription')(e.target.value)} />
      </label>
      <ListSelect label="Access group" value={fields.accessGroup} onChange={set('accessGroup')} rows={groups} required
        hint="Its members see the application and may deploy." />
      <ListSelect label="Owner group" value={fields.ownerGroup} onChange={set('ownerGroup')} rows={groups} required
        hint="Its members keep the environments, templates, variables and versions." />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : saveLabel}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function pick({ appCode, appName, appDescription, accessGroup, ownerGroup }) {
  return { appCode, appName, appDescription, accessGroup, ownerGroup }
}
