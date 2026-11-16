import { useState } from 'react'
import { deployments, environments, versions } from '../../api/lists'
import DeploymentTable from '../../components/DeploymentTable'
import { useSession } from '../../context/SessionContext'
import { useLoad } from '../../hooks/useLoad'
import { usePagedList } from '../../hooks/usePagedList'
import { DEPL_STATUS } from '../../lib/codes'

// The deployment history of the application (M3), with filters
export default function Deployments({ appID }) {
  const { user } = useSession()
  const [filters, setFilters] = useState({ envID_filter: '', versionID_filter: '', deplStatus_filter: '', mine: false })
  const envs = useLoad(() => environments.list({ appID }).then((r) => r.rows), appID)
  const vers = useLoad(() => versions.listAll({ appID }), appID)
  const { mine, ...rest } = filters
  const list = usePagedList(deployments, { appID, ...rest, requestedBy_filter: mine ? user.userID : '' })
  const set = (field) => (e) => setFilters((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Filter label="Environment" value={filters.envID_filter} onChange={set('envID_filter')}
          options={(envs.data ?? []).map((e) => [e.envID, e.envCode])} />
        <Filter label="Version" value={filters.versionID_filter} onChange={set('versionID_filter')}
          options={(vers.data ?? []).map((v) => [v.versionID, v.versionName])} />
        <Filter label="Status" value={filters.deplStatus_filter} onChange={set('deplStatus_filter')}
          options={Object.entries(DEPL_STATUS)} />
        <label className="flex items-center gap-2 text-[13px] text-fg-2">
          <input type="checkbox" checked={filters.mine} onChange={set('mine')} />
          Only mine
        </label>
      </div>
      <DeploymentTable list={list} empty="No deployments match." />
    </div>
  )
}

function Filter({ label, value, onChange, options }) {
  return (
    <select className="input w-auto" aria-label={label} value={value} onChange={onChange}>
      <option value="">Every {label.toLowerCase()}</option>
      {options.map(([v, text]) => (
        <option key={v} value={v}>{text}</option>
      ))}
    </select>
  )
}
