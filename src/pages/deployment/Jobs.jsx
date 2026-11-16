import { Link } from 'react-router'
import { JOB_RESULT, JOB_STATUS, label } from '../../lib/codes'
import { rcText } from '../../lib/deployment'
import { linkTo, PATHS } from '../../routes'

// The jobs in order, each with its latest run (GET /deploymentJobs)
export default function Jobs({ deplID, jobs }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[15px] font-medium">Jobs</h2>
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>#</th>
              <th>Job</th>
              <th>Status</th>
              <th>Result</th>
              <th>RC</th>
              <th>Highest RC</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.jobNo}>
                <td>{j.jobNo}</td>
                <td>
                  {j.jobTitle}
                  {j.skipReason && <div className="text-[12px] text-fg-3">Skipped: {j.skipReason}</div>}
                </td>
                <td>{label(JOB_STATUS, j.jobStatus)}</td>
                <td className={resultClass(j.jobResult)}>{label(JOB_RESULT, j.jobResult)}</td>
                <td>{rcText(j)}</td>
                <td>{j.maxRC}</td>
                <td className="flex gap-3">
                  <Link className="underline" to={linkTo(PATHS.jcl, { deplID, jobNo: j.jobNo })}>JCL</Link>
                  {j.lastRunID > 0 && (
                    <Link className="underline" to={linkTo(PATHS.run, { deplID, jobNo: j.jobNo, runID: j.lastRunID })}>
                      Output
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function resultClass(result) {
  if (result === 'O') return 'text-success-fg'
  return result ? 'text-danger-fg' : ''
}
