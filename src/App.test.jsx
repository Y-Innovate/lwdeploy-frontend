import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setNavigator, setUnauthorizedHandler } from './api/client'
import { stubBackend } from './test/backend'
import { openApp } from './test/render'

let assign
beforeEach(() => {
  assign = vi.fn()
  setNavigator(assign)
  setUnauthorizedHandler(() => {})
})
afterEach(() => {
  setNavigator(null)
  vi.unstubAllGlobals()
})

describe('without a session', () => {
  it('is sent to sign-in, and back to the page afterwards', async () => {
    stubBackend()
    openApp('/deployment?deplID=5')
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(
      `/lwdeploy/login?returnTo=${encodeURIComponent('/lwdeploy/deployment?deplID=5')}`,
    ))
  })

  it('goes back to /lwdeploy, without a trailing slash, from the start page', async () => {
    stubBackend()
    openApp('/')
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(
      `/lwdeploy/login?returnTo=${encodeURIComponent('/lwdeploy')}`,
    ))
  })

  it('sees no error about the session, which LWW answers with 404', async () => {
    stubBackend()
    openApp('/login')
    await screen.findByLabelText('Userid')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
  })
})

describe('signed in', () => {
  it('shows the userid, the navigation and sign-out', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/')
    expect(await screen.findByRole('heading', { name: 'Applications' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Applications' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Approvals' })).toHaveAttribute('href', '/lwdeploy/approvals')
    expect(screen.getByRole('link', { name: /sign out/i })).toHaveAttribute('href', '/lwdeploy/logout.html')
    expect(screen.queryByText('Administrator')).not.toBeInTheDocument()
  })

  it('shows how many approvals wait', async () => {
    stubBackend({ user: 'DEV0002' })
    openApp('/')
    expect(await screen.findByLabelText('1 waiting')).toBeInTheDocument()
  })

  it('marks an administrator', async () => {
    stubBackend({ user: 'ADMIN01' })
    openApp('/')
    expect(await screen.findByText('Administrator')).toBeInTheDocument()
  })

  it('gets not found for a page that does not exist', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/nothing')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('reports a backend that is down, and offers to try again', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('CICS abend', { status: 500 })))
    openApp('/')
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not check who is signed in/i)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(assign).not.toHaveBeenCalled()
  })
})
