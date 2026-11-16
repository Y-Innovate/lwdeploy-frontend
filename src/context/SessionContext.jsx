import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchMe } from '../api/auth'
import { isYes } from '../lib/codes'

const SessionContext = createContext({ user: null, loading: true, error: null, reload: () => {} })

// Who is signed in, from GET /me once per page load and on reload() (after
// an approval, so the count in the top bar follows). LWW keeps the session;
// this is only what the UI shows.
export function SessionProvider({ children }) {
  const [state, setState] = useState({ user: null, loading: true, error: null })

  const reload = useCallback(() => {
    return fetchMe().then(
      (user) => setState({ user, loading: false, error: null }),
      (error) => setState({ user: null, loading: false, error }),
    )
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const value = useMemo(() => {
    const user = state.user
    return {
      ...state,
      reload,
      isAdmin: isYes(user?.isAdmin),
      approvalsWaiting: user?.approvalsWaiting ?? 0,
    }
  }, [state, reload])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  return useContext(SessionContext)
}
