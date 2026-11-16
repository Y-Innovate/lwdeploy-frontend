import { useState } from 'react'
import { requestDeployment } from '../../api/deployments'
import ErrorBanner from '../../components/ErrorBanner'
import { isYes } from '../../lib/codes'
import { formatTs, fromInputValue } from '../../lib/timestamps'

// The form of D1: environment, version, start, note. envs: the
// application's environments (with canDeploy), vers: its active versions.
export default function RequestForm({ appID, envs, vers, initialEnvID, onRequested }) {
  const deployable = envs.filter((e) => isYes(e.canDeploy))
  const [envID, setEnvID] = useState(deployable.some((e) => e.envID === initialEnvID) ? initialEnvID : deployable[0]?.envID ?? 0)
  const [versionID, setVersionID] = useState(vers[0]?.versionID ?? 0)
  const [when, setWhen] = useState('now')
  const [startAt, setStartAt] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const env = envs.find((e) => e.envID === envID)
  const previous = env && envs.filter((e) => e.sortOrder < env.sortOrder).at(-1)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const startAfter = when === 'later' ? fromInputValue(startAt) : ''
      const d = await requestDeployment({ appID, envID, versionID, startAfter, requestNote: note.trim() })
      onRequested(d)
    } catch (err) {
      setError(refusalText(err))
      setBusy(false)
    }
  }

  if (!deployable.length) {
    return <p className="card p-6 text-fg-2">You may not deploy to any environment of this application.</p>
  }
  if (!vers.length) return <p className="card p-6 text-fg-2">This application has no active versions to deploy.</p>

  return (
    <form onSubmit={submit} className="card flex max-w-xl flex-col gap-4 p-6">
      {error && <ErrorBanner error={error} />}
      <label className="flex flex-col gap-1 text-[13px]">
        Environment
        <select className="input" value={envID} onChange={(e) => setEnvID(Number(e.target.value))}>
          {deployable.map((e) => (
            <option key={e.envID} value={e.envID}>{e.envCode} – {e.envName}</option>
          ))}
        </select>
      </label>
      {env && <EnvNotes env={env} previous={previous} />}
      <label className="flex flex-col gap-1 text-[13px]">
        Version
        <select className="input" value={versionID} onChange={(e) => setVersionID(Number(e.target.value))}>
          {vers.map((v) => (
            <option key={v.versionID} value={v.versionID}>{v.versionName}</option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-2 text-[13px]">
        <legend className="mb-1">Start</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="when" checked={when === 'now'} onChange={() => setWhen('now')} />
          As soon as possible
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="when" checked={when === 'later'} onChange={() => setWhen('later')} />
          Not before
          <input
            type="datetime-local"
            aria-label="Start time"
            className="input w-auto"
            value={startAt}
            disabled={when !== 'later'}
            required={when === 'later'}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </label>
        <span className="text-[12px] text-fg-3">In the mainframe&apos;s local time.</span>
      </fieldset>
      <label className="flex flex-col gap-1 text-[13px]">
        Note (optional)
        <textarea className="input h-20 py-1.5" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div>
        <button type="submit" className="btn-primary" disabled={busy}>
          <i className="ti ti-rocket" aria-hidden="true" />
          {busy ? 'Requesting…' : 'Request deployment'}
        </button>
      </div>
    </form>
  )
}

// What the user should know before requesting: approval and the gate.
// The gate is checked by the backend; this only shows the previous
// environment's current version as a hint.
function EnvNotes({ env, previous }) {
  const notes = []
  if (isYes(env.approvalReq)) {
    notes.push(`Needs ${env.approvalCount === 1 ? '1 approval' : `${env.approvalCount} approvals`} before it starts.`)
  }
  if (isYes(env.promoGate) && previous) {
    const now = previous.currentVersionName
      ? `${previous.envCode} has ${previous.currentVersionName} since ${formatTs(previous.deployedDate)}.`
      : `${previous.envCode} has nothing deployed yet.`
    notes.push(`The version must have succeeded in ${previous.envCode} first. ${now}`)
  }
  if (env.activeDeplID) notes.push(`Deployment ${env.activeDeplID} holds ${env.envCode} now: a new one waits until it ends or is cancelled.`)
  if (!notes.length) return null
  return (
    <ul className="flex flex-col gap-1 rounded-md bg-info-bg px-3 py-2 text-[12px] text-info-fg">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  )
}

function refusalText(err) {
  if (err.isGateNotPassed) return `Promotion gate: ${err.infoMessage}`
  if (err.isVariableMissing) return `A variable has no value: ${err.infoMessage}. Ask an owner of the application.`
  if (err.isNotReady) return `Not ready to deploy: ${err.infoMessage}`
  if (err.isNotAllowed) return `Not allowed: ${err.infoMessage}`
  return err.message
}
