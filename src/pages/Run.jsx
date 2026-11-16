import { Link, useSearchParams } from 'react-router'
import { deploymentJobs } from '../api/deployments'
import { jobRuns, jobSteps, spoolFiles } from '../api/output'
import ErrorBanner from '../components/ErrorBanner'
import { useSession } from '../context/SessionContext'
import { useLoad } from '../hooks/useLoad'
import { usePolling } from '../hooks/usePolling'
import { linkTo, PATHS } from '../routes'
import MarkStuck from './run/MarkStuck'
import RunList from './run/RunList'
import RunOutput from './run/RunOutput'

// The runs of one job, and the steps and spool files of one of them
// (M3, M4): /run?deplID=6&jobNo=2&runID=106. Without runID: the newest run.
export default function Run() {
  const [params, setParams] = useSearchParams()
  const { isAdmin } = useSession()
  const deplID = Number(params.get('deplID')) || 0
  const jobNo = Number(params.get('jobNo')) || 0
  const data = useLoad(
    () => Promise.all([jobRuns.list({ deplID, jobNo }).then((r) => r.rows), deploymentJobs.list({ deplID }).then((r) => r.rows)]),
    `${deplID}/${jobNo}`,
    { enabled: deplID > 0 && jobNo > 0 },
  )
  const runs = data.data?.[0] ?? []
  const run = runs.find((r) => r.runID === Number(params.get('runID'))) ?? runs[0]
  const runID = run?.runID ?? 0
  const output = useLoad(
    () => Promise.all([jobSteps.listAll({ runID }), spoolFiles.listAll({ runID })]),
    `${runID}/${run?.outputStatus}`,
    { enabled: run?.outputStatus === 'C' },
  )
  // Until the run has ended and its output is collected
  const waiting = run && run.outputStatus === 'W'
  usePolling(data.reload, run?.runStatus === 'S' ? 5000 : 30000, Boolean(waiting))

  if (!deplID || !jobNo || data.error?.isNotFound) {
    return <p className="card p-6 text-fg-2">This job doesn&apos;t exist, or you have no role in its application.</p>
  }
  if (!data.data) return data.error ? <ErrorBanner error={data.error} onRetry={data.reload} /> : null
  const job = data.data[1].find((j) => j.jobNo === jobNo)

  return (
    <>
      <header className="flex flex-col gap-1">
        <Link className="text-[13px] text-fg-2 hover:underline" to={linkTo(PATHS.deployment, { deplID })}>
          Deployment {deplID}
        </Link>
        <h1 className="text-[17px] font-medium">Job {jobNo}{job ? `: ${job.jobTitle}` : ''}</h1>
      </header>
      {data.error && <ErrorBanner error={`Could not refresh: ${data.error.message}`} onRetry={data.reload} />}
      {runs.length === 0 ? (
        <p className="card p-6 text-fg-2">This job hasn&apos;t been submitted yet.</p>
      ) : (
        <>
          <RunList runs={runs} runID={runID} onChoose={(id) => setParams({ deplID: String(deplID), jobNo: String(jobNo), runID: String(id) })} />
          {isAdmin && run.runStatus === 'S' && <MarkStuck key={runID} run={run} onDone={data.reload} />}
          {output.error && <ErrorBanner error={output.error} onRetry={output.reload} />}
          {(run.outputStatus !== 'C' || output.data) && (
            <RunOutput deplID={deplID} jobNo={jobNo} run={run} steps={output.data?.[0] ?? []} files={output.data?.[1] ?? []} />
          )}
        </>
      )}
    </>
  )
}
