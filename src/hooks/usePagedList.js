import { useCallback, useEffect, useRef, useState } from 'react'

// Loads a list (src/api/lists.js) page by page; backend pages hold 20 rows.
// A change of `filters` restarts the list; loadMore() appends the next page,
// reload() starts again from the first page (for polling and after changes).
// enabled: false waits, for instance until an appID is known. meta holds
// the fields next to the list on the first page.
export function usePagedList(resource, filters, { enabled = true } = {}) {
  const [state, setState] = useState({ rows: [], next: null, meta: {}, loading: enabled, error: null })
  const filterKey = JSON.stringify(filters ?? {})
  const requestId = useRef(0)

  const fetchPage = useCallback(
    (since) => {
      const id = ++requestId.current
      return resource.list(JSON.parse(filterKey), since ?? {}).then(
        ({ rows, next, meta = {} }) => {
          if (id !== requestId.current) return
          setState((s) => ({
            rows: since ? [...s.rows, ...rows] : rows,
            next,
            meta: since ? s.meta : meta,
            loading: false,
            error: null,
          }))
        },
        (error) => {
          if (id !== requestId.current) return
          setState((s) => ({ ...s, loading: false, error }))
        },
      )
    },
    [resource, filterKey],
  )

  useEffect(() => {
    if (enabled) fetchPage()
  }, [fetchPage, enabled])

  const loadMore = useCallback(() => {
    if (!state.next) return Promise.resolve()
    setState((s) => ({ ...s, loading: true }))
    return fetchPage(state.next)
  }, [fetchPage, state.next])

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }))
    return fetchPage()
  }, [fetchPage])

  return { ...state, loading: enabled && state.loading, loadMore, reload }
}
