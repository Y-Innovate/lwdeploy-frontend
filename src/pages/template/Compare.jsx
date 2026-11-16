import { useState } from 'react'
import { getTemplateJcl } from '../../api/templates'
import ErrorBanner from '../../components/ErrorBanner'
import { useLoad } from '../../hooks/useLoad'
import { diffLines, sideBySide } from '../../lib/diff'

// Two revisions side by side with their differences. revisions: the numbers
// known, newest first.
export default function Compare({ templateID, revisions }) {
  const [from, setFrom] = useState(revisions[1] ?? revisions[0])
  const [to, setTo] = useState(revisions[0])
  const pair = useLoad(
    () => Promise.all([getTemplateJcl(templateID, from), getTemplateJcl(templateID, to)]),
    `${templateID}/${from}/${to}`,
    { enabled: Boolean(from && to) },
  )
  const pick = (label, value, set) => (
    <label className="flex items-center gap-2 text-[13px]">
      {label}
      <select className="input w-auto" value={value} onChange={(e) => set(Number(e.target.value))}>
        {revisions.map((r) => <option key={r} value={r}>Revision {r}</option>)}
      </select>
    </label>
  )

  const rows = pair.data ? sideBySide(diffLines(lines(pair.data[0].text), lines(pair.data[1].text))) : []
  const changes = rows.filter((r) => r.type === 'change').length

  return (
    <section className="flex flex-col gap-3" aria-label="Compare revisions">
      <div className="flex flex-wrap items-center gap-3">
        {pick('From', from, setFrom)}
        {pick('to', to, setTo)}
        {pair.data && <span className="text-[12px] text-fg-3">{changes ? `${changes} changed ${changes === 1 ? 'line' : 'lines'}` : 'No differences'}</span>}
      </div>
      {pair.error && <ErrorBanner error={pair.error} onRetry={pair.reload} />}
      {pair.data && (
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse font-mono text-[12px] leading-[1.6]">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <Side cell={r.left} kind={r.type === 'change' ? 'del' : 'same'} />
                  <Side cell={r.right} kind={r.type === 'change' ? 'add' : 'same'} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const lines = (text) => (text ? text.split('\n') : [])

function Side({ cell, kind }) {
  const bg = !cell ? 'bg-surface-2' : kind === 'del' ? 'bg-danger-bg' : kind === 'add' ? 'bg-success-bg' : ''
  return (
    <>
      <td className={`w-10 select-none border-l-[0.5px] border-line pr-2 text-right align-top text-fg-3 ${bg}`}>{cell?.no ?? ''}</td>
      <td className={`whitespace-pre pr-4 align-top ${bg}`} data-kind={cell ? kind : 'none'}>{cell?.text ?? ''}</td>
    </>
  )
}
