import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setNavigator, setUnauthorizedHandler } from '../../api/client'
import { stubBackend } from '../../test/backend'
import { openApp } from '../../test/render'

// F8: allowlists, settings, deployments of every application
beforeEach(() => {
  setNavigator(vi.fn())
  setUnauthorizedHandler(() => {})
})
afterEach(() => {
  setNavigator(null)
  vi.unstubAllGlobals()
})

describe('allowlists (A3)', () => {
  const groups = async () => screen.findByRole('region', { name: 'RACF groups' })

  it('adds a group, changes its description and removes it', async () => {
    const { db } = stubBackend({ user: 'ADMIN01' })
    openApp('/admin/lists')
    const list = await groups()
    await within(list).findByText('LWDNEW')
    await userEvent.type(within(list).getByLabelText('New name in RACF groups'), 'lwdops')
    await userEvent.type(within(list).getByLabelText('New description in RACF groups'), 'Operations')
    await userEvent.click(within(list).getByRole('button', { name: 'Add' }))
    expect(await within(list).findByText('LWDOPS')).toBeInTheDocument()
    await userEvent.click(within(list).getByRole('button', { name: 'Edit LWDOPS' }))
    const desc = within(list).getByLabelText('Description of LWDOPS')
    await userEvent.clear(desc)
    await userEvent.type(desc, 'Operations team')
    await userEvent.click(within(list).getByRole('button', { name: 'Save' }))
    expect(await within(list).findByText('Operations team')).toBeInTheDocument()
    await userEvent.click(within(list).getByRole('button', { name: 'Remove LWDOPS' }))
    await vi.waitFor(() => expect(within(list).queryByText('LWDOPS')).not.toBeInTheDocument())
    expect(db.data.refTables.some((r) => r.tabKey === 'LWDOPS')).toBe(false)
  })

  it('says where a group is still used when it can’t be removed', async () => {
    stubBackend({ user: 'ADMIN01' })
    openApp('/admin/lists')
    const list = await groups()
    await userEvent.click(await within(list).findByRole('button', { name: 'Remove LWDHR' }))
    expect(await within(list).findByRole('alert')).toHaveTextContent('LWDHR is still used: access group of HRAP')
  })

  it('lists the deploy userids apart', async () => {
    stubBackend({ user: 'ADMIN01' })
    openApp('/admin/lists')
    const users = await screen.findByRole('region', { name: 'Deploy userids' })
    expect(await within(users).findByText('LWDDEPP')).toBeInTheDocument()
    expect(within(users).queryByText('LWDNEW')).not.toBeInTheDocument()
  })
})

describe('settings (A5)', () => {
  it('changes an editable setting, and shows the refusal of one out of range', async () => {
    const { db } = stubBackend({ user: 'ADMIN01' })
    openApp('/admin/settings')
    const jobmins = await screen.findByLabelText(/Minutes a job may run/)
    expect(jobmins).toHaveValue(120)
    await userEvent.clear(jobmins)
    await userEvent.type(jobmins, '60')
    const row = jobmins.closest('li')
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }))
    expect(await within(row).findByRole('status')).toHaveTextContent('Saved')
    expect(db.data.refTables.find((r) => r.tabKey === 'JOBMINS').tabValue).toBe('60')

    const mailfrom = screen.getByLabelText(/Sender of LWD/)
    await userEvent.clear(mailfrom)
    await userEvent.type(mailfrom, 'lwd@localhost')
    const mailRow = mailfrom.closest('li')
    await userEvent.click(within(mailRow).getByRole('button', { name: 'Save' }))
    expect(await within(mailRow).findByRole('alert')).toHaveTextContent('MAILFROM: an email address')
  })

  it('shows the settings from envs/<env>.yaml read-only', async () => {
    stubBackend({ user: 'ADMIN01' })
    openApp('/admin/settings')
    const row = (await screen.findByText('ADMINRES')).closest('tr')
    expect(within(row).getByText('LWD.T01.ADMIN')).toBeInTheDocument()
    expect(within(row).queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('LASTTICK')).toBeInTheDocument()
  })
})

describe('deployments of every application (A4)', () => {
  it('lists all of them with the application, and filters', async () => {
    const { calls } = stubBackend({ user: 'ADMIN01' })
    openApp('/admin/deployments')
    expect(await screen.findAllByRole('row')).toHaveLength(8)
    expect(screen.getAllByRole('link', { name: 'DEMO' })[0]).toHaveAttribute('href', '/lwdeploy/app?appID=1')
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Failed')
    await vi.waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2))
    await userEvent.selectOptions(screen.getByLabelText('Status'), '')
    await userEvent.type(screen.getByLabelText('Requested by'), 'nobody')
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }))
    expect(await screen.findByText('No deployments match.')).toBeInTheDocument()
    expect(calls.filter((c) => c.path === '/admin/deployments').at(-1).query).toMatchObject({ requestedBy_filter: 'NOBODY' })
    await userEvent.selectOptions(screen.getByLabelText('Application'), 'PAYR')
    expect(calls.filter((c) => c.path === '/admin/deployments').at(-1).query).toMatchObject({ appID_filter: '2' })
  })
})
