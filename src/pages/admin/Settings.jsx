import { useState } from 'react'
import { updateRefEntry } from '../../api/admin'
import ErrorBanner from '../../components/ErrorBanner'
import { formatTs } from '../../lib/timestamps'
import { useAllowlist } from './useAllowlist'

// The settings an administrator may change (A5), with the backend's ranges
// (lwdeploy/docs/10-iteration-6.md, Decisions); the input only helps, the
// backend checks
const EDITABLE = [
  ['APPRHRS', 'Hours a request waits for approval before it expires', { type: 'number', min: 1, max: 720 }],
  ['JOBMINS', 'Minutes a job may run before the scheduler marks it stuck', { type: 'number', min: 5, max: 1440 }],
  ['OUTDAYS', 'Days job output is kept', { type: 'number', min: 1, max: 3650 }],
  ['OUTLINES', 'Most lines of output kept per job', { type: 'number', min: 1000, max: 500000 }],
  ['GRPMINS', 'Minutes a user’s RACF groups stay cached', { type: 'number', min: 1, max: 1440 }],
  ['JOBCLASS', 'Job class of the deployment jobs', { maxLength: 1, mono: true }],
  ['MSGCLASS', 'Message class of the deployment jobs', { maxLength: 1, mono: true }],
  ['MAILFROM', 'Sender of LWD’s mails', { type: 'email', maxLength: 255 }],
  ['MAILURL', 'Address of the web UI in mails', { type: 'url', maxLength: 255 }],
]

const FIXED = {
  ADMINRES: 'FACILITY resource of the administrators',
  GRPPRFX: 'Prefix of the FACILITY profile per group',
  JOBPRFX: 'First characters of every job name',
  LOADLIB: 'Load library of the result step',
  EXECLIB: 'REXX library of the result step',
  LWDURL: 'Where the result step finds LWW',
  LWDPORT: 'Port of LWW',
  LWDPATH: 'Path of LWD’s API',
  LWWAPPL: 'Applid of LWW’s region, for PassTickets',
  LWDRING: 'Key ring of the result step',
  SUBMUSR: 'Userid of the submit task',
  SUBMTXN: 'Transaction of the submit task',
  SCHEDUSR: 'Userid of the scheduler',
  LASTTICK: 'Last tick of the scheduler',
  MAILWRTR: 'JES writer of CSSMTP; empty: no mail',
  MAILCLS: 'SYSOUT class of the mails',
  MAILMAX: 'Most mails the tick sends at a time',
}

// A5: the settings; the editable ones as a form, the others read-only
export default function Settings() {
  const settings = useAllowlist('SETTINGS')
  if (settings.error) return <ErrorBanner error={settings.error} onRetry={settings.reload} />
  if (!settings.data) return null
  const byKey = Object.fromEntries(settings.data.map((r) => [r.tabKey, r]))
  const editable = EDITABLE.filter(([key]) => byKey[key])
  const editableKeys = new Set(EDITABLE.map(([key]) => key))
  const fixed = settings.data.filter((r) => !editableKeys.has(r.tabKey))

  return (
    <>
      <h1 className="text-[17px] font-medium">Settings</h1>
      <ul className="card flex flex-col divide-y-[0.5px] divide-line">
        {editable.map(([key, text, input]) => (
          <SettingRow key={key} setting={byKey[key]} text={text} input={input} onSaved={settings.reload} />
        ))}
      </ul>
      <h2 className="mt-2 text-[15px] font-medium">Set at installation</h2>
      <p className="text-[13px] text-fg-2">
        These come from <code className="font-mono">envs/&lt;env&gt;.yaml</code> through{' '}
        <code className="font-mono">DDL/SETTINGS</code>, which also puts the ones above back to those values.
        The scheduler sets LASTTICK.
      </p>
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <tbody>
            {fixed.map((r) => (
              <tr key={r.tabKey}>
                <td className="w-32 font-mono">{r.tabKey}</td>
                <td className="text-fg-2">{FIXED[r.tabKey] ?? ''}</td>
                <td className="font-mono">{r.tabKey === 'LASTTICK' ? formatTs(r.tabValue) : r.tabValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function SettingRow({ setting: s, text, input: { mono, ...input }, onSaved }) {
  const [value, setValue] = useState(s.tabValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const range = input.type === 'number' ? ` (${input.min}-${input.max})` : ''

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const r = await updateRefEntry('SETTINGS', s.tabKey, value.trim())
      setValue(r.tabValue)
      setSaved(true)
      await onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 p-4">
      <form onSubmit={save} className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[13px]" htmlFor={`setting-${s.tabKey}`}>
          <span>{text}{range}</span>
          <span className="font-mono text-[11px] text-fg-3">{s.tabKey}, changed {formatTs(s.updatedDate)} by {s.updatedBy}</span>
        </label>
        <input id={`setting-${s.tabKey}`} className={`input w-64 ${mono ? 'font-mono uppercase' : ''}`} required
          {...input} value={value} onChange={(e) => { setValue(e.target.value); setSaved(false) }} />
        <button type="submit" className="btn-secondary" disabled={busy || value.trim() === s.tabValue}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-[12px] text-success-fg" role="status">Saved</span>}
      </form>
      {error && <ErrorBanner error={error} />}
    </li>
  )
}
