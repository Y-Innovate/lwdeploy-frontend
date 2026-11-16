import { Link, useSearchParams } from 'react-router'
import { getApplication } from '../api/applications'
import ErrorBanner from '../components/ErrorBanner'
import RoleChips from '../components/RoleChips'
import { useLoad } from '../hooks/useLoad'
import { isYes } from '../lib/codes'
import { PATHS } from '../routes'
import Deployments from './app/Deployments'
import Environments from './app/Environments'
import Templates from './app/Templates'
import Variables from './app/Variables'
import Versions from './app/Versions'

const TABS = [
  ['environments', 'Environments', 'ti-server-2'],
  ['versions', 'Versions', 'ti-package'],
  ['deployments', 'Deployments', 'ti-history'],
  ['templates', 'Templates', 'ti-file-code'],
  ['variables', 'Variables', 'ti-variable'],
]

// One application (M1, M2, M3; O1-O4 for its owners):
// /app?appID=1&tab=versions
export default function AppPage() {
  const [params, setParams] = useSearchParams()
  const appID = Number(params.get('appID')) || 0
  const tab = TABS.some(([t]) => t === params.get('tab')) ? params.get('tab') : 'environments'
  const app = useLoad(() => getApplication(appID), appID, { enabled: appID > 0 })

  if (!appID || app.error?.isNotFound) {
    return (
      <section className="card p-6">
        <h1 className="text-[17px] font-medium">Application not found</h1>
        <p className="mt-1 text-fg-2">
          It doesn&apos;t exist, or you have no role in it. <Link className="underline" to={PATHS.home}>See your applications</Link>.
        </p>
      </section>
    )
  }
  if (app.error) return <ErrorBanner error={app.error} onRetry={app.reload} />
  if (!app.data) return null
  const a = app.data
  const isOwner = isYes(a.isOwner)

  return (
    <>
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[17px] font-medium">
            <span className="font-mono">{a.appCode}</span> {a.appName}
          </h1>
          <RoleChips app={a} />
        </div>
        {a.appDescription && <p className="text-[13px] text-fg-2">{a.appDescription}</p>}
      </header>
      <nav className="flex gap-1" aria-label="Application">
        {TABS.map(([t, text, icon]) => (
          <button
            key={t}
            type="button"
            className={`tab ${tab === t ? 'tab-active' : ''}`}
            aria-current={tab === t ? 'page' : undefined}
            onClick={() => setParams({ appID: String(appID), tab: t })}
          >
            <i className={`ti ${icon}`} aria-hidden="true" />
            {text}
          </button>
        ))}
      </nav>
      {tab === 'environments' && <Environments appID={appID} isOwner={isOwner} />}
      {tab === 'versions' && <Versions appID={appID} isOwner={isOwner} />}
      {tab === 'deployments' && <Deployments appID={appID} />}
      {tab === 'templates' && <Templates appID={appID} isOwner={isOwner} />}
      {tab === 'variables' && <Variables appID={appID} isOwner={isOwner} />}
    </>
  )
}
