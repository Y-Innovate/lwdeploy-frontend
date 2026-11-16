import { useState } from 'react'
import { Link } from 'react-router'
import { decide } from '../../api/approvals'
import ErrorBanner from '../../components/ErrorBanner'
import { DECISION, isYes, label } from '../../lib/codes'
import { formatTs } from '../../lib/timestamps'
import { linkTo, PATHS } from '../../routes'

// The approval of a deployment: the decisions so far, and approve or
// reject for an approver (AP2). Approving asks to confirm that the JCL of
// every job was read; rejecting needs a reason.
export default function Approval({ d, jobs, decisions, onDecided }) {
  if (d.approvalCount === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[15px] font-medium">Approval: {d.approvedCount} of {d.approvalCount}</h2>
      {decisions.length > 0 ? (
        <ul className="card flex flex-col divide-y-[0.5px] divide-line">
          {decisions.map((a) => (
            <li key={a.userID} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-[13px]">
              <span className={a.decision === 'A' ? 'font-medium text-success-fg' : 'font-medium text-danger-fg'}>
                {label(DECISION, a.decision)}
              </span>
              <span>{a.userID}</span>
              <span className="text-fg-3">{formatTs(a.createdDate)}</span>
              {a.commentText && <span className="w-full text-fg-2">{a.commentText}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-fg-2">No decisions yet. Approvers come from group {d.approverGroup}.</p>
      )}
      {isYes(d.canApprove) && <DecisionForm d={d} jobs={jobs} onDecided={onDecided} />}
    </section>
  )
}

function DecisionForm({ d, jobs, onDecided }) {
  const [read, setRead] = useState(false)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function send(decision) {
    setError(null)
    if (decision === 'A' && !read) return setError('Confirm that you read the JCL of every job first.')
    if (decision === 'R' && !comment.trim()) return setError('Give the reason for rejecting.')
    setBusy(true)
    try {
      await decide(d.deplID, decision, comment.trim())
      await onDecided()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <div className="card flex max-w-xl flex-col gap-3 p-4">
      <p className="text-[13px] text-fg-2">
        This is the JCL that will be submitted, exactly:{' '}
        {jobs.map((j, i) => (
          <span key={j.jobNo}>
            {i > 0 && ', '}
            <Link className="underline" to={linkTo(PATHS.jcl, { deplID: d.deplID, jobNo: j.jobNo })}>
              job {j.jobNo}, {j.jobTitle}
            </Link>
          </span>
        ))}
        .
      </p>
      {error && <ErrorBanner error={error} />}
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
        I read the JCL of every job
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        Comment (required to reject)
        <textarea className="input h-16 py-1.5" maxLength={255} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => send('A')}>
          <i className="ti ti-check" aria-hidden="true" />
          Approve
        </button>
        <button type="button" className="btn-danger" disabled={busy} onClick={() => send('R')}>
          <i className="ti ti-x" aria-hidden="true" />
          Reject
        </button>
      </div>
    </div>
  )
}
