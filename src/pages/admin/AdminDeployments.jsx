import { useState } from 'react'
import { adminApplications, adminDeployments } from '../../api/admin'
import DeploymentTable from '../../components/DeploymentTable'
import { useLoad } from '../../hooks/useLoad'
import { usePagedList } from '../../hooks/usePagedList'
import { DEPL_STATUS } from '../../lib/codes'

// A4: the deployments of every application, newest first, with filters
export default function AdminDeployments() {
  const [filters, setFilters] = useState({ appID_filter: '', deplStatus_filter: '', requestedBy_filter: '' })
  const [requestedBy, setRequestedBy] = useState('')
  const apps = useLoad(() => adminApplications.listAll(), 'apps')
  const list = usePagedList(adminDeployments, filters)
  const set = (field) => (e) => setFilters((f) => ({ ...f, [field]: e.target.value }))

  function applyRequestedBy(e) {
    e.preventDefault()
    setFilters((f) => ({ ...f, requestedBy_filter: requestedBy.trim().toUpperCase() }))
  }

  return (
    <>
      <h1 className="text-[17px] font-medium">Deployments of every application</h1>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" aria-label="Application" value={filters.appID_filter} onChange={set('appID_filter')}>
          <option value="">Every application</option>
          {(apps.data ?? []).map((a) => (
            <option key={a.appID} value={a.appID}>{a.appCode}</option>
          ))}
        </select>
        <select className="input w-auto" aria-label="Status" value={filters.deplStatus_filter} onChange={set('deplStatus_filter')}>
          <option value="">Every status</option>
          {Object.entries(DEPL_STATUS).map(([v, text]) => (
            <option key={v} value={v}>{text}</option>
          ))}
        </select>
        <form onSubmit={applyRequestedBy} className="flex items-center gap-2">
          <input className="input w-36 font-mono uppercase" aria-label="Requested by" placeholder="Requested by"
            maxLength={8} value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} />
          <button type="submit" className="btn-secondary">Filter</button>
        </form>
      </div>
      <DeploymentTable list={list} showApp empty="No deployments match." />
    </>
  )
}
