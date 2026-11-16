import { useCallback, useEffect, useRef, useState } from 'react'

// Loads one thing with load(), again whenever `key` changes, and on
// reload(). The previous data stays on screen while reloading. enabled:
// false waits, for instance until an ID is known.
export function useLoad(load, key, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled })
  const latest = useRef(load)
  const requestId = useRef(0)
  useEffect(() => {
    latest.current = load
  })

  // Only sets state when the answer is in, so the effect below may call it
  const fetchIt = useCallback(() => {
    const id = ++requestId.current
    return latest.current().then(
      (data) => id === requestId.current && setState({ data, error: null, loading: false }),
      (error) => id === requestId.current && setState((s) => ({ ...s, error, loading: false })),
    )
  }, [])

  useEffect(() => {
    if (enabled) fetchIt()
  }, [fetchIt, enabled, key])

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }))
    return fetchIt()
  }, [fetchIt])

  return { ...state, reload }
}
