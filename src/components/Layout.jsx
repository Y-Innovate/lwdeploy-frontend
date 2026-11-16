import { Outlet } from 'react-router'
import { useSession } from '../context/SessionContext'
import ErrorBanner from './ErrorBanner'
import TopBar from './TopBar'

export default function Layout() {
  const { error, reload } = useSession()

  return (
    <div className="flex min-h-full flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 sm:p-6">
        {error && <ErrorBanner error={`Could not check who is signed in: ${error.message}`} onRetry={reload} />}
        <Outlet />
      </main>
    </div>
  )
}
