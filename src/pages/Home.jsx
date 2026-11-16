import { useState } from 'react'
import { Link } from 'react-router'
import { applications, deployments } from '../api/lists'
import DeploymentTable from '../components/DeploymentTable'
import { useSession } from '../context/SessionContext'
import { useDebounced } from '../hooks/useDebounced'
import { usePagedList } from '../hooks/usePagedList'
import { NO_DEPLOYMENT_FILTERS } from '../lib/deployment'
import { PATHS } from '../routes'
import AppCards from './home/AppCards'

// The start page (U1, M1, AP1): the applications, the approvals waiting
// for the user, and the user's own requests, with a filter box per column
export default function Home() {
  const { user, approvalsWaiting } = useSession()
  const apps = usePagedList(applications, {})
  const [filters, setFilters] = useState(NO_DEPLOYMENT_FILTERS)
  const query = useDebounced(filters)
  const mine = usePagedList(deployments, { appID: 0, requestedBy_filter: user.userID, ...withoutEmpty(query) })

  return (
    <>
      {approvalsWaiting > 0 && (
        <Link to={PATHS.approvals} className="flex items-center gap-3 rounded-md bg-warning-bg px-4 py-3 text-[13px] text-warning-fg">
          <i className="ti ti-checklist text-base" aria-hidden="true" />
          <span className="flex-1">
            {approvalsWaiting === 1 ? '1 deployment waits' : `${approvalsWaiting} deployments wait`} for your approval.
          </span>
          <span className="underline">Review</span>
        </Link>
      )}
      <AppCards list={apps} />
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-medium">My requests</h2>
        <DeploymentTable list={mine} showApp empty="You haven't requested a deployment yet."
          filters={filters} onFilter={(field, value) => setFilters((f) => ({ ...f, [field]: clean(field, value) }))}
          noMatch="None of your requests match." />
      </section>
    </>
  )
}

// Only the filters that are set go to the backend
function withoutEmpty(filters) {
  return Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== ''))
}

// The deployment number takes digits only
function clean(field, value) {
  return field === 'deplID_filter' ? value.replace(/\D/g, '') : value
}
