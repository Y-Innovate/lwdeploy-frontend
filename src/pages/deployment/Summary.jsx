import { Link } from 'react-router'
import StatusBadge from '../../components/StatusBadge'
import { laterStart, statusText } from '../../lib/deployment'
import { formatTs } from '../../lib/timestamps'
import { linkTo, PATHS } from '../../routes'

// The head of the deployment page: what goes where, and how it stands
export default function Summary({ d, jobs }) {
  return (
    <section className="card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[17px] font-medium">
          Deployment {d.deplID}: {d.versionName} to {d.envCode}
        </h1>
        <StatusBadge status={d.deplStatus} />
      </div>
      <p className="text-[13px] text-fg-2">{statusText(d, jobs)}</p>
      <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
        <Item label="Application">
          <Link className="hover:underline" to={linkTo(PATHS.app, { appID: d.appID })}>
            <span className="font-mono">{d.appCode}</span> {d.appName}
          </Link>
        </Item>
        <Item label="Environment">{d.envCode} – {d.envName}</Item>
        <Item label="Version">
          {d.versionName} <span className="font-mono text-[12px] text-fg-3">{d.location}</span>
        </Item>
        <Item label="Requested">{formatTs(d.requestedDate)} by {d.requestedBy}</Item>
        {laterStart(d) && <Item label="Not before">{formatTs(d.startAfter)}</Item>}
        {d.startedDate && <Item label="Started">{formatTs(d.startedDate)}</Item>}
        {d.endedDate && <Item label="Ended">{formatTs(d.endedDate)}</Item>}
        <Item label="Jobs run as">{d.deployUser}</Item>
        {d.approvalCount > 0 && (
          <Item label="Approvals">{d.approvedCount} of {d.approvalCount} ({d.approverGroup})</Item>
        )}
      </dl>
      {d.requestNote && <p className="rounded-md bg-surface-2 px-3 py-2 text-[13px]">{d.requestNote}</p>}
    </section>
  )
}

function Item({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-[0.5px] text-fg-3">{label}</dt>
      <dd className="truncate">{children}</dd>
    </div>
  )
}
