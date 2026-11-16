import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { signInHref } from '../api/auth'
import { BASE, goTo } from '../api/client'
import { useSession } from '../context/SessionContext'

// Every page but the sign-in page needs a session. On LWW, the folder's login
// redirect gets there first; this covers dev and a session that ended while
// the app was open. LWW refuses paths that end in "/": the root is /lwdeploy.
export default function SessionRoute() {
  const { user, loading, error } = useSession()
  const { pathname, search } = useLocation()
  const noSession = !loading && !user && !error

  useEffect(() => {
    if (noSession) goTo(signInHref(`${BASE}${pathname === '/' ? '' : pathname}${search}`))
  }, [noSession, pathname, search])

  if (loading || !user) return null
  return <Outlet />
}
