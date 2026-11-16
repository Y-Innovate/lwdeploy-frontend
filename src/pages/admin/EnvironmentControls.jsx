import { useState } from 'react'
import { setEnvironmentControls } from '../../api/admin'
import { getEnvironment } from '../../api/environments'
import { environments } from '../../api/lists'
import ErrorBanner from '../../components/ErrorBanner'
import { useLoad } from '../../hooks/useLoad'
import { isYes } from '../../lib/codes'
import ListSelect from './ListSelect'

// A2: the environments of an application in order, each with its controls.
// GET /environments has no controls, so each environment is read on its
// own (at most 20). lists: { groups, users }, the allowlists.
export default function EnvironmentControls({ appID, lists }) {
  const envs = useLoad(
    () => environments.list({ appID }).then(({ rows }) => Promise.all(rows.map((e) => getEnvironment(e.envID)))),
    appID,
  )

  if (envs.error) return <ErrorBanner error={envs.error} onRetry={envs.reload} />
  if (!envs.data) return null
  if (envs.data.length === 0) {
    return <p className="card p-6 text-fg-2">No environments yet. The owners add them; then their controls are set here.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {envs.data.map((e) => (
        <EnvCard key={e.envID} env={e} lists={lists} onSaved={envs.reload} />
      ))}
    </ul>
  )
}

function EnvCard({ env: e, lists, onSaved }) {
  const [editing, setEditing] = useState(false)

  async function save(controls) {
    await setEnvironmentControls(e.envID, controls)
    await onSaved()
    setEditing(false)
  }

  return (
    <li className="card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="w-40 min-w-0">
          <div className="font-mono text-[13px] font-medium">{e.envCode}</div>
          <div className="truncate text-[12px] text-fg-3">{e.envName}</div>
        </div>
        {!editing && <Summary env={e} />}
        {!editing && (
          <button type="button" className="btn-secondary ml-auto" aria-label={`Edit controls of ${e.envCode}`}
            onClick={() => setEditing(true)}>
            <i className="ti ti-shield-cog" aria-hidden="true" />
            Edit controls
          </button>
        )}
      </div>
      {editing && <ControlsForm env={e} lists={lists} onSave={save} onCancel={() => setEditing(false)} />}
    </li>
  )
}

function Summary({ env: e }) {
  return (
    <dl className="grid flex-1 grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-[13px]">
      <dt className="text-fg-3">Deploy userid</dt>
      <dd>
        {e.deployUser ? <span className="font-mono">{e.deployUser}</span> : (
          <span className="text-warning-fg">None: can&apos;t be deployed to yet</span>
        )}
      </dd>
      <dt className="text-fg-3">Approval</dt>
      <dd>
        {isYes(e.approvalReq)
          ? <>{approvalText(e.approvalCount)} from <span className="font-mono">{e.approverGroup}</span></>
          : 'Not needed'}
      </dd>
      <dt className="text-fg-3">Deployers</dt>
      <dd>{e.deployerGroup ? <span className="font-mono">{e.deployerGroup}</span> : 'Every member'}</dd>
      <dt className="text-fg-3">Execution node</dt>
      <dd>{e.execNode ? <span className="font-mono">{e.execNode}</span> : 'The local node'}</dd>
    </dl>
  )
}

function ControlsForm({ env: e, lists, onSave, onCancel }) {
  const [c, setC] = useState({
    deployUser: e.deployUser, approvalReq: isYes(e.approvalReq) ? 'Y' : 'N', approverGroup: e.approverGroup,
    approvalCount: Math.max(e.approvalCount, 1), deployerGroup: e.deployerGroup, execNode: e.execNode,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (name) => (value) => setC((x) => ({ ...x, [name]: value }))
  const approval = c.approvalReq === 'Y'

  async function submit(ev) {
    ev.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave({ ...c, approvalCount: approval ? Number(c.approvalCount) : 0, execNode: c.execNode.trim().toUpperCase() })
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-4 border-t-[0.5px] border-line pt-3">
      {error && <ErrorBanner error={error} />}
      <ListSelect label="Deploy userid" value={c.deployUser} onChange={set('deployUser')} rows={lists.users}
        emptyLabel="None: can't be deployed to" hint="The jobs run under this userid." />
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={approval} onChange={(ev) => set('approvalReq')(ev.target.checked ? 'Y' : 'N')} />
        Deployments need approval
      </label>
      {approval && (
        <div className="flex flex-col gap-3 rounded-md bg-surface-2 p-3">
          <ListSelect label="Approver group" value={c.approverGroup} onChange={set('approverGroup')} rows={lists.groups} required />
          <label className="flex w-40 flex-col gap-1 text-[13px]">
            Approvals needed
            <input className="input" type="number" min={1} max={99} required value={c.approvalCount}
              onChange={(ev) => set('approvalCount')(ev.target.value)} />
          </label>
          <p className="text-[12px] text-warning-fg">
            The approver group needs more than {Number(c.approvalCount) || 1} members besides the requester, who never
            counts as an approver. LWD can&apos;t check that: look at the group in RACF.
          </p>
        </div>
      )}
      <ListSelect label="Deployer group" value={c.deployerGroup} onChange={set('deployerGroup')} rows={lists.groups}
        emptyLabel="Every member of the application" hint="Limits who may deploy here, within the access group." />
      <label className="flex w-40 flex-col gap-1 text-[13px]">
        Execution node
        <input className="input font-mono uppercase" maxLength={8} placeholder="local" value={c.execNode}
          onChange={(ev) => set('execNode')(ev.target.value)} />
      </label>
      <span className="-mt-3 text-[12px] text-fg-3">A JES2 node for /*XEQ; empty runs the jobs on the local node.</span>
      <p className="text-[12px] text-fg-3">Deployments already requested keep the controls they were requested with.</p>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save controls'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function approvalText(n) {
  return n === 1 ? '1 approval' : `${n} approvals`
}
