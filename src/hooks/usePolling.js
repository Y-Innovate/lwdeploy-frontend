import { useEffect, useRef } from 'react'

// Calls fn every `ms` while enabled and the page is visible. A hidden tab
// doesn't poll; it catches up as soon as it is shown again.
export function usePolling(fn, ms, enabled = true) {
  const latest = useRef(fn)
  useEffect(() => {
    latest.current = fn
  })

  useEffect(() => {
    if (!enabled) return undefined
    const tick = () => {
      if (document.visibilityState !== 'hidden') latest.current()
    }
    const timer = setInterval(tick, ms)
    const onVisible = () => {
      if (document.visibilityState === 'visible') latest.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ms, enabled])
}
