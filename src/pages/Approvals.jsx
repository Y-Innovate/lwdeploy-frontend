import { Link } from 'react-router'
import { approvalRequests } from '../api/approvals'
import ErrorBanner from '../components/ErrorBanner'
import LoadMore from '../components/LoadMore'
import { usePagedList } from '../hooks/usePagedList'
import { laterStart } from '../lib/deployment'
import { formatTs } from '../lib/timestamps'
import { linkTo, PATHS } from '../routes'

// The deployments waiting for my approval, oldest first (AP1). Deciding
// happens on the deployment page, after reading the JCL (AP2), never here.
export default function Approvals() {
  const list = usePagedList(approvalRequests, {})

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-[17px] font-medium">Approvals</h1>
      <p className="text-[13px] text-fg-2">Open a deployment to read its JCL, then approve or reject it there.</p>
      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && list.rows.length === 0 && (
        <p className="card p-6 text-fg-2">Nothing waits for your approval.</p>
      )}
      {list.rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Deployment</th>
                <th>Application</th>
                <th>Environment</th>
                <th>Version</th>
                <th>Requested by</th>
                <th>Requested</th>
                <th>Not before</th>
                <th>Approvals</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.deplID}>
                  <td>
                    <Link className="underline" to={linkTo(PATHS.deployment, { deplID: r.deplID })}>{r.deplID}</Link>
                  </td>
                  <td><span className="font-mono">{r.appCode}</span> {r.appName}</td>
                  <td>{r.envCode}</td>
                  <td>{r.versionName}</td>
                  <td>{r.requestedBy}</td>
                  <td>{formatTs(r.requestedDate)}</td>
                  <td>{formatTs(laterStart(r))}</td>
                  <td>{r.approvedCount} of {r.approvalCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore list={list} />
    </section>
  )
}
