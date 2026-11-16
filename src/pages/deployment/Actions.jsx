import { useState } from 'react'
import { cancelDeployment, continueDeployment, retryDeployment } from '../../api/deployments'
import ErrorBanner from '../../components/ErrorBanner'
import { isYes } from '../../lib/codes'

// D3 and D4. Each action opens a small form with its comment and a
// confirmation; the backend checks again and its refusal is shown.
const ACTIONS = {
  cancel: {
    title: 'Cancel',
    icon: 'ti-circle-x',
    confirm: 'Cancel the deployment',
    commentLabel: 'Reason (optional)',
    explain: 'Jobs that haven’t run are skipped. What earlier jobs did is not undone.',
    run: cancelDeployment,
  },
  retry: {
    title: 'Retry',
    icon: 'ti-refresh',
    confirm: 'Submit the failed job again',
    commentLabel: 'Comment (optional)',
    explain: 'The failed job runs again with the same frozen JCL, without new approval.',
    run: retryDeployment,
  },
  continue: {
    title: 'Continue',
    icon: 'ti-player-skip-forward',
    confirm: 'Skip the failed job and go on',
    commentLabel: 'Why the failed job can be skipped',
    required: true,
    explain: 'The failed job is marked skipped and the next job is submitted.',
    run: continueDeployment,
  },
}

export default function Actions({ d, onDone }) {
  const [open, setOpen] = useState(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const available = [isYes(d.canRetry) && 'retry', isYes(d.canRetry) && 'continue', isYes(d.canCancel) && 'cancel'].filter(Boolean)

  if (!available.length) {
    return d.deplStatus === 'U' ? (
      <p className="text-[12px] text-fg-3">
        While a job runs, the deployment can&apos;t be cancelled. LWD never cancels a job in JES: wait until it ends.
      </p>
    ) : null
  }

  function choose(name) {
    setOpen(name)
    setComment('')
    setError(null)
  }

  async function confirm(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await ACTIONS[open].run(d.deplID, comment.trim())
      setOpen(null)
      await onDone()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const a = open && ACTIONS[open]
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {available.map((name) => (
          <button key={name} type="button" className={name === 'cancel' ? 'btn-danger' : 'btn-secondary'}
            aria-pressed={open === name} onClick={() => choose(name)}>
            <i className={`ti ${ACTIONS[name].icon}`} aria-hidden="true" />
            {ACTIONS[name].title}
          </button>
        ))}
      </div>
      {a && (
        <form onSubmit={confirm} className="card flex max-w-xl flex-col gap-3 p-4">
          <p className="text-[13px] text-fg-2">{a.explain}</p>
          {error && <ErrorBanner error={error} />}
          <label className="flex flex-col gap-1 text-[13px]">
            {a.commentLabel}
            <textarea className="input h-16 py-1.5" maxLength={255} required={a.required} value={comment}
              onChange={(e) => setComment(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className={open === 'cancel' ? 'btn-danger' : 'btn-primary'} disabled={busy}>
              {busy ? 'Working…' : a.confirm}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(null)}>Back</button>
          </div>
        </form>
      )}
    </section>
  )
}
