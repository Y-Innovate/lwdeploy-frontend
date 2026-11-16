import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

const envRow = async (code) => (await screen.findByText(code, { selector: '.font-mono' })).closest('li')

describe('environments', () => {
  it('shows what is deployed where, in order', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/app?appID=1')
    expect(await screen.findByRole('heading', { name: /DEMO Demo application/ })).toBeInTheDocument()
    const items = await screen.findAllByRole('listitem')
    expect(items.map((li) => within(li).getByText(/^(DEV|TST|PRD)$/).textContent)).toEqual(['DEV', 'TST', 'PRD'])
    expect(within(await envRow('TST')).getByRole('link', { name: 'V1.0.0' })).toHaveAttribute('href', '/lwdeploy/deployment?deplID=5')
    expect(within(await envRow('PRD')).getByText('V0.9.0')).toBeInTheDocument()
  })

  it('warns about a half deployed environment and names the deployment holding it', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/app?appID=1')
    const dev = await envRow('DEV')
    expect(within(dev).getByText(/may be half deployed/i)).toBeInTheDocument()
    expect(within(dev).getByRole('link', { name: /held by deployment 6/i })).toHaveAttribute('href', '/lwdeploy/deployment?deplID=6')
  })

  it('shows approval and gate, and Deploy only where the user may', async () => {
    stubBackend({ user: 'DEV0002' })
    openApp('/app?appID=1')
    const prd = await envRow('PRD')
    expect(within(prd).getByText('2 approvals')).toBeInTheDocument()
    expect(within(prd).getByText('Promotion gate')).toBeInTheDocument()
    expect(within(prd).queryByRole('link', { name: 'Deploy' })).not.toBeInTheDocument()
    expect(within(await envRow('TST')).getByRole('link', { name: 'Deploy' })).toHaveAttribute('href', '/lwdeploy/deploy?appID=1&envID=2')
  })

  it('gives an approver without other roles no Deploy at all', async () => {
    stubBackend({ user: 'APR0001' })
    openApp('/app?appID=1')
    await envRow('DEV')
    expect(screen.queryByRole('link', { name: 'Deploy' })).not.toBeInTheDocument()
    expect(screen.getByText('Approver')).toBeInTheDocument()
  })
})

describe('versions', () => {
  it('hides retired versions until asked', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/app?appID=1&tab=versions')
    expect(await screen.findByText('V1.0.1-BAD')).toBeInTheDocument()
    expect(screen.queryByText('V0.9.0')).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Show retired versions'))
    expect(await screen.findByText('V0.9.0')).toBeInTheDocument()
    expect(screen.getByText('Retired')).toBeInTheDocument()
  })
})

describe('deployments', () => {
  it('lists the history and filters it', async () => {
    const { calls } = stubBackend({ user: 'DEV0002' })
    openApp('/app?appID=1')
    await userEvent.click(await screen.findByRole('button', { name: /deployments/i }))
    expect(window.location.search).toBe('?appID=1&tab=deployments')
    expect(await screen.findAllByRole('row')).toHaveLength(8)
    const envFilter = screen.getByLabelText('Environment')
    await within(envFilter).findByRole('option', { name: 'DEV' })
    await userEvent.selectOptions(envFilter, 'DEV')
    await vi.waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(4))
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Failed')
    await vi.waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2))
    expect(calls.filter((c) => c.path === '/deployments').at(-1).query)
      .toMatchObject({ appID: '1', envID_filter: '1', deplStatus_filter: 'F' })
  })

  it('shows only my own requests on request', async () => {
    stubBackend({ user: 'DEV0002' })
    openApp('/app?appID=1&tab=deployments')
    await screen.findAllByRole('row')
    await userEvent.click(screen.getByLabelText('Only mine'))
    expect(await screen.findByText('No deployments match.')).toBeInTheDocument()
  })
})

it('says not found for an application without a role, without telling it exists', async () => {
  stubBackend({ user: 'DEV0001' })
  openApp('/app?appID=3')
  expect(await screen.findByRole('heading', { name: 'Application not found' })).toBeInTheDocument()
})
