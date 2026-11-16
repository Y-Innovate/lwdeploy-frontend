import { useState } from 'react'
import { createRefEntry, deleteRefEntry, updateRefEntry } from '../../api/admin'
import ErrorBanner from '../../components/ErrorBanner'
import { useAllowlist } from './useAllowlist'

const LISTS = [
  ['RACFGRP', 'RACF groups', 'The groups that may be chosen as access, owner, approver or deployer group.'],
  ['DEPLUSER', 'Deploy userids', 'The userids the jobs of an environment may run under. The submit task needs surrogate access to each.'],
]

// A3: the allowlists of RACF groups and deploy userids
export default function Allowlists() {
  return (
    <>
      <h1 className="text-[17px] font-medium">Allowlists</h1>
      {LISTS.map(([tableID, title, explain]) => (
        <List key={tableID} tableID={tableID} title={title} explain={explain} />
      ))}
    </>
  )
}

function List({ tableID, title, explain }) {
  const list = useAllowlist(tableID)
  const [error, setError] = useState(null)

  // Every change reloads the list; a refusal is shown above it
  async function change(fn) {
    setError(null)
    try {
      await fn()
      await list.reload()
      return true
    } catch (err) {
      setError(err)
      return false
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h2 className="mt-2 text-[15px] font-medium">{title}</h2>
      <p className="text-[13px] text-fg-2">{explain}</p>
      {error && <ErrorBanner error={error} />}
      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {list.data && (
        <div className="card overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="w-32">Name</th>
                <th>Description</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {list.data.map((r) => (
                <Entry key={r.tabKey} entry={r}
                  onSave={(value) => change(() => updateRefEntry(tableID, r.tabKey, value))}
                  onDelete={() => change(() => deleteRefEntry(tableID, r.tabKey))} />
              ))}
              {list.data.length === 0 && (
                <tr><td colSpan={3} className="text-fg-3">Empty.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <AddForm label={title} onAdd={(key, value) => change(() => createRefEntry(tableID, key, value))} />
    </section>
  )
}

function Entry({ entry: r, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(r.tabValue)

  async function save(e) {
    e.preventDefault()
    if (await onSave(value.trim())) setEditing(false)
  }

  return (
    <tr>
      <td className="font-mono">{r.tabKey}</td>
      <td>
        {editing ? (
          <form onSubmit={save} className="flex gap-2">
            <input className="input flex-1" aria-label={`Description of ${r.tabKey}`} maxLength={255} value={value}
              onChange={(e) => setValue(e.target.value)} />
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" className="btn-secondary" onClick={() => { setEditing(false); setValue(r.tabValue) }}>Cancel</button>
          </form>
        ) : (
          r.tabValue
        )}
      </td>
      <td>
        {!editing && (
          <span className="flex gap-1">
            <button type="button" className="icon-btn" aria-label={`Edit ${r.tabKey}`} onClick={() => setEditing(true)}>
              <i className="ti ti-pencil" aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn" aria-label={`Remove ${r.tabKey}`} onClick={onDelete}>
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </span>
        )}
      </td>
    </tr>
  )
}

function AddForm({ label, onAdd }) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (await onAdd(key.trim().toUpperCase(), value.trim())) {
      setKey('')
      setValue('')
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-[13px]">
        Name
        <input className="input w-32 font-mono uppercase" required maxLength={8} aria-label={`New name in ${label}`}
          value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-[13px]">
        Description
        <input className="input" maxLength={255} aria-label={`New description in ${label}`} value={value}
          onChange={(e) => setValue(e.target.value)} />
      </label>
      <button type="submit" className="btn-secondary">
        <i className="ti ti-plus" aria-hidden="true" />
        Add
      </button>
    </form>
  )
}
