import { JOB_RESULT, label, RUN_STATUS } from '../../lib/codes'
import { rcText } from '../../lib/deployment'
import { formatTs } from '../../lib/timestamps'

// The runs of a job, newest first; one is chosen
export default function RunList({ runs, runID, onChoose }) {
  return (
    <div className="card overflow-x-auto">
      <table className="data-table w-full">
        <thead>
          <tr>
            <th>Run</th>
            <th>Job</th>
            <th>Status</th>
            <th>Result</th>
            <th>RC</th>
            <th>Submitted</th>
            <th>Ended</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.runID} className={r.runID === runID ? 'bg-surface-2' : ''} aria-selected={r.runID === runID}>
              <td>
                <button type="button" className="underline" onClick={() => onChoose(r.runID)}>{r.runID}</button>
              </td>
              <td>
                <span className="font-mono">{r.jobName}</span> <span className="text-fg-3">{r.jesJobID}</span>
              </td>
              <td>{label(RUN_STATUS, r.runStatus)}</td>
              <td>
                {label(JOB_RESULT, r.jobResult)}
                {r.jobMessage && <div className="text-[12px] text-fg-3">{r.jobMessage}</div>}
              </td>
              <td>{rcText(r)}</td>
              <td>{formatTs(r.submittedDate)}</td>
              <td>{formatTs(r.endedDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
