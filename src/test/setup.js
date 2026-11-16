import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// findBy* and waitFor give up after 1 s by default; with the whole suite
// running in parallel a page sometimes needs longer (2026-11-11: two
// intermittent failures in ctflww-frontend)
configure({ asyncUtilTimeout: 3000 })

afterEach(() => {
  cleanup()
  globalThis.localStorage?.clear()
})
