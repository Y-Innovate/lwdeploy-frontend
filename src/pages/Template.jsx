import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getApplication } from '../api/applications'
import { getTemplate, getTemplateJcl, saveTemplateJcl, templateRevisions } from '../api/templates'
import ErrorBanner from '../components/ErrorBanner'
import JclLines from '../components/JclLines'
import LoadMore from '../components/LoadMore'
import { useLoad } from '../hooks/useLoad'
import { usePagedList } from '../hooks/usePagedList'
import { isYes } from '../lib/codes'
import { formatTs } from '../lib/timestamps'
import { linkTo, PATHS } from '../routes'
import Compare from './template/Compare'
import JclEditor from './template/JclEditor'

// One job template (O2): /template?templateID=1, its current JCL (editable
// by owners), its revisions and two of them compared. &revision=N shows that
// revision read-only, as the frozen JCL of a deployment links to it.
export default function Template() {
  const [params] = useSearchParams()
  const templateID = Number(params.get('templateID')) || 0
  const revision = Number(params.get('revision')) || 0
  const data = useLoad(
    () => getTemplate(templateID).then(async (t) => ({ t, app: await getApplication(t.appID) })),
    templateID,
    { enabled: templateID > 0 },
  )

  if (!templateID || data.error?.isNotFound) {
    return <p className="card p-6 text-fg-2">This template doesn&apos;t exist, or you have no role in its application.</p>
  }
  if (data.error) return <ErrorBanner error={data.error} onRetry={data.reload} />
  if (!data.data) return null
  const { t, app } = data.data
  const active = t.templateStatus === 'A'
  const canEdit = active && isYes(app.isOwner)
  const showRevision = revision && revision !== t.currentRev ? revision : 0

  return (
    <>
      <header className="flex flex-col gap-1">
        <Link className="text-[13px] text-fg-2 hover:underline" to={linkTo(PATHS.app, { appID: t.appID, tab: 'templates' })}>
          <span className="font-mono">{app.appCode}</span> templates
        </Link>
        <h1 className="text-[17px] font-medium">{t.templateName}</h1>
        <p className="text-[13px] text-fg-2">
          Highest RC {t.maxRC}; {t.currentRev ? `revision ${t.currentRev} is current` : 'no JCL yet'}.
        </p>
        {!active && (
          <p className="text-[13px] text-warning-fg">
            Deleted: new deployments don&apos;t run it. It is kept so the JCL of earlier deployments can be traced to it.
          </p>
        )}
      </header>
      {showRevision ? (
        <RevisionView templateID={templateID} revision={showRevision} />
      ) : (
        <CurrentJcl template={t} canEdit={canEdit} onSaved={data.reload} />
      )}
      {/* A fresh list after each save */}
      <Revisions key={t.currentRev} template={t} />
    </>
  )
}

function RevisionView({ templateID, revision }) {
  const jcl = useLoad(() => getTemplateJcl(templateID, revision), `${templateID}/${revision}`)
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[15px] font-medium">Revision {revision}</h2>
        <Link className="text-[13px] underline" to={linkTo(PATHS.template, { templateID })}>Current JCL</Link>
      </div>
      {jcl.error && <ErrorBanner error={jcl.error} onRetry={jcl.reload} />}
      {jcl.data && <JclLines text={jcl.data.text} />}
    </section>
  )
}

// The current JCL; for owners an editor that saves it as the next revision
function CurrentJcl({ template: t, canEdit, onSaved }) {
  const jcl = useLoad(() => getTemplateJcl(t.templateID), `${t.templateID}/${t.currentRev}`)
  const [text, setText] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  if (jcl.error) return <ErrorBanner error={jcl.error} onRetry={jcl.reload} />
  if (!jcl.data) return null
  if (!canEdit) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-medium">Current JCL</h2>
        <JclLines text={jcl.data.text} />
      </section>
    )
  }
  const value = text ?? jcl.data.text
  const changed = value !== jcl.data.text

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const r = await saveTemplateJcl(t.templateID, value, note.trim())
      setResult(r)
      setNote('')
      setText(null)
      await onSaved()
    } catch (err) {
      setError(err.isJclRefused ? `Not saved: ${err.infoMessage}` : err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <h2 className="text-[15px] font-medium">JCL</h2>
      <p className="text-[13px] text-fg-2">
        Job steps only: LWD writes the JOB statement, with the deploy userid, and adds the result step. Variables are
        written <code className="font-mono">{'${NAME}'}</code> and filled in when a deployment is requested. No JOB
        statement, <code className="font-mono">USER=</code>, <code className="font-mono">PASSWORD=</code>, JES2 or JES3
        statements; lines of at most 80 characters.
      </p>
      {result && <SaveResult result={result} />}
      {error && <ErrorBanner error={error} />}
      <JclEditor value={value} onChange={(v) => { setText(v); setResult(null) }} />
      <label className="flex max-w-xl flex-col gap-1 text-[13px]">
        Change note
        <input className="input" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy || !changed}>
          {busy ? 'Saving…' : 'Save as a new revision'}
        </button>
        {changed && <button type="button" className="btn-secondary" onClick={() => setText(null)}>Undo changes</button>}
      </div>
      <p className="text-[12px] text-fg-3">Deployments already requested keep the JCL they were frozen with.</p>
    </form>
  )
}

function SaveResult({ result: r }) {
  return (
    <div role="status" className={`rounded-md px-4 py-2.5 text-[13px] ${r.warningCount ? 'bg-warning-bg text-warning-fg' : 'bg-success-bg text-success-fg'}`}>
      Saved as revision {r.revision}, {r.lineCount} lines.
      {r.warningCount > 0 && (
        <> {r.warningCount === 1 ? '1 warning' : `${r.warningCount} warnings`}, the first: {r.infoMessage}</>
      )}
    </div>
  )
}

function Revisions({ template: t }) {
  const list = usePagedList(templateRevisions, { templateID: t.templateID }, { enabled: t.currentRev > 0 })
  if (!t.currentRev) return null
  const numbers = list.rows.map((r) => r.revision)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="mt-2 text-[15px] font-medium">Revisions</h2>
      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {list.rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Revision</th>
                <th>Change note</th>
                <th>Lines</th>
                <th>Saved</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.revision}>
                  <td>
                    <Link className="underline" to={linkTo(PATHS.template, { templateID: t.templateID, revision: r.revision })}>
                      {r.revision}
                    </Link>
                    {r.revision === t.currentRev && <span className="ml-2 text-[11px] text-fg-3">current</span>}
                  </td>
                  <td>{r.changeNote}</td>
                  <td>{r.lineCount}</td>
                  <td>{formatTs(r.createdDate)} <span className="text-fg-3">by {r.createdBy}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore list={list} />
      {numbers.length > 1 && <Compare templateID={t.templateID} revisions={numbers} />}
    </section>
  )
}
