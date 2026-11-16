import { Link } from 'react-router'
import ErrorBanner from '../../components/ErrorBanner'
import LoadMore from '../../components/LoadMore'
import RoleChips from '../../components/RoleChips'
import { useSession } from '../../context/SessionContext'
import { linkTo, PATHS } from '../../routes'

// The applications the user has a role in (M1), as cards
export default function AppCards({ list }) {
  const { isAdmin } = useSession()
  const none = !list.loading && !list.error && list.rows.length === 0

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-[17px] font-medium">Applications</h1>
      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {none && (
        <p className="card p-6 text-fg-2">
          You have no role in any application yet. Ask an administrator to connect you to the access group of the
          applications you work on.
          {isAdmin && ' As an administrator you will see every application in the admin screens, which come later.'}
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.rows.map((a) => (
          <li key={a.appID}>
            <Link to={linkTo(PATHS.app, { appID: a.appID })} className="card flex h-full flex-col gap-2 p-4 hover:bg-surface-2">
              <span className="flex items-center gap-2">
                <span className="font-mono text-[13px] font-medium">{a.appCode}</span>
                <span className="truncate text-[14px]">{a.appName}</span>
              </span>
              <RoleChips app={a} />
            </Link>
          </li>
        ))}
      </ul>
      <LoadMore list={list} />
    </section>
  )
}
