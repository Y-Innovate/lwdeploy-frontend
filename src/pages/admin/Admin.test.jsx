import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setNavigator, setUnauthorizedHandler } from '../../api/client'
import { stubBackend } from '../../test/backend'
import { openApp } from '../../test/render'

beforeEach(() => {
  setNavigator(vi.fn())
  setUnauthorizedHandler(() => {})
})
afterEach(() => {
  setNavigator(null)
  vi.unstubAllGlobals()
})

describe('access', () => {
  it('shows Admin in the top bar only to administrators', async () => {
    stubBackend({ user: 'ADMIN01' })
    openApp('/')
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/lwdeploy/admin')
  })

  it('tells anyone else the page is for administrators, without calling the admin paths', async () => {
    const { calls } = stubBackend({ user: 'OWN0001' })
    openApp('/admin')
    expect(await screen.findByText('This page is for LWD administrators.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    expect(calls.some((c) => c.path.startsWith('/admin'))).toBe(false)
  })
})

describe('applications (A1)', () => {
  it('lists every application with its groups', async () => {
    stubBackend({ user: 'ADMIN01' })
    openApp('/admin')
    expect(await screen.findByRole('heading', { name: 'Applications' })).toBeInTheDocument()
    const hrap = (await screen.findByRole('link', { name: 'HRAP' })).closest('tr')
    expect(within(hrap).getByText('LWDHR')).toBeInTheDocument()
    expect(within(hrap).getByRole('link', { name: 'HRAP' })).toHaveAttribute('href', '/lwdeploy/admin/app?appID=3')
  })

  it('creates one with groups from the allowlist, and opens it', async () => {
    stubBackend({ user: 'ADMIN01' })
    openApp('/admin')
    await userEvent.click(await screen.findByRole('button', { name: /new application/i }))
    await userEvent.type(await screen.findByLabelText('Code'), 'web')
    await userEvent.type(screen.getByLabelText('Name'), 'Web shop')
    const access = screen.getByLabelText('Access group')
    await within(access).findByRole('option', { name: /LWDNEW/ })
    await userEvent.selectOptions(access, 'LWDNEW')
    await userEvent.selectOptions(screen.getByLabelText('Owner group'), 'LWDOWN')
    await userEvent.click(screen.getByRole('button', { name: 'Create application' }))
    expect(await screen.findByRole('heading', { name: 'WEB Web shop' })).toBeInTheDocument()
    expect(window.location.search).toBe('?appID=4')
    expect(await screen.findByText(/No environments yet/)).toBeInTheDocument()
  })

  it('shows the refusal of a taken code', async () => {
    stubBackend({ user: 'ADMIN01' })
    openApp('/admin')
    await userEvent.click(await screen.findByRole('button', { name: /new application/i }))
    await userEvent.type(await screen.findByLabelText('Code'), 'DEMO')
    await userEvent.type(screen.getByLabelText('Name'), 'Again')
    const access = screen.getByLabelText('Access group')
    await within(access).findByRole('option', { name: /LWDNEW/ })
    await userEvent.selectOptions(access, 'LWDNEW')
    await userEvent.selectOptions(screen.getByLabelText('Owner group'), 'LWDOWN')
    await userEvent.click(screen.getByRole('button', { name: 'Create application' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Application code DEMO is taken')
  })

  it('changes an application', async () => {
    const { db } = stubBackend({ user: 'ADMIN01' })
    openApp('/admin/app?appID=2')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const name = screen.getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Payroll')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { name: 'PAYR Payroll' })).toBeInTheDocument()
    expect(db.data.applications.find((a) => a.appID === 2).appName).toBe('Payroll')
  })

  it('refuses to delete an application with deployments, and deletes one without', async () => {
    const { db } = stubBackend({ user: 'ADMIN01' })
    openApp('/admin/app?appID=1')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete application' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete DEMO' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('DEMO has 7 deployments')

    window.history.pushState({}, '', '/lwdeploy/admin/app?appID=2')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete application' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete PAYR' }))
    expect(await screen.findByRole('heading', { name: 'Applications' })).toBeInTheDocument()
    expect(db.data.applications.some((a) => a.appID === 2)).toBe(false)
  })
})

describe('environment controls (A2)', () => {
  const envCard = async (code) => (await screen.findByText(code, { selector: '.font-mono.font-medium' })).closest('li')

  it('shows the controls of every environment', async () => {
    stubBackend({ user: 'ADMIN01' })
    openApp('/admin/app?appID=1')
    const prd = await envCard('PRD')
    expect(within(prd).getByText('2 approvals', { exact: false })).toBeInTheDocument()
    expect(within(prd).getByText('LWDAPR')).toBeInTheDocument()
    expect(within(prd).getByText('LWDDPL')).toBeInTheDocument()
    expect(within(await envCard('DEV')).getByText('Every member')).toBeInTheDocument()
  })

  it('switches approval on with a group and N', async () => {
    const { db } = stubBackend({ user: 'ADMIN01' })
    openApp('/admin/app?appID=2')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit controls of DEV' }))
    await userEvent.click(screen.getByLabelText('Deployments need approval'))
    expect(screen.getByText(/more than 1 members besides the requester/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Approver group'), 'LWDAPR')
    await userEvent.type(screen.getByLabelText('Execution node'), 'n2')
    await userEvent.click(screen.getByRole('button', { name: 'Save controls' }))
    const dev = await envCard('DEV')
    await vi.waitFor(() => expect(within(dev).getByText('N2')).toBeInTheDocument())
    expect(db.data.environments.find((e) => e.envID === 4)).toMatchObject({ approvalReq: 'Y', approverGroup: 'LWDAPR', approvalCount: 1, execNode: 'N2' })
  })

  it('takes the deploy userid away, which stops deploying there', async () => {
    stubBackend({ user: 'ADMIN01' })
    openApp('/admin/app?appID=2')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit controls of DEV' }))
    await userEvent.selectOptions(screen.getByLabelText('Deploy userid'), '')
    await userEvent.click(screen.getByRole('button', { name: 'Save controls' }))
    expect(await screen.findByText(/can.t be deployed to yet/)).toBeInTheDocument()
  })

  it('shows the backend’s refusal', async () => {
    stubBackend({ user: 'ADMIN01' })
    openApp('/admin/app?appID=2')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit controls of DEV' }))
    await userEvent.type(screen.getByLabelText('Execution node'), '9NODE')
    await userEvent.click(screen.getByRole('button', { name: 'Save controls' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('execNode')
  })
})
