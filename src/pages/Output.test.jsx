import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { setNavigator, setUnauthorizedHandler } from '../api/client'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

beforeEach(() => {
  setNavigator(vi.fn())
  setUnauthorizedHandler(() => {})
})
afterEach(() => {
  setNavigator(null)
  vi.unstubAllGlobals()
})

const runOf = (backend, deplID, jobNo) => backend.db.data.jobRuns.find((r) => r.deplID === deplID && r.jobNo === jobNo).runID

it('reads a long spool file part by part', async () => {
  const backend = stubBackend({ user: 'DEV0001' })
  const runID = runOf(backend, 6, 1)
  openApp(`/output?deplID=6&jobNo=1&runID=${runID}&fileNo=4`)
  expect(await screen.findByText(/^IEBCOPY MESSAGES/)).toBeInTheDocument()
  expect(screen.getByText(/step COPY, 644 lines/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: `Run ${runID}` })).toHaveAttribute('href', `/lwdeploy/run?deplID=6&jobNo=1&runID=${runID}`)
  // Click "Next lines" until the end, waiting for each part to arrive
  for (let more = screen.queryByRole('button', { name: /next lines/i }); more; more = screen.queryByRole('button', { name: /next lines/i })) {
    const shown = document.querySelectorAll('pre > div').length
    await userEvent.click(more)
    await vi.waitFor(() => expect(document.querySelectorAll('pre > div').length).toBeGreaterThan(shown))
  }
  expect(await screen.findByText(/WAS HIGHEST SEVERITY CODE$/)).toBeInTheDocument()
  expect(screen.getByText('644')).toBeInTheDocument()
  const calls = backend.calls.filter((c) => c.path === `/spoolText/${runID}`)
  expect(calls[0].query).toEqual({ fileNo: '4' })
  expect(calls.length).toBeGreaterThan(2)
})

it('switches between the spool files of the run', async () => {
  const backend = stubBackend({ user: 'DEV0001' })
  const runID = runOf(backend, 6, 2)
  openApp(`/output?deplID=6&jobNo=2&runID=${runID}&fileNo=4`)
  expect(await screen.findByText('DFH5178 E GROUP DEMO IS LOCKED BY ANOTHER USER')).toBeInTheDocument()
  await userEvent.click(within(screen.getByRole('navigation', { name: 'Spool files' })).getByRole('link', { name: 'JESYSMSG' }))
  expect(await screen.findByText(/IEF142I .* REFRESH - STEP WAS EXECUTED - COND CODE 0008/)).toBeInTheDocument()
  expect(screen.queryByText('DFH5178 E GROUP DEMO IS LOCKED BY ANOTHER USER')).not.toBeInTheDocument()
})

it('says not found without a role', async () => {
  const backend = stubBackend({ user: 'NOROLE1' })
  openApp(`/output?runID=${runOf(backend, 6, 2)}&fileNo=1`)
  expect(await screen.findByText(/doesn.t exist, or you have no role/)).toBeInTheDocument()
})
