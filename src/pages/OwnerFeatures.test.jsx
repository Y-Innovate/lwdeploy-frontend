import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setNavigator, setUnauthorizedHandler } from '../api/client'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

// F9: the owner features on the application page (O1, O3, O4)
beforeEach(() => {
  setNavigator(vi.fn())
  setUnauthorizedHandler(() => {})
})
afterEach(() => {
  setNavigator(null)
  vi.unstubAllGlobals()
})

const envRow = async (code) => (await screen.findByText(code, { selector: '.font-mono.font-medium' })).closest('li')
const envCodes = () => screen.getAllByText(/^[A-Z0-9]+$/, { selector: 'li .font-mono.font-medium' }).map((x) => x.textContent)
const versionRow = async (name) => (await screen.findByText(name, { selector: '.font-medium' })).closest('tr')

describe('who sees what', () => {
  it('gives members the variables to read, but nothing to change', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/app?appID=1')
    const prd = await envRow('PRD')
    expect(within(prd).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    await userEvent.click(within(prd).getByRole('button', { name: 'Variables' }))
    const vars = await within(prd).findByRole('region', { name: 'Variables of PRD' })
    expect(within(vars).getByText('LWD.DEMO.PRD.LOAD')).toBeInTheDocument()
    expect(within(vars).queryByRole('button', { name: /add variable/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add environment' })).not.toBeInTheDocument()
  })

  it('gives an administrator who isn’t an owner nothing to change either', async () => {
    stubBackend({ user: 'ADMIN01' })
    openApp('/app?appID=1&tab=versions')
    await versionRow('V1.0.1-BAD')
    expect(screen.queryByRole('button', { name: 'Register version' })).not.toBeInTheDocument()
  })
})

describe('environments (O1)', () => {
  it('adds one, which needs an administrator before it can be deployed to', async () => {
    const { db } = stubBackend({ user: 'OWN0001' })
    openApp('/app?appID=1')
    await userEvent.click(await screen.findByRole('button', { name: 'Add environment' }))
    expect(screen.getByText(/can.t be deployed to until an administrator sets its controls/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Code'), 'acc')
    await userEvent.type(screen.getByLabelText('Name'), 'Acceptance')
    await userEvent.click(screen.getByRole('button', { name: 'Add environment' }))
    const acc = await envRow('ACC')
    expect(within(acc).getByText('1 approval')).toBeInTheDocument()
    expect(within(acc).queryByRole('link', { name: 'Deploy' })).not.toBeInTheDocument()
    expect(db.data.environments.find((e) => e.envCode === 'ACC')).toMatchObject({ sortOrder: 4, deployUser: '' })
  })

  it('edits name and gate, and moves environments', async () => {
    stubBackend({ user: 'OWN0001' })
    openApp('/app?appID=1')
    const tst = await envRow('TST')
    await userEvent.click(within(tst).getByRole('button', { name: 'Edit' }))
    const name = await within(tst).findByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'System test')
    await userEvent.click(within(tst).getByLabelText(/Promotion gate/))
    await userEvent.click(within(tst).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('System test')).toBeInTheDocument()
    expect(within(await envRow('TST')).queryByText('Promotion gate')).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Move DEV up' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Move PRD up' }))
    await vi.waitFor(() => expect(envCodes()).toEqual(['DEV', 'PRD', 'TST']))
  })

  it('refuses to delete an environment with deployments, and says so', async () => {
    stubBackend({ user: 'OWN0001' })
    openApp('/app?appID=1')
    const prd = await envRow('PRD')
    await userEvent.click(within(prd).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(prd).getByRole('button', { name: 'Delete PRD' }))
    expect(await within(prd).findByRole('alert')).toHaveTextContent('PRD has 2 deployments')
  })
})

describe('versions (O4)', () => {
  it('registers a version', async () => {
    stubBackend({ user: 'OWN0001' })
    openApp('/app?appID=1&tab=versions')
    await userEvent.click(await screen.findByRole('button', { name: 'Register version' }))
    await userEvent.type(screen.getByLabelText('Name'), 'v1.1.0')
    await userEvent.click(screen.getByLabelText('USS path'))
    await userEvent.type(screen.getByLabelText('Location'), '/u/lwd/demo/v1.1.0')
    await userEvent.click(screen.getByRole('button', { name: 'Register version' }))
    const row = await versionRow('V1.1.0')
    expect(within(row).getByText('/u/lwd/demo/v1.1.0')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Delete V1.1.0' })).toBeInTheDocument()
  })

  it('offers edit and delete only for a version never requested, and retires one', async () => {
    const { db } = stubBackend({ user: 'OWN0001' })
    openApp('/app?appID=1&tab=versions')
    const bad = await versionRow('V1.0.1-BAD')
    expect(within(bad).queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()
    expect(within(bad).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
    await userEvent.click(within(bad).getByRole('button', { name: 'Retire V1.0.1-BAD' }))
    // The icon has the same name as the button that confirms; only the latter has the text
    await userEvent.click(screen.getByText('Retire V1.0.1-BAD', { selector: 'button' }))
    await vi.waitFor(() => expect(screen.queryByText('V1.0.1-BAD')).not.toBeInTheDocument())
    expect(db.data.versions.find((v) => v.versionID === 3).versionStatus).toBe('R')
  })

  it('shows the variables of a version', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/app?appID=1&tab=versions')
    await userEvent.click(within(await versionRow('V1.0.0')).getByRole('button', { name: 'Variables of V1.0.0' }))
    expect(await screen.findByText('CHG0012345')).toBeInTheDocument()
  })
})

describe('variables (O3)', () => {
  it('adds, changes and deletes an application variable, warning about secrets', async () => {
    const { db } = stubBackend({ user: 'OWN0001' })
    openApp('/app?appID=1&tab=variables')
    const vars = await screen.findByRole('region', { name: 'Variables of the application' })
    expect(await within(vars).findByText('CICSHLQ')).toBeInTheDocument()
    await userEvent.click(within(vars).getByRole('button', { name: 'Add variable' }))
    expect(within(vars).getByText(/never put a password/)).toBeInTheDocument()
    await userEvent.type(within(vars).getByLabelText('Name'), 'jobclass')
    await userEvent.type(within(vars).getByLabelText('Value'), 'A')
    await userEvent.click(within(vars).getByRole('button', { name: 'Add variable' }))
    expect(await within(vars).findByText('JOBCLASS')).toBeInTheDocument()

    await userEvent.click(within(vars).getByRole('button', { name: 'Edit JOBCLASS' }))
    const value = within(vars).getByLabelText('Value')
    await userEvent.clear(value)
    await userEvent.type(value, 'B')
    await userEvent.click(within(vars).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(db.data.variables.find((x) => x.varName === 'JOBCLASS').varValue).toBe('B'))

    await userEvent.click(within(vars).getByRole('button', { name: 'Delete JOBCLASS' }))
    await userEvent.click(within(vars).getByRole('button', { name: 'Delete JOBCLASS' }))
    await vi.waitFor(() => expect(within(vars).queryByText('JOBCLASS')).not.toBeInTheDocument())
  })

  it('shows the refusal of a name LWD keeps for itself', async () => {
    stubBackend({ user: 'OWN0001' })
    openApp('/app?appID=1&tab=variables')
    const vars = await screen.findByRole('region', { name: 'Variables of the application' })
    await userEvent.click(await within(vars).findByRole('button', { name: 'Add variable' }))
    await userEvent.type(within(vars).getByLabelText('Name'), 'LWDENV')
    await userEvent.click(within(vars).getByRole('button', { name: 'Add variable' }))
    expect(await within(vars).findByRole('alert')).toHaveTextContent('LWD')
  })
})
