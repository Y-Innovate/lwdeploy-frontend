import { EVENT_TYPE, label } from '../../lib/codes'
import { formatTs } from '../../lib/timestamps'

// What happened to the deployment, oldest first (GET /deploymentEvents)
export default function History({ events }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[15px] font-medium">History</h2>
      <ol className="card flex flex-col divide-y-[0.5px] divide-line">
        {events.map((e) => (
          <li key={e.eventNo} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-[13px]">
            <span className="w-36 text-fg-3">{formatTs(e.createdDate)}</span>
            <span className="font-medium">
              {label(EVENT_TYPE, e.eventType)}
              {e.jobNo > 0 && ` (job ${e.jobNo})`}
            </span>
            <span className="text-fg-2">{e.createdBy}</span>
            {e.commentText && <span className="w-full pl-0 text-fg-2 sm:pl-40">{e.commentText}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
