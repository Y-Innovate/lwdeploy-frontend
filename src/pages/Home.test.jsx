import { screen, waitFor, within } from '@testing-library/react'
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

it('lists the applications with the roles, linking to each', async () => {
  stubBackend({ user: 'DEV0001' })
  openApp('/')
  const demo = await screen.findByRole('link', { name: /Demo application/ })
  expect(demo).toHaveAttribute('href', '/lwdeploy/app?appID=1')
  expect(within(demo).getByText('Member')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Payroll batch/ })).toBeInTheDocument()
  expect(screen.queryByText(/HR application/)).not.toBeInTheDocument()
})

it('lists my own requests across applications, newest first', async () => {
  const { calls } = stubBackend({ user: 'DEV0001' })
  openApp('/')
  const rows = await screen.findAllByRole('row')
  // header, filter row + 7 deployments
  expect(rows).toHaveLength(9)
  expect(within(rows[2]).getByRole('link', { name: '7' })).toHaveAttribute('href', '/lwdeploy/deployment?deplID=7')
  expect(within(rows[2]).getByText('Awaiting approval')).toBeInTheDocument()
  expect(calls.find((c) => c.path === '/deployments').query).toEqual({ appID: '0', requestedBy_filter: 'DEV0001' })
})

it('filters my own requests with a box per column', async () => {
  const { calls } = stubBackend({ user: 'DEV0001' })
  const user = userEvent.setup()
  openApp('/')
  expect(await screen.findAllByRole('row')).toHaveLength(9)

  await user.type(screen.getByRole('textbox', { name: 'Filter on environment' }), 'dev')
  await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2 + 3))
  expect(calls.at(-1).query).toEqual({ appID: '0', requestedBy_filter: 'DEV0001', envCode_filter: 'dev' })

  await user.selectOptions(screen.getByRole('combobox', { name: 'Filter on status' }), 'F')
  await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2 + 1))
  expect(within(screen.getAllByRole('row')[2]).getByRole('link', { name: '6' })).toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: 'Filter on deployment' }), 'x7')
  expect(screen.getByRole('textbox', { name: 'Filter on deployment' })).toHaveValue('7')
  expect(await screen.findByText('None of your requests match.')).toBeInTheDocument()
  // the boxes stay, so the filter can be undone
  await user.clear(screen.getByRole('textbox', { name: 'Filter on deployment' }))
  await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2 + 1))
})

it('points an approver to the approvals waiting', async () => {
  stubBackend({ user: 'DEV0002' })
  openApp('/')
  const link = await screen.findByRole('link', { name: /1 deployment waits for your approval/ })
  expect(link).toHaveAttribute('href', '/lwdeploy/approvals')
  expect(await screen.findByText("You haven't requested a deployment yet.")).toBeInTheDocument()
})

it('tells a user without roles to ask for access', async () => {
  stubBackend({ user: 'NOROLE1' })
  openApp('/')
  expect(await screen.findByText(/no role in any application yet/)).toBeInTheDocument()
  expect(screen.queryByText(/as an administrator/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/waits for your approval/)).not.toBeInTheDocument()
})

it('tells an administrator without roles where the applications will be', async () => {
  stubBackend({ user: 'ADMIN01' })
  openApp('/')
  expect(await screen.findByText(/as an administrator you will see every application/i)).toBeInTheDocument()
})

it('shows a backend error with a retry', async () => {
  const backend = stubBackend({ user: 'DEV0001' })
  backend.db.listApplications = () => ({ status: 500, body: { retCode: '08', reasonCode: '21', infoMessage: 'SQL error' } })
  openApp('/')
  expect(await screen.findByText('Backend error: SQL error')).toBeInTheDocument()
})
