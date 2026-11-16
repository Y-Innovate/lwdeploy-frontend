import { DEPL_STATUS, label } from '../lib/codes'

const STYLE = {
  S: 'bg-success-bg text-success-fg',
  U: 'bg-info-bg text-info-fg',
  Q: 'bg-info-bg text-info-fg',
  W: 'bg-warning-bg text-warning-fg',
  F: 'bg-danger-bg text-danger-fg',
  J: 'bg-danger-bg text-danger-fg',
}

// The status of a deployment in words, as a small badge
export default function StatusBadge({ status }) {
  const code = String(status ?? '').trim().toUpperCase()
  if (!code) return null
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLE[code] ?? 'bg-surface-3 text-fg-2'}`}>
      {label(DEPL_STATUS, code)}
    </span>
  )
}
