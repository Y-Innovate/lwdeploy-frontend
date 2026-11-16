import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { deleteApplication, getAdminApplication, updateApplication } from '../../api/admin'
import ErrorBanner from '../../components/ErrorBanner'
import { useLoad } from '../../hooks/useLoad'
import { formatTs } from '../../lib/timestamps'
import { ADMIN_PATHS, linkTo, PATHS } from '../../routes'
import ApplicationForm from './ApplicationForm'
import EnvironmentControls from './EnvironmentControls'
import { useAllowlist } from './useAllowlist'

// A1, A2: one application, its groups, deleting it, and the controls of
// its environments. /admin/app?appID=1
export default function AdminApplication() {
  const [params] = useSearchParams()
  const appID = Number(params.get('appID')) || 0
  // A fresh page per application, so no form stays open from the last one
  return <ApplicationPage key={appID} appID={appID} />
}

function ApplicationPage({ appID }) {
  const app = useLoad(() => getAdminApplication(appID), appID, { enabled: appID > 0 })
  const groups = useAllowlist('RACFGRP')
  const users = useAllowlist('DEPLUSER')
  const [editing, setEditing] = useState(false)

  if (!appID || app.error?.isNotFound) {
    return (
      <section className="card p-6">
        <h1 className="text-[17px] font-medium">Application not found</h1>
        <p className="mt-1 text-fg-2">
          <Link className="underline" to={ADMIN_PATHS.applications}>See all applications</Link>.
        </p>
      </section>
    )
  }
  if (app.error) return <ErrorBanner error={app.error} onRetry={app.reload} />
  if (!app.data) return null
  const a = app.data
  const lists = { groups: groups.data ?? [], users: users.data ?? [] }
  const listError = groups.error ?? users.error

  async function save(fields) {
    await updateApplication(appID, fields)
    await app.reload()
    setEditing(false)
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[17px] font-medium">
          <span className="font-mono">{a.appCode}</span> {a.appName}
        </h1>
        <Link className="ml-auto text-[13px] underline" to={linkTo(PATHS.app, { appID })}>Application page</Link>
      </header>
      {listError && <ErrorBanner error={listError} onRetry={() => { groups.reload(); users.reload() }} />}
      {editing && groups.data ? (
        <ApplicationForm app={a} groups={lists.groups} saveLabel="Save" onSave={save} onCancel={() => setEditing(false)} />
      ) : (
        <Details app={a} onEdit={() => setEditing(true)} />
      )}
      <h2 className="mt-2 text-[15px] font-medium">Environments</h2>
      <EnvironmentControls appID={appID} lists={lists} />
      <Delete app={a} />
    </>
  )
}

function Details({ app: a, onEdit }) {
  return (
    <section className="card flex flex-col gap-3 p-6 text-[13px]">
      {a.appDescription && <p className="text-fg-2">{a.appDescription}</p>}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
        <dt className="text-fg-3">Access group</dt>
        <dd className="font-mono">{a.accessGroup}</dd>
        <dt className="text-fg-3">Owner group</dt>
        <dd className="font-mono">{a.ownerGroup}</dd>
        <dt className="text-fg-3">Created</dt>
        <dd>{formatTs(a.createdDate)} by {a.createdBy}</dd>
        <dt className="text-fg-3">Changed</dt>
        <dd>{formatTs(a.updatedDate)} by {a.updatedBy}</dd>
      </dl>
      <div>
        <button type="button" className="btn-secondary" onClick={onEdit}>
          <i className="ti ti-pencil" aria-hidden="true" />
          Edit
        </button>
      </div>
    </section>
  )
}

// Deleting asks first; the backend refuses an application with
// deployments (08 53), and says how many
function Delete({ app: a }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await deleteApplication(a.appID)
      navigate(ADMIN_PATHS.applications)
    } catch (err) {
      setError(err.isWrongState ? err.infoMessage : err)
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="mt-2">
        <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
          <i className="ti ti-trash" aria-hidden="true" />
          Delete application
        </button>
      </div>
    )
  }
  return (
    <section className="card mt-2 flex max-w-xl flex-col gap-3 p-4">
      <p className="text-[13px] text-fg-2">
        Deletes {a.appCode} with its environments, versions, variables and job templates. Only an application
        that was never deployed can be deleted.
      </p>
      {error && <ErrorBanner error={error} />}
      <div className="flex gap-2">
        <button type="button" className="btn-danger" disabled={busy} onClick={confirm}>
          {busy ? 'Deleting…' : `Delete ${a.appCode}`}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Back</button>
      </div>
    </section>
  )
}
