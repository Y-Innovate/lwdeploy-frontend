import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { setNavigator } from '../api/client'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

let goTo
beforeEach(() => {
  goTo = vi.fn()
  setNavigator(goTo)
  sessionStorage.clear()
})
afterEach(() => {
  setNavigator(null)
  vi.unstubAllGlobals()
})

it('posts userid and passphrase to LWW, not to the API', async () => {
  stubBackend()
  openApp('/login')
  const userid = await screen.findByLabelText('Userid')
  const form = userid.closest('form')
  expect(form).toHaveAttribute('action', '/lwdeploy/process_login.html')
  expect(form).toHaveAttribute('method', 'post')
  expect(userid).toHaveAttribute('name', 'username')
  expect(screen.getByLabelText('Passphrase')).toHaveAttribute('name', 'password')
  expect(screen.getByLabelText('Passphrase')).toHaveAttribute('type', 'password')
})

it('remembers the requested page for after sign-in, from LWW or the app', async () => {
  stubBackend()
  openApp(`/login?requestedURL=${encodeURIComponent('/lwdeploy/deployment?deplID=5')}`)
  await screen.findByLabelText('Userid')
  expect(sessionStorage.getItem('requestedURL')).toBe('/lwdeploy/deployment?deplID=5')
})

it('ignores a requested page outside the app', async () => {
  stubBackend()
  openApp(`/login?returnTo=${encodeURIComponent('https://evil.example/')}`)
  await screen.findByLabelText('Userid')
  expect(sessionStorage.getItem('requestedURL')).toBeNull()
})

it('says when sign-in failed', async () => {
  stubBackend()
  openApp('/login?failed=1')
  expect(await screen.findByRole('alert')).toHaveTextContent(/sign-in failed/i)
})

it('shows and hides the passphrase', async () => {
  stubBackend()
  openApp('/login')
  await userEvent.click(await screen.findByRole('button', { name: 'Show passphrase' }))
  expect(screen.getByLabelText('Passphrase')).toHaveAttribute('type', 'text')
  await userEvent.click(screen.getByRole('button', { name: 'Hide passphrase' }))
  expect(screen.getByLabelText('Passphrase')).toHaveAttribute('type', 'password')
})

it('starts the Entra sign-in at LWW', async () => {
  stubBackend()
  openApp('/login')
  await userEvent.click(await screen.findByRole('button', { name: /sign in with entra/i }))
  expect(goTo).toHaveBeenCalledWith('/lwdeploy/redirect_to_sso_login.html')
})

it('tells a signed-in user so', async () => {
  stubBackend({ user: 'DEV0001' })
  openApp('/login')
  expect(await screen.findByText(/signed in as DEV0001/i)).toBeInTheDocument()
})
