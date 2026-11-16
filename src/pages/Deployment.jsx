import { Link, useSearchParams } from 'react-router'
import { approvals } from '../api/approvals'
import { deploymentEvents, deploymentJobs, getDeployment } from '../api/deployments'
import ErrorBanner from '../components/ErrorBanner'
import { useSession } from '../context/SessionContext'
import { useLoad } from '../hooks/useLoad'
import { usePolling } from '../hooks/usePolling'
import { FINAL_DEPL_STATUSES } from '../lib/codes'
import { pollMs } from '../lib/deployment'
import { PATHS } from '../routes'
import Actions from './deployment/Actions'
import Approval from './deployment/Approval'
import History from './deployment/History'
import Jobs from './deployment/Jobs'
import Summary from './deployment/Summary'

// One deployment (M3, D2-D4, AP2): /deployment?deplID=7
export default function Deployment() {
  const [params] = useSearchParams()
  const session = useSession()
  const deplID = Number(params.get('deplID')) || 0
  const data = useLoad(
    () => Promise.all([
      getDeployment(deplID),
      deploymentJobs.list({ deplID }).then((r) => r.rows),
      deploymentEvents.listAll({ deplID }),
      approvals.list({ deplID }).then((r) => r.rows),
    ]),
    deplID,
    { enabled: deplID > 0 },
  )
  const status = data.data?.[0].deplStatus
  const ms = pollMs(status)
  usePolling(data.reload, ms || 60000, ms > 0 && !FINAL_DEPL_STATUSES.includes(status))

  if (!deplID || (data.error?.isNotFound && !data.data)) {
    return (
      <section className="card p-6">
        <h1 className="text-[17px] font-medium">Deployment not found</h1>
        <p className="mt-1 text-fg-2">
          It doesn&apos;t exist, or you have no role in its application. <Link className="underline" to={PATHS.home}>See your applications</Link>.
        </p>
      </section>
    )
  }
  if (!data.data) return data.error ? <ErrorBanner error={data.error} onRetry={data.reload} /> : null
  const [d, jobs, events, decisions] = data.data
  // After a decision the count in the top bar changes too
  const decided = () => Promise.all([data.reload(), session.reload()])

  return (
    <>
      {data.error && <ErrorBanner error={`Could not refresh: ${data.error.message}`} onRetry={data.reload} />}
      <Summary d={d} jobs={jobs} />
      <Approval d={d} jobs={jobs} decisions={decisions} onDecided={decided} />
      <Actions d={d} onDone={data.reload} />
      <Jobs deplID={deplID} jobs={jobs} />
      <History events={events} />
    </>
  )
}
