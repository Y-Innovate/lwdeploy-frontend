import { useState } from 'react'
import { createVariable, deleteVariable, updateVariable, variables } from '../../api/variables'
import ConfirmAction from '../../components/ConfirmAction'
import ErrorBanner from '../../components/ErrorBanner'
import { useLoad } from '../../hooks/useLoad'

const SECRET_WARNING = 'Every member of the application can read this value: never put a password or other secret in it.'

// The variables of one level (O1, O3, O4): level { appID }, { appID, envID }
// or { appID, versionID }. One component for the three; canEdit for owners.
export default function VariableList({ level, canEdit, what }) {
  const key = JSON.stringify(level)
  const list = useLoad(() => variables.listAll(level).then((rows) => rows.sort((a, b) => a.varName.localeCompare(b.varName))), key)
  const [adding, setAdding] = useState(false)

  if (list.error) return <ErrorBanner error={list.error} onRetry={list.reload} />
  if (!list.data) return null

  return (
    <div className="flex flex-col gap-2" aria-label={`Variables of ${what}`} role="region">
      {list.data.length === 0 ? (
        <p className="text-[13px] text-fg-3">No variables for {what}.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border-[0.5px] border-line">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
                <th>Description</th>
                {canEdit && <th className="w-px" />}
              </tr>
            </thead>
            <tbody>
              {list.data.map((x) => (
                <VariableRow key={x.varID} variable={x} canEdit={canEdit} onChanged={list.reload} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (adding ? (
        <VariableForm saveLabel="Add variable" onCancel={() => setAdding(false)}
          onSave={async (fields) => {
            await createVariable(level, fields)
            await list.reload()
            setAdding(false)
          }} />
      ) : (
        <div>
          <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>
            <i className="ti ti-plus" aria-hidden="true" />
            Add variable
          </button>
        </div>
      ))}
    </div>
  )
}

function VariableRow({ variable: x, canEdit, onChanged }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <tr>
        <td colSpan={4}>
          <VariableForm variable={x} saveLabel="Save" onCancel={() => setEditing(false)}
            onSave={async (fields) => {
              await updateVariable(x.varID, fields)
              await onChanged()
              setEditing(false)
            }} />
        </td>
      </tr>
    )
  }
  return (
    <tr>
      <td className="font-mono">{x.varName}</td>
      <td className="break-all font-mono">{x.varValue}</td>
      <td className="text-fg-2">{x.varDescription}</td>
      {canEdit && (
        <td>
          <div className="flex flex-wrap justify-end gap-1">
            <button type="button" className="icon-btn" aria-label={`Edit ${x.varName}`} onClick={() => setEditing(true)}>
              <i className="ti ti-pencil" aria-hidden="true" />
            </button>
            <ConfirmAction ariaLabel={`Delete ${x.varName}`} question={`Delete variable ${x.varName}?`} confirmLabel={`Delete ${x.varName}`}
              action={async () => { await deleteVariable(x.varID); await onChanged() }} />
          </div>
        </td>
      )}
    </tr>
  )
}

function VariableForm({ variable, saveLabel, onSave, onCancel }) {
  const [f, setF] = useState({
    varName: variable?.varName ?? '', varValue: variable?.varValue ?? '', varDescription: variable?.varDescription ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (name) => (e) => setF((x) => ({ ...x, [name]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave({ varName: f.varName.trim().toUpperCase(), varValue: f.varValue.trim(), varDescription: f.varDescription.trim() })
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-md bg-surface-2 p-3">
      {error && <ErrorBanner error={error} />}
      <div className="flex flex-wrap gap-3">
        <label className="flex w-44 flex-col gap-1 text-[13px]">
          Name
          <input className="input font-mono uppercase" required maxLength={16} value={f.varName} onChange={set('varName')} />
        </label>
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-[13px]">
          Value
          <input className="input font-mono" maxLength={255} value={f.varValue} onChange={set('varValue')} />
        </label>
      </div>
      <p className="-mt-1 flex items-center gap-1 text-[12px] text-warning-fg">
        <i className="ti ti-eye" aria-hidden="true" />
        {SECRET_WARNING}
      </p>
      <span className="-mt-2 text-[12px] text-fg-3">
        Name: A-Z, 0-9 and _, starting with a letter, at most 16, not starting with LWD. The JCL uses it as{' '}
        <code className="font-mono">{'${NAME}'}</code>.
      </span>
      <label className="flex flex-col gap-1 text-[13px]">
        Description (optional)
        <input className="input" maxLength={255} value={f.varDescription} onChange={set('varDescription')} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : saveLabel}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
