import { useEffect, useState } from 'react'

// value, but only after it has stayed the same for ms: for filter boxes
// that would otherwise call the backend on every key
export function useDebounced(value, ms = 300) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}
