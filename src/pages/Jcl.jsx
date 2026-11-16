import { Link, useSearchParams } from 'react-router'
import { deploymentJobs, getDeploymentJcl } from '../api/deployments'
import ErrorBanner from '../components/ErrorBanner'
import JclLines from '../components/JclLines'
import { useLoad } from '../hooks/useLoad'
import { linkTo, PATHS } from '../routes'

// The frozen JCL of one job of a deployment (M3, AP2): /jcl?deplID=7&jobNo=1.
// The JOB statement and the result step are added at submission.
export default function Jcl() {
  const [params] = useSearchParams()
  const deplID = Number(params.get('deplID')) || 0
  const jobNo = Number(params.get('jobNo')) || 0
  const data = useLoad(
    () => Promise.all([getDeploymentJcl(deplID, jobNo), deploymentJobs.list({ deplID }).then((r) => r.rows)]),
    `${deplID}/${jobNo}`,
    { enabled: deplID > 0 && jobNo > 0 },
  )

  if (!deplID || !jobNo || data.error?.isNotFound) {
    return <p className="card p-6 text-fg-2">This job doesn&apos;t exist, or you have no role in its application.</p>
  }
  if (data.error) return <ErrorBanner error={data.error} onRetry={data.reload} />
  if (!data.data) return null
  const [jcl, jobs] = data.data
  const job = jobs.find((j) => j.jobNo === jobNo)

  return (
    <>
      <header className="flex flex-col gap-1">
        <Link className="text-[13px] text-fg-2 hover:underline" to={linkTo(PATHS.deployment, { deplID })}>
          Deployment {deplID}
        </Link>
        <h1 className="text-[17px] font-medium">Job {jobNo}{job ? `: ${job.jobTitle}` : ''}</h1>
        <p className="text-[13px] text-fg-2">
          Frozen when the deployment was requested
          {job && (
            <>
              , from{' '}
              <Link className="underline" to={linkTo(PATHS.template, { templateID: job.templateID, revision: job.templateRev })}>
                revision {job.templateRev} of the template
              </Link>
            </>
          )}
          . LWD adds the JOB statement, with the deploy userid, and the result step when it submits the job.
        </p>
      </header>
      <nav className="flex flex-wrap gap-1" aria-label="Jobs">
        {jobs.map((j) => (
          <Link key={j.jobNo} className={`tab ${j.jobNo === jobNo ? 'tab-active' : ''}`}
            aria-current={j.jobNo === jobNo ? 'page' : undefined} to={linkTo(PATHS.jcl, { deplID, jobNo: j.jobNo })}>
            Job {j.jobNo}
          </Link>
        ))}
      </nav>
      <JclLines text={jcl.text} />
    </>
  )
}
