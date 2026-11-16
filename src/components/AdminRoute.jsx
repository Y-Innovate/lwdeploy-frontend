import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { useSession } from '../context/SessionContext'

// The administrators' pages, inside SessionRoute. Hiding them is for the
// user only: the backend's administrator check (ADMINRES) protects the data.
// They are loaded on first use (React.lazy), hence the Suspense.
export default function AdminRoute() {
  const { isAdmin } = useSession()
  if (!isAdmin) {
    return <p className="card p-6 text-fg-2">This page is for LWD administrators.</p>
  }
  return (
    <Suspense fallback={<p className="text-[13px] text-fg-3">Loading…</p>}>
      <Outlet />
    </Suspense>
  )
}
