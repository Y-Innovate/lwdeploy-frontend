import { Fragment, useState } from 'react'
import { versions } from '../../api/lists'
import { deleteVersion, registerVersion, retireVersion, updateVersion } from '../../api/versions'
import ConfirmAction from '../../components/ConfirmAction'
import ErrorBanner from '../../components/ErrorBanner'
import LoadMore from '../../components/LoadMore'
import { usePagedList } from '../../hooks/usePagedList'
import { isYes, label, LOC_TYPE, VERSION_STATUS } from '../../lib/codes'
import { formatTs } from '../../lib/timestamps'
import VariableList from './VariableList'
import VersionForm from './VersionForm'

// The registered versions, newest first; retired ones only on request. For
// owners also register, change and delete while never requested, and
// retire (O4). Everyone sees the variables.
export default function Versions({ appID, isOwner = false }) {
  const [showRetired, setShowRetired] = useState(false)
  const [registering, setRegistering] = useState(false)
  const list = usePagedList(versions, { appID, versionStatus_filter: showRetired ? '' : 'A' })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {isOwner && !registering && (
          <button type="button" className="btn-secondary" onClick={() => setRegistering(true)}>
            <i className="ti ti-plus" aria-hidden="true" />
            Register version
          </button>
        )}
        <label className="ml-auto flex items-center gap-2 text-[13px] text-fg-2">
          <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
          Show retired versions
        </label>
      </div>
      {registering && (
        <VersionForm saveLabel="Register version" onCancel={() => setRegistering(false)}
          onSave={async (fields) => {
            await registerVersion(appID, fields)
            await list.reload()
            setRegistering(false)
          }} />
      )}
      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && list.rows.length === 0 && (
        <p className="card p-6 text-fg-2">No versions registered yet.</p>
      )}
      {list.rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Version</th>
                <th>Location</th>
                <th>Status</th>
                <th>Registered</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((v) => (
                <VersionRow key={v.versionID} appID={appID} version={v} isOwner={isOwner} onChanged={list.reload} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore list={list} />
    </div>
  )
}

function VersionRow({ appID, version: v, isOwner, onChanged }) {
  const [open, setOpen] = useState(null)
  const toggle = (name) => setOpen((o) => (o === name ? null : name))
  const unused = !isYes(v.isUsed)
  const active = v.versionStatus === 'A'

  return (
    <Fragment>
      <tr>
        <td>
          <div className="font-medium">{v.versionName}</div>
          {v.versionDescription && <div className="text-[12px] text-fg-3">{v.versionDescription}</div>}
        </td>
        <td>
          <span className="font-mono text-[12px]">{v.location}</span>
          <span className="ml-2 text-[11px] text-fg-3">{label(LOC_TYPE, v.locType)}</span>
        </td>
        <td>
          {label(VERSION_STATUS, v.versionStatus)}
          {isYes(v.isUsed) && <span className="ml-2 text-[11px] text-fg-3">deployed</span>}
        </td>
        <td>
          {formatTs(v.createdDate)} <span className="text-fg-3">by {v.createdBy}</span>
        </td>
        <td>
          <div className="flex justify-end gap-1">
            <button type="button" className="icon-btn" aria-label={`Variables of ${v.versionName}`}
              aria-expanded={open === 'variables'} onClick={() => toggle('variables')}>
              <i className="ti ti-variable" aria-hidden="true" />
            </button>
            {isOwner && unused && (
              <button type="button" className="icon-btn" aria-label={`Edit ${v.versionName}`} onClick={() => toggle('edit')}>
                <i className="ti ti-pencil" aria-hidden="true" />
              </button>
            )}
            {isOwner && active && (
              <button type="button" className="icon-btn" aria-label={`Retire ${v.versionName}`} onClick={() => toggle('retire')}>
                <i className="ti ti-archive" aria-hidden="true" />
              </button>
            )}
            {isOwner && unused && (
              <button type="button" className="icon-btn" aria-label={`Delete ${v.versionName}`} onClick={() => toggle('delete')}>
                <i className="ti ti-trash" aria-hidden="true" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5}>
            {open === 'variables' && <VariableList level={{ appID, versionID: v.versionID }} canEdit={isOwner} what={v.versionName} />}
            {open === 'edit' && (
              <VersionForm version={v} saveLabel="Save" onCancel={() => setOpen(null)}
                onSave={async (fields) => {
                  await updateVersion(v.versionID, fields)
                  setOpen(null)
                  await onChanged()
                }} />
            )}
            {open === 'retire' && (
              <Confirm question={`Retire ${v.versionName}? It can't be deployed any more, but stays in the inventory and history.`}
                confirmLabel={`Retire ${v.versionName}`} danger={false} onBack={() => setOpen(null)}
                action={async () => { await retireVersion(v.versionID); setOpen(null); await onChanged() }} />
            )}
            {open === 'delete' && (
              <Confirm question={`Delete ${v.versionName} with its variables? Only a version never requested can be deleted.`}
                confirmLabel={`Delete ${v.versionName}`} onBack={() => setOpen(null)}
                action={async () => { await deleteVersion(v.versionID); setOpen(null); await onChanged() }} />
            )}
          </td>
        </tr>
      )}
    </Fragment>
  )
}

// ConfirmAction, opened already by the icon in the row
function Confirm(props) {
  return <ConfirmAction {...props} startOpen />
}
