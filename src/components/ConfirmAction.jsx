import { useState } from 'react'
import ErrorBanner from './ErrorBanner'

// A button that asks first: label opens, `question` explains, confirmLabel
// runs action() (a promise). The backend's refusal is shown with it; for
// 08 53 only its message, which says why. Without a label the button is an
// icon with ariaLabel. startOpen: opened already by something else, which
// onBack closes again.
export default function ConfirmAction({ label, ariaLabel, icon = 'ti-trash', question, confirmLabel, action, danger = true,
  startOpen = false, onBack }) {
  const [open, setOpen] = useState(startOpen)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await action()
      if (!startOpen) setOpen(false)
    } catch (err) {
      setError(err.isWrongState ? err.infoMessage : err)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className={!label ? 'icon-btn' : danger ? 'btn-danger' : 'btn-secondary'} aria-label={ariaLabel}
        onClick={() => { setOpen(true); setError(null) }}>
        <i className={`ti ${icon}`} aria-hidden="true" />
        {label}
      </button>
    )
  }
  return (
    <div className="flex basis-full flex-col gap-2 rounded-md bg-surface-2 p-3 text-[13px]">
      <p className="text-fg-2">{question}</p>
      {error && <ErrorBanner error={error} />}
      <div className="flex gap-2">
        <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={confirm}>
          {busy ? 'Working…' : confirmLabel}
        </button>
        <button type="button" className="btn-secondary" onClick={() => (onBack ? onBack() : setOpen(false))}>Back</button>
      </div>
    </div>
  )
}
