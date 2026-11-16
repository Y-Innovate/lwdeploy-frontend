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

it('is opened from the userid in the top bar', async () => {
  stubBackend({ user: 'DEV0001' })
  openApp('/')
  const link = await screen.findByRole('link', { name: 'DEV0001' })
  expect(link).toHaveAttribute('href', '/lwdeploy/profile')
})

it('shows the address and saves the notification settings', async () => {
  const { db, calls } = stubBackend({ user: 'DEV0001' })
  openApp('/profile')
  const address = await screen.findByRole('region', { name: 'Email address' })
  expect(within(address).getByText('dev0001@example.com')).toBeInTheDocument()
  expect(within(address).getByText(/copies it from your RACF userid/)).toBeInTheDocument()

  const save = screen.getByRole('button', { name: 'Save' })
  expect(save).toBeDisabled()
  expect(screen.getByLabelText(/waits for my approval/)).toBeChecked()
  expect(screen.getByLabelText(/application I own ends/)).not.toBeChecked()
  await userEvent.click(screen.getByLabelText(/waits for my approval/))
  await userEvent.click(screen.getByLabelText(/application I own ends/))
  await userEvent.click(save)
  expect(await screen.findByRole('status')).toHaveTextContent('Saved')
  expect(calls.find((c) => c.method === 'PUT').body).toEqual({ notifyApprove: 'N', notifyOwn: 'Y', notifyApp: 'Y' })
  expect(db.data.users.find((u) => u.userID === 'DEV0001')).toMatchObject({ notifyApprove: 'N', notifyApp: 'Y' })
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
})

it('says when LWD has no address', async () => {
  stubBackend({ user: 'NOROLE1' })
  openApp('/profile')
  expect(await screen.findByText(/no email address for you/)).toBeInTheDocument()
})
