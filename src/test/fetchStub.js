import { vi } from 'vitest'

// Replaces fetch: respond(call) gets { method, path, query, body } and returns
// { status, body } (body is JSON-encoded; a string is sent as is). The calls
// are kept in `calls`. Undo with vi.unstubAllGlobals().
export function stubFetch(respond) {
  const calls = []
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const u = new URL(url, 'http://localhost')
    const call = {
      method: init.method ?? 'GET',
      path: u.pathname,
      query: Object.fromEntries(u.searchParams),
      body: init.body instanceof FormData ? Object.fromEntries(init.body) : init.body ? JSON.parse(init.body) : undefined,
    }
    calls.push(call)
    const { status = 200, body = {} } = (await respond(call)) ?? {}
    const text = typeof body === 'string' ? body : JSON.stringify(body)
    return new Response(text, { status })
  }))
  return calls
}

export const ok = (fields = {}) => ({ retCode: '00', reasonCode: '00', infoMessage: '', ...fields })
export const err = (status, retCode, reasonCode, infoMessage = '') => ({
  status,
  body: { retCode, reasonCode, infoMessage },
})
