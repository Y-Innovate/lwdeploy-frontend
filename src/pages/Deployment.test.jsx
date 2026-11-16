import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setNavigator, setUnauthorizedHandler } from '../api/client'
import { JOB_MS } from '../../mock/deployments.js'
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

const jobRow = (n) => screen.getAllByRole('row').find((r) => within(r).queryAllByRole('cell')[0]?.textContent === String(n))

it('shows a deployment that succeeded, with its jobs and history', async () => {
  stubBackend({ user: 'DEV0001' })
  openApp('/deployment?deplID=4')
  expect(await screen.findByRole('heading', { name: 'Deployment 4: V1.0.0 to DEV' })).toBeInTheDocument()
  expect(screen.getByText('Succeeded: V1.0.0 is in DEV.')).toBeInTheDocument()
  expect(within(jobRow(1)).getByText('Copy load modules')).toBeInTheDocument()
  expect(within(jobRow(2)).getByRole('link', { name: 'Output' })).toHaveAttribute('href', expect.stringMatching(/^\/lwdeploy\/run\?deplID=4&jobNo=2&runID=\d+$/))
  expect(within(jobRow(1)).getByRole('link', { name: 'JCL' })).toHaveAttribute('href', '/lwdeploy/jcl?deplID=4&jobNo=1')
  const history = screen.getByRole('heading', { name: 'History' }).parentElement
  expect(within(history).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    expect.stringContaining('Requested'), expect.stringContaining('Started'), expect.stringContaining('Succeeded'),
  ])
  expect(screen.queryByRole('button', { name: /cancel|retry|continue/i })).not.toBeInTheDocument()
})

it('follows a running deployment until it ends', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const backend = stubBackend({ user: 'DEV0001' })
  backend.db.cancelDeployment('DEV0001', 6, {})
  backend.db.newDeployment('DEV0001', { appID: 1, envID: 1, versionID: 2 })
  openApp('/deployment?deplID=8')
  expect(await screen.findByText('Running job 1, Copy load modules.')).toBeInTheDocument()
  expect(screen.getByText(/can't be cancelled/)).toBeInTheDocument()
  backend.advance(JOB_MS)
  await act(() => vi.advanceTimersByTimeAsync(5000))
  expect(await screen.findByText('Running job 2, Refresh CICS.')).toBeInTheDocument()
  backend.advance(JOB_MS)
  await act(() => vi.advanceTimersByTimeAsync(5000))
  expect(await screen.findByText('Succeeded: V1.0.0 is in DEV.')).toBeInTheDocument()
  const gets = backend.calls.filter((c) => c.path === '/deployments/8').length
  await act(() => vi.advanceTimersByTimeAsync(60000))
  expect(backend.calls.filter((c) => c.path === '/deployments/8')).toHaveLength(gets)
})

describe('a failed deployment', () => {
  it('can be retried, and fails again for a BAD version', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/deployment?deplID=6')
    expect(await screen.findByText(/^Job 2, Refresh CICS, failed/)).toBeInTheDocument()
    expect(within(jobRow(2)).getByText('Above the highest RC')).toBeInTheDocument()
    expect(within(jobRow(2)).getByText('8')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit the failed job again' }))
    expect(await screen.findByText('Running job 2, Refresh CICS.')).toBeInTheDocument()
  })

  it('can be continued only with a reason', async () => {
    const { calls } = stubBackend({ user: 'DEV0001' })
    openApp('/deployment?deplID=6')
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    const reason = screen.getByLabelText('Why the failed job can be skipped')
    expect(reason).toBeRequired()
    await userEvent.type(reason, 'RC 8 is expected here')
    await userEvent.click(screen.getByRole('button', { name: 'Skip the failed job and go on' }))
    expect(await screen.findByText('Succeeded: V1.0.1-BAD is in DEV.')).toBeInTheDocument()
    expect(screen.getByText('Skipped: RC 8 is expected here')).toBeInTheDocument()
    expect(calls.find((c) => c.path === '/continuations/6').body).toEqual({ commentText: 'RC 8 is expected here' })
  })

  it('can be cancelled with a reason, which goes into the history', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/deployment?deplID=6')
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await userEvent.type(screen.getByLabelText('Reason (optional)'), 'Fixed in V1.0.2')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel the deployment' }))
    expect(await screen.findByText('Cancelled.')).toBeInTheDocument()
    expect(screen.getByText('Fixed in V1.0.2')).toBeInTheDocument()
  })

  it('shows the refusal when the backend says no', async () => {
    const backend = stubBackend({ user: 'DEV0001' })
    openApp('/deployment?deplID=6')
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    // Someone else retried meanwhile: a job is running now
    expect(backend.db.retryDeployment('DEV0002', 6, {}).body.deplStatus).toBe('U')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel the deployment' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A job is running: wait until it ends')
  })
})

it('offers nothing to an approver without other roles but what AP2 will need', async () => {
  stubBackend({ user: 'APR0001' })
  openApp('/deployment?deplID=7')
  expect(await screen.findByText('Waits for approval: 0 of 2 so far.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
})

it('says not found without a role', async () => {
  stubBackend({ user: 'NOROLE1' })
  openApp('/deployment?deplID=7')
  expect(await screen.findByRole('heading', { name: 'Deployment not found' })).toBeInTheDocument()
})
