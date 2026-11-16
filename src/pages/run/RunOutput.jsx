import { Link } from 'react-router'
import { isYes } from '../../lib/codes'
import { linkTo, PATHS } from '../../routes'

// The steps of the chosen run and its spool files, or why there are none
export default function RunOutput({ deplID, jobNo, run, steps, files }) {
  if (run.outputStatus !== 'C') return <p className="card p-6 text-fg-2">{noOutputText(run)}</p>

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-medium">Steps</h2>
        <div className="card overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>#</th>
                <th>Step</th>
                <th>RC</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.stepNo}>
                  <td>{s.stepNo}</td>
                  <td className="font-mono">
                    {s.stepName}
                    {s.procStep && <span className="text-fg-3">.{s.procStep}</span>}
                  </td>
                  <td>{stepRcText(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-medium">Spool files</h2>
        <div className="card overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>DD</th>
                <th>Step</th>
                <th>Lines</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.fileNo}>
                  <td>
                    <Link className="font-mono underline" to={linkTo(PATHS.output, { deplID, jobNo, runID: run.runID, fileNo: f.fileNo })}>
                      {f.ddName}
                    </Link>
                  </td>
                  <td className="font-mono">{f.stepName}</td>
                  <td>
                    {f.lineCount}
                    {isYes(f.truncated) && <span className="ml-2 text-[11px] text-warning-fg">cut off</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function stepRcText(s) {
  if (isYes(s.flushed)) return 'Not run'
  if (s.abendCode) return s.abendCode
  return s.stepRC >= 0 ? String(s.stepRC) : ''
}

function noOutputText(run) {
  switch (run.outputStatus) {
    case 'N':
      return 'No output was found in JES for this run. Its return code is all there is.'
    case 'P':
      return 'The output of this run has been purged after the retention time. Its return codes are still above.'
    default:
      return run.runStatus === 'S' || run.runStatus === 'N'
        ? 'The job is still running. Its output is collected after it ends.'
        : 'The output hasn’t been collected yet. The collector runs every few minutes; this page checks again by itself.'
  }
}
