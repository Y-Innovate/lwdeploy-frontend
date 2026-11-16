import { useState } from 'react'
import { Link } from 'react-router'
import { createEnvironment, deleteEnvironment, getEnvironment, updateEnvironment } from '../../api/environments'
import { environments } from '../../api/lists'
import ConfirmAction from '../../components/ConfirmAction'
import ErrorBanner from '../../components/ErrorBanner'
import { useLoad } from '../../hooks/useLoad'
import { isYes } from '../../lib/codes'
import { formatTs } from '../../lib/timestamps'
import { linkTo, PATHS } from '../../routes'
import EnvironmentForm from './EnvironmentForm'
import VariableList from './VariableList'

// The fields PUT /environments wants, from GET /environments/{envID}
const fieldsOf = ({ envCode, envName, envDescription, sortOrder, promoGate }) =>
  ({ envCode, envName, envDescription, sortOrder, promoGate })

// The environments in order, with what is deployed where (M2); for owners
// also add, edit, reorder and delete (O1). Everyone sees the variables.
export default function Environments({ appID, isOwner = false }) {
  const envs = useLoad(() => environments.list({ appID }).then((r) => r.rows), appID)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)

  if (envs.error) return <ErrorBanner error={envs.error} onRetry={envs.reload} />
  if (!envs.data) return null
  const list = envs.data

  // Moving swaps the order of two neighbours, with two updates; never 0,
  // which the backend takes as "keep the order"
  async function move(index, by) {
    setError(null)
    try {
      const [a, b] = await Promise.all([getEnvironment(list[index].envID), getEnvironment(list[index + by].envID)])
      const [orderA, orderB] = a.sortOrder === b.sortOrder
      ? (by < 0 ? [a.sortOrder, a.sortOrder + 1] : [a.sortOrder + 1, a.sortOrder])
      : [b.sortOrder, a.sortOrder]
      await updateEnvironment(a.envID, { ...fieldsOf(a), sortOrder: orderA })
      await updateEnvironment(b.envID, { ...fieldsOf(b), sortOrder: orderB })
    } catch (err) {
      setError(err)
    }
    await envs.reload()
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <ErrorBanner error={error} />}
      {list.length === 0 && <p className="card p-6 text-fg-2">This application has no environments yet.</p>}
      {list.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.map((e, i) => (
            <EnvRow key={e.envID} appID={appID} env={e} isOwner={isOwner} onChanged={envs.reload}
              onMove={isOwner ? { up: i > 0 && (() => move(i, -1)), down: i < list.length - 1 && (() => move(i, 1)) } : null} />
          ))}
        </ul>
      )}
      {isOwner && (adding ? (
        <div className="card p-4">
          <EnvironmentForm saveLabel="Add environment" onCancel={() => setAdding(false)}
            onSave={async (fields) => {
              await createEnvironment(appID, { ...fields, sortOrder: 0 })
              await envs.reload()
              setAdding(false)
            }} />
        </div>
      ) : (
        <div>
          <button type="button" className="btn-secondary" onClick={() => setAdding(true)} disabled={list.length >= 20}>
            <i className="ti ti-plus" aria-hidden="true" />
            Add environment
          </button>
          {list.length >= 20 && <span className="ml-2 text-[12px] text-fg-3">20 environments is the most there can be.</span>}
        </div>
      ))}
    </div>
  )
}

function EnvRow({ appID, env: e, isOwner, onChanged, onMove }) {
  const [open, setOpen] = useState(null)
  const [full, setFull] = useState(null)
  const [error, setError] = useState(null)
  const toggle = (name) => setOpen((o) => (o === name ? null : name))

  async function edit() {
    setError(null)
    try {
      setFull(await getEnvironment(e.envID))
      setOpen('edit')
    } catch (err) {
      setError(err)
    }
  }

  return (
    <li className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
      <div className="w-40 min-w-0">
        <div className="font-mono text-[13px] font-medium">{e.envCode}</div>
        <div className="truncate text-[12px] text-fg-3">{e.envName}</div>
      </div>
      <div className="min-w-0 flex-1">
        {e.currentVersionID ? (
          <div className="text-[14px]">
            <Link className="font-medium hover:underline" to={linkTo(PATHS.deployment, { deplID: e.currentDeplID })}>
              {e.currentVersionName}
            </Link>
            <span className="ml-2 text-[12px] text-fg-3">deployed {formatTs(e.deployedDate)}</span>
          </div>
        ) : (
          <div className="text-[13px] text-fg-3">Nothing deployed yet</div>
        )}
        {e.envState === 'H' && (
          <div className="mt-1 flex items-center gap-1 text-[12px] text-warning-fg">
            <i className="ti ti-alert-triangle" aria-hidden="true" />
            May be half deployed: a later deployment failed or was cancelled after it had started.
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          {isYes(e.approvalReq) && <Tag icon="ti-user-check">{approvalText(e.approvalCount)}</Tag>}
          {isYes(e.promoGate) && <Tag icon="ti-arrow-bar-to-right">Promotion gate</Tag>}
          {e.activeDeplID > 0 && (
            <Link to={linkTo(PATHS.deployment, { deplID: e.activeDeplID })}>
              <Tag icon="ti-lock">Held by deployment {e.activeDeplID}</Tag>
            </Link>
          )}
        </div>
      </div>
      {isYes(e.canDeploy) && (
        <Link className="btn-primary" to={linkTo(PATHS.deploy, { appID, envID: e.envID })}>
          <i className="ti ti-rocket" aria-hidden="true" />
          Deploy
        </Link>
      )}
      <div className="flex basis-full flex-wrap items-center gap-1 border-t-[0.5px] border-line pt-2">
        <button type="button" className="btn-secondary" aria-expanded={open === 'variables'} onClick={() => toggle('variables')}>
          <i className="ti ti-variable" aria-hidden="true" />
          Variables
        </button>
        {isOwner && (
          <>
            <button type="button" className="btn-secondary" onClick={edit}>
              <i className="ti ti-pencil" aria-hidden="true" />
              Edit
            </button>
            <button type="button" className="icon-btn" aria-label={`Move ${e.envCode} up`} disabled={!onMove.up} onClick={onMove.up || undefined}>
              <i className="ti ti-arrow-up" aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn" aria-label={`Move ${e.envCode} down`} disabled={!onMove.down} onClick={onMove.down || undefined}>
              <i className="ti ti-arrow-down" aria-hidden="true" />
            </button>
            <span className="flex-1" />
            <ConfirmAction label="Delete" question={`Delete ${e.envCode} with its variables? Only an environment that was never deployed to can be deleted.`}
              confirmLabel={`Delete ${e.envCode}`} action={async () => { await deleteEnvironment(e.envID); await onChanged() }} />
          </>
        )}
      </div>
      {error && <div className="basis-full"><ErrorBanner error={error} /></div>}
      {open === 'edit' && full && (
        <EnvironmentForm env={full} saveLabel="Save" onCancel={() => setOpen(null)}
          onSave={async (fields) => {
            await updateEnvironment(e.envID, { ...fields, sortOrder: full.sortOrder })
            await onChanged()
            setOpen(null)
          }} />
      )}
      {open === 'variables' && (
        <div className="basis-full">
          <VariableList level={{ appID, envID: e.envID }} canEdit={isOwner} what={e.envCode} />
        </div>
      )}
    </li>
  )
}

function approvalText(n) {
  return n === 1 ? '1 approval' : `${n} approvals`
}

function Tag({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-fg-2">
      <i className={`ti ${icon}`} aria-hidden="true" />
      {children}
    </span>
  )
}
