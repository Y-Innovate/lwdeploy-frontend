import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { createTemplate, deleteTemplate, templates, updateTemplate } from '../../api/templates'
import ConfirmAction from '../../components/ConfirmAction'
import ErrorBanner from '../../components/ErrorBanner'
import { useLoad } from '../../hooks/useLoad'
import { formatTs } from '../../lib/timestamps'
import { linkTo, PATHS } from '../../routes'

// The job templates in order (O2): every deployment runs one job per
// template. Everyone reads; owners add, rename, reorder and delete. The JCL
// is edited on the template page.
export default function Templates({ appID, isOwner = false }) {
  const list = useLoad(() => templates.list({ appID }).then((r) => r.rows), appID)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  if (list.error) return <ErrorBanner error={list.error} onRetry={list.reload} />
  if (!list.data) return null
  const rows = list.data
  const withoutJcl = rows.filter((t) => t.currentRev === 0)

  const fieldsOf = ({ templateName, sortOrder, maxRC }) => ({ templateName, sortOrder, maxRC })
  // Moving swaps the order of two neighbours, with two updates; never 0,
  // which the backend takes as "keep the order"
  async function move(index, by) {
    setError(null)
    const a = rows[index]
    const b = rows[index + by]
    const [orderA, orderB] = a.sortOrder === b.sortOrder
      ? (by < 0 ? [a.sortOrder, a.sortOrder + 1] : [a.sortOrder + 1, a.sortOrder])
      : [b.sortOrder, a.sortOrder]
    try {
      await updateTemplate(a.templateID, { ...fieldsOf(a), sortOrder: orderA })
      await updateTemplate(b.templateID, { ...fieldsOf(b), sortOrder: orderB })
    } catch (err) {
      setError(err)
    }
    await list.reload()
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-fg-2">
        Every deployment runs one job per template, in this order, with the JCL of its current revision. A job whose
        return code is above its highest RC fails the deployment.
      </p>
      {withoutJcl.length > 0 && (
        <p className="flex items-center gap-1 text-[13px] text-warning-fg">
          <i className="ti ti-alert-triangle" aria-hidden="true" />
          {withoutJcl.map((t) => t.templateName).join(', ')} {withoutJcl.length === 1 ? 'has' : 'have'} no JCL yet:
          deployments are refused until every template has.
        </p>
      )}
      {error && <ErrorBanner error={error} />}
      {rows.length === 0 ? (
        <p className="card p-6 text-fg-2">No job templates yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="w-10">Job</th>
                <th>Template</th>
                <th>Highest RC</th>
                <th>Revision</th>
                <th>Changed</th>
                {isOwner && <th className="w-px" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <TemplateRow key={t.templateID} template={t} jobNo={i + 1} isOwner={isOwner} onChanged={list.reload}
                  onUp={i > 0 ? () => move(i, -1) : null} onDown={i < rows.length - 1 ? () => move(i, 1) : null} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isOwner && (adding ? (
        <TemplateForm saveLabel="Add template" onCancel={() => setAdding(false)}
          onSave={async (fields) => {
            const t = await createTemplate(appID, { ...fields, sortOrder: 0 })
            navigate(linkTo(PATHS.template, { templateID: t.templateID }))
          }} />
      ) : (
        <div>
          <button type="button" className="btn-secondary" disabled={rows.length >= 20} onClick={() => setAdding(true)}>
            <i className="ti ti-plus" aria-hidden="true" />
            Add template
          </button>
          {rows.length >= 20 && <span className="ml-2 text-[12px] text-fg-3">20 templates is the most there can be.</span>}
        </div>
      ))}
    </div>
  )
}

function TemplateRow({ template: t, jobNo, isOwner, onChanged, onUp, onDown }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <tr>
        <td colSpan={6}>
          <TemplateForm template={t} saveLabel="Save" onCancel={() => setEditing(false)}
            onSave={async (fields) => {
              await updateTemplate(t.templateID, { ...fields, sortOrder: t.sortOrder })
              await onChanged()
              setEditing(false)
            }} />
        </td>
      </tr>
    )
  }
  return (
    <tr>
      <td>{jobNo}</td>
      <td>
        <Link className="font-medium underline" to={linkTo(PATHS.template, { templateID: t.templateID })}>{t.templateName}</Link>
      </td>
      <td>{t.maxRC}</td>
      <td>{t.currentRev ? t.currentRev : <span className="text-warning-fg">No JCL yet</span>}</td>
      <td>{formatTs(t.updatedDate)} <span className="text-fg-3">by {t.updatedBy}</span></td>
      {isOwner && (
        <td>
          <div className="flex justify-end gap-1">
            <button type="button" className="icon-btn" aria-label={`Move ${t.templateName} up`} disabled={!onUp} onClick={onUp ?? undefined}>
              <i className="ti ti-arrow-up" aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn" aria-label={`Move ${t.templateName} down`} disabled={!onDown} onClick={onDown ?? undefined}>
              <i className="ti ti-arrow-down" aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn" aria-label={`Edit ${t.templateName}`} onClick={() => setEditing(true)}>
              <i className="ti ti-pencil" aria-hidden="true" />
            </button>
            <ConfirmAction ariaLabel={`Delete ${t.templateName}`} confirmLabel={`Delete ${t.templateName}`}
              question={`Delete ${t.templateName}? New deployments no longer run it. Its revisions stay, so the JCL of earlier deployments can still be traced to them.`}
              action={async () => { await deleteTemplate(t.templateID); await onChanged() }} />
          </div>
        </td>
      )}
    </tr>
  )
}

function TemplateForm({ template, saveLabel, onSave, onCancel }) {
  const [name, setName] = useState(template?.templateName ?? '')
  const [maxRC, setMaxRC] = useState(template?.maxRC ?? 4)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave({ templateName: name.trim(), maxRC: Number(maxRC) })
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-3 rounded-md bg-surface-2 p-3">
      {error && <ErrorBanner error={error} />}
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-[13px]">
          Name
          <input className="input" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex w-32 flex-col gap-1 text-[13px]">
          Highest RC
          <input className="input" type="number" required min={0} max={4095} value={maxRC} onChange={(e) => setMaxRC(e.target.value)} />
        </label>
      </div>
      {!template && <p className="text-[12px] text-fg-3">After adding it, write its JCL on the template page.</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : saveLabel}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
