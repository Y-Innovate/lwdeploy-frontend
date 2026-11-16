import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { setNavigator, setUnauthorizedHandler } from '../api/client'
import { COLLECT_MS, JOB_MS } from '../../mock/deployments.js'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

beforeEach(() => {
  setNavigator(vi.fn())
  setUnauthorizedHandler(() => {})
})
afterEach(() => {
  setNavigator(null)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const runIDs = (backend, deplID, jobNo) =>
  backend.db.data.jobRuns.filter((r) => r.deplID === deplID && r.jobNo === jobNo).map((r) => r.runID).sort((a, b) => b - a)

it('shows the steps and spool files of the newest run', async () => {
  const backend = stubBackend({ user: 'DEV0001' })
  const [runID] = runIDs(backend, 6, 2)
  openApp('/run?deplID=6&jobNo=2')
  expect(await screen.findByRole('heading', { name: 'Job 2: Refresh CICS' })).toBeInTheDocument()
  const steps = (await screen.findByRole('heading', { name: 'Steps' })).parentElement
  const rows = within(steps).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))
  expect(rows).toEqual([['1', 'REFRESH', '8'], ['2', 'LWDRSO', 'Not run'], ['3', 'LWDRSH', '0'], ['4', 'LWDRSA', 'Not run']])
  const files = screen.getByRole('heading', { name: 'Spool files' }).parentElement
  expect(within(files).getByRole('link', { name: 'SYSPRINT' }))
    .toHaveAttribute('href', `/lwdeploy/output?deplID=6&jobNo=2&runID=${runID}&fileNo=4`)
})

it('keeps the failed run readable after a retry, and waits for the new output', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const backend = stubBackend({ user: 'DEV0001' })
  const [failed] = runIDs(backend, 6, 2)
  backend.db.retryDeployment('DEV0001', 6, {})
  openApp('/run?deplID=6&jobNo=2')
  expect(await screen.findByText('The job is still running. Its output is collected after it ends.')).toBeInTheDocument()
  // Two runs: the new one chosen, the failed one a click away
  expect(screen.getAllByRole('row')).toHaveLength(3)
  backend.advance(JOB_MS)
  await act(() => vi.advanceTimersByTimeAsync(5000))
  expect(await screen.findByText(/hasn.t been collected yet/)).toBeInTheDocument()
  backend.advance(COLLECT_MS)
  await act(() => vi.advanceTimersByTimeAsync(30000))
  expect(await screen.findByRole('heading', { name: 'Steps' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: String(failed) }))
  expect(window.location.search).toBe(`?deplID=6&jobNo=2&runID=${failed}`)
})

it('explains purged output', async () => {
  const backend = stubBackend({ user: 'DEV0001' })
  backend.db.data.jobRuns.filter((r) => r.deplID === 4).forEach((r) => { r.outputStatus = 'P' })
  openApp('/run?deplID=4&jobNo=1')
  expect(await screen.findByText(/has been purged after the retention time/)).toBeInTheDocument()
})

it('says when a job was never submitted', async () => {
  stubBackend({ user: 'DEV0001' })
  openApp('/run?deplID=7&jobNo=1')
  expect(await screen.findByText(/hasn.t been submitted yet/)).toBeInTheDocument()
})

it('lets an administrator mark a run stuck whose result step never reports', async () => {
  const backend = stubBackend({ user: 'DEV0001' })
  const r = backend.db.newDeployment('DEV0001', { appID: 1, envID: 2, versionID: 2, requestNote: 'Let it hang' })
  const deplID = r.body.deplID
  backend.advance(JOB_MS * 3)
  backend.signIn('ADMIN01')
  openApp(`/run?deplID=${deplID}&jobNo=1`)
  await userEvent.click(await screen.findByRole('button', { name: 'Mark stuck' }))
  expect(screen.getByText(/has ended in JES, but its result step didn.t report/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Mark run \d+ stuck/ }))
  expect(await screen.findByText('No result in time')).toBeInTheDocument()
  expect(screen.getByText('Marked stuck by ADMIN01')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Mark stuck' })).not.toBeInTheDocument()
  expect(backend.db.data.deployments.find((x) => x.deplID === deplID).deplStatus).toBe('F')
})

it('shows Mark stuck to administrators only', async () => {
  const backend = stubBackend({ user: 'DEV0001' })
  const r = backend.db.newDeployment('DEV0001', { appID: 1, envID: 2, versionID: 2, requestNote: 'hang' })
  openApp(`/run?deplID=${r.body.deplID}&jobNo=1`)
  expect(await screen.findByRole('heading', { name: 'Job 1: Copy load modules' })).toBeInTheDocument()
  await screen.findByRole('button', { name: /^\d+$/ })
  expect(screen.queryByRole('button', { name: 'Mark stuck' })).not.toBeInTheDocument()
})
