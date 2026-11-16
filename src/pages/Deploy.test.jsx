import { screen } from '@testing-library/react'
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

it('requests a deployment and goes to it', async () => {
  const { calls } = stubBackend({ user: 'DEV0001' })
  openApp('/deploy?appID=1&envID=3')
  expect(await screen.findByLabelText('Environment')).toHaveDisplayValue('PRD – Production')
  expect(screen.getByText('Needs 2 approvals before it starts.')).toBeInTheDocument()
  expect(screen.getByText(/must have succeeded in TST first\. TST has V1\.0\.0/)).toBeInTheDocument()
  // Active versions only, newest first
  expect(screen.getAllByRole('option', { name: /^V/ }).map((o) => o.textContent)).toEqual(['V1.0.1-BAD', 'V1.0.0'])
  await userEvent.selectOptions(screen.getByLabelText('Version'), 'V1.0.0')
  await userEvent.type(screen.getByLabelText('Note (optional)'), 'Release 1')
  await userEvent.click(screen.getByRole('button', { name: /request deployment/i }))
  expect(await screen.findByRole('heading', { name: 'Deployment 8: V1.0.0 to PRD' })).toBeInTheDocument()
  expect(window.location.search).toBe('?deplID=8')
  expect(calls.find((c) => c.method === 'POST').body).toEqual({ appID: 1, envID: 3, versionID: 2, startAfter: '', requestNote: 'Release 1' })
})

it('shows the promotion gate refusal', async () => {
  stubBackend({ user: 'DEV0001' })
  openApp('/deploy?appID=1&envID=2')
  await userEvent.selectOptions(await screen.findByLabelText('Version'), 'V1.0.1-BAD')
  await userEvent.click(screen.getByRole('button', { name: /request deployment/i }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Promotion gate: V1.0.1-BAD did not succeed in DEV yet')
})

it('sends a start time in DB2 format', async () => {
  const { calls } = stubBackend({ user: 'DEV0001' })
  openApp('/deploy?appID=1&envID=1')
  await userEvent.click(await screen.findByLabelText('Not before'))
  await userEvent.type(screen.getByLabelText('Start time'), '2030-01-31T18:30')
  await userEvent.click(screen.getByRole('button', { name: /request deployment/i }))
  await screen.findByRole('heading', { name: /^Deployment 8/ })
  expect(calls.find((c) => c.method === 'POST').body.startAfter).toBe('2030-01-31-18.30.00.000000')
})

it('offers only the environments the user may deploy to', async () => {
  stubBackend({ user: 'DEV0002' })
  openApp('/deploy?appID=1&envID=3')
  const env = await screen.findByLabelText('Environment')
  expect(env).toHaveDisplayValue('DEV – Development')
  expect(screen.queryByRole('option', { name: /PRD/ })).not.toBeInTheDocument()
})

it('tells an approver without other roles that there is nowhere to deploy', async () => {
  stubBackend({ user: 'APR0001' })
  openApp('/deploy?appID=1')
  expect(await screen.findByText(/may not deploy to any environment/)).toBeInTheDocument()
})
