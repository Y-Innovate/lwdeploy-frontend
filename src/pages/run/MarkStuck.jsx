import { useState } from 'react'
import { markRunStuck } from '../../api/admin'
import ErrorBanner from '../../components/ErrorBanner'

// A4, for administrators: a submitted run whose result step never reported
// fails now, with its job and deployment, as the scheduler does after
// JOBMINS. Asks first, and says when it is the right thing to do.
export default function MarkStuck({ run, onDone }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await markRunStuck(run.runID)
      setOpen(false)
      await onDone()
    } catch (err) {
      setError(err.isWrongState ? `${err.infoMessage}.` : err)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div>
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
          <i className="ti ti-hourglass-off" aria-hidden="true" />
          Mark stuck
        </button>
      </div>
    )
  }
  return (
    <section className="card flex max-w-xl flex-col gap-3 p-4">
      <p className="text-[13px] text-fg-2">
        Use this when job <span className="font-mono">{run.jobName}</span> ({run.jesJobID}) has ended in JES, but its
        result step didn&apos;t report to LWD. The run fails with &quot;No result in time&quot;, and so do the job and
        the deployment; a deployer can then retry or continue. Without this, the scheduler does the same after
        JOBMINS minutes.
      </p>
      {error && <ErrorBanner error={error} />}
      <div className="flex gap-2">
        <button type="button" className="btn-danger" disabled={busy} onClick={confirm}>
          {busy ? 'Working…' : `Mark run ${run.runID} stuck`}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Back</button>
      </div>
    </section>
  )
}
