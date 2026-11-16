import { Link, useNavigate, useSearchParams } from 'react-router'
import { getApplication } from '../api/applications'
import { environments, versions } from '../api/lists'
import ErrorBanner from '../components/ErrorBanner'
import { useLoad } from '../hooks/useLoad'
import { linkTo, PATHS } from '../routes'
import RequestForm from './deploy/RequestForm'

// Request a deployment (D1): /deploy?appID=1&envID=2
export default function Deploy() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const appID = Number(params.get('appID')) || 0
  const envID = Number(params.get('envID')) || 0
  const data = useLoad(
    () => Promise.all([
      getApplication(appID),
      environments.list({ appID }).then((r) => r.rows),
      versions.listAll({ appID, versionStatus_filter: 'A' }),
    ]),
    appID,
    { enabled: appID > 0 },
  )

  if (!appID || data.error?.isNotFound) {
    return <p className="card p-6 text-fg-2">Application not found. <Link className="underline" to={PATHS.home}>See your applications</Link>.</p>
  }
  if (data.error) return <ErrorBanner error={data.error} onRetry={data.reload} />
  if (!data.data) return null
  const [app, envs, vers] = data.data

  return (
    <>
      <header>
        <Link className="text-[13px] text-fg-2 hover:underline" to={linkTo(PATHS.app, { appID })}>
          <span className="font-mono">{app.appCode}</span> {app.appName}
        </Link>
        <h1 className="text-[17px] font-medium">Request a deployment</h1>
      </header>
      <RequestForm
        appID={appID}
        envs={envs}
        vers={vers}
        initialEnvID={envID}
        onRequested={(d) => navigate(linkTo(PATHS.deployment, { deplID: d.deplID }))}
      />
    </>
  )
}
