import { vi } from 'vitest'
import { createDb } from '../../mock/db.js'
import { dispatch } from '../../mock/routes.js'
import { buildSeed } from '../../mock/seed.js'

// The mock backend of mock/ behind fetch, for page tests: a fresh database
// from the seed, signed in as `user` (a RACF userid, or null without a
// session). Returns { db, calls, signIn(user), advance(ms) }. Undo with
// vi.unstubAllGlobals(). advance(ms) moves the mock's clock, which moves
// deployments along (mock/db.js, tick).
export function stubBackend({ user = null, now = new Date() } = {}) {
  const clock = { now }
  const db = createDb(buildSeed(now), () => clock.now)
  const state = { user, calls: [] }
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const u = new URL(url, 'http://localhost')
    const call = {
      method: init.method ?? 'GET',
      path: u.pathname.replace(/^\/lwdeploy\/API\/v1/, ''),
      query: Object.fromEntries(u.searchParams),
      body: init.body instanceof FormData ? Object.fromEntries(init.body) : init.body ? JSON.parse(init.body) : {},
    }
    state.calls.push(call)
    const { status, body } = dispatch(db, { ...call, user: state.user })
    return new Response(body === '' ? '' : JSON.stringify(body), { status })
  }))
  return {
    db,
    calls: state.calls,
    signIn: (u) => {
      state.user = u
    },
    advance: (ms) => {
      clock.now = new Date(clock.now.getTime() + ms)
    },
  }
}
