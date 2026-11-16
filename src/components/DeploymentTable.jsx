import { Link } from 'react-router'
import { DEPL_STATUS } from '../lib/codes'
import { laterStart } from '../lib/deployment'
import { formatTs } from '../lib/timestamps'
import { linkTo, PATHS } from '../routes'
import ErrorBanner from './ErrorBanner'
import LoadMore from './LoadMore'
import StatusBadge from './StatusBadge'

// A paged list of deployments (GET /deployments, usePagedList), newest
// first. showApp adds the application, for lists across applications.
// filters and onFilter(field, value) add a row of filter boxes under the
// headers (NO_DEPLOYMENT_FILTERS in lib/deployment); the table stays while they find nothing.
export default function DeploymentTable({
  list, showApp = false, empty = 'No deployments.', filters, onFilter, noMatch = 'No deployments match.',
}) {
  const filtering = !!filters && Object.values(filters).some((v) => v !== '')
  const columns = showApp ? 8 : 7
  return (
    <div className="flex flex-col gap-3">
      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && list.rows.length === 0 && !filtering && <p className="card p-6 text-fg-2">{empty}</p>}
      {(list.rows.length > 0 || filtering) && (
        <div className="card overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Deployment</th>
                {showApp && <th>Application</th>}
                <th>Environment</th>
                <th>Version</th>
                <th>Status</th>
                <th>Requested by</th>
                <th>Requested</th>
                <th>Ended</th>
              </tr>
              {filters && <FilterRow filters={filters} onFilter={onFilter} showApp={showApp} />}
            </thead>
            <tbody>
              {list.rows.length === 0 && !list.loading && !list.error && (
                <tr>
                  <td colSpan={columns} className="text-fg-2">{noMatch}</td>
                </tr>
              )}
              {list.rows.map((d) => (
                <tr key={d.deplID}>
                  <td>
                    <Link className="underline" to={linkTo(PATHS.deployment, { deplID: d.deplID })}>
                      {d.deplID}
                    </Link>
                  </td>
                  {showApp && (
                    <td>
                      <Link className="hover:underline" to={linkTo(PATHS.app, { appID: d.appID })}>{d.appCode}</Link>
                    </td>
                  )}
                  <td>{d.envCode}</td>
                  <td>{d.versionName}</td>
                  <td><StatusBadge status={d.deplStatus} /></td>
                  <td>{d.requestedBy}</td>
                  <td>{formatTs(d.requestedDate)}</td>
                  <td>{d.endedDate ? formatTs(d.endedDate) : startText(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore list={list} />
    </div>
  )
}

// The filter boxes, each under its column; none for the requester and dates
function FilterRow({ filters, onFilter, showApp }) {
  const box = (field, label, props = {}) => (
    <th className="py-1.5">
      <input className="input h-7 min-w-20 font-normal normal-case tracking-normal" aria-label={`Filter on ${label}`}
        placeholder="Filter" value={filters[field]} onChange={(e) => onFilter(field, e.target.value)} {...props} />
    </th>
  )
  return (
    <tr>
      {box('deplID_filter', 'deployment', { inputMode: 'numeric', maxLength: 9 })}
      {showApp && box('appCode_filter', 'application', { maxLength: 8 })}
      {box('envCode_filter', 'environment', { maxLength: 8 })}
      {box('versionName_filter', 'version', { maxLength: 30 })}
      <th className="py-1.5">
        <select className="input h-7 w-auto font-normal normal-case tracking-normal" aria-label="Filter on status"
          value={filters.deplStatus_filter} onChange={(e) => onFilter('deplStatus_filter', e.target.value)}>
          <option value="">Every status</option>
          {Object.entries(DEPL_STATUS).map(([v, text]) => (
            <option key={v} value={v}>{text}</option>
          ))}
        </select>
      </th>
      <th />
      <th />
      <th />
    </tr>
  )
}

// A start still to come: waiting or queued, with a requested time
function startText(d) {
  return ['W', 'Q'].includes(d.deplStatus) && laterStart(d) ? `Not before ${formatTs(d.startAfter)}` : ''
}
