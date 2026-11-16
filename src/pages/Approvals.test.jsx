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

describe('the approvals list', () => {
  it('lists what waits, linking to the deployment', async () => {
    stubBackend({ user: 'APR0001' })
    openApp('/approvals')
    const rows = await screen.findAllByRole('row')
    expect(rows).toHaveLength(2)
    expect(within(rows[1]).getByRole('link', { name: '7' })).toHaveAttribute('href', '/lwdeploy/deployment?deplID=7')
    expect(within(rows[1]).getByText('0 of 2')).toBeInTheDocument()
    expect(within(rows[1]).queryByRole('button')).not.toBeInTheDocument()
  })

  it('says when nothing waits', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/approvals')
    expect(await screen.findByText('Nothing waits for your approval.')).toBeInTheDocument()
  })
})

describe('deciding on the deployment page', () => {
  it('approves after confirming the JCL was read; the second approval starts it', async () => {
    const backend = stubBackend({ user: 'APR0001' })
    openApp('/deployment?deplID=7')
    expect(await screen.findByRole('heading', { name: 'Approval: 0 of 2' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'job 1, Copy load modules' })).toHaveAttribute('href', '/lwdeploy/jcl?deplID=7&jobNo=1')
    expect(screen.getByLabelText('1 waiting')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Confirm that you read the JCL of every job first.')
    await userEvent.click(screen.getByLabelText('I read the JCL of every job'))
    await userEvent.type(screen.getByLabelText('Comment (required to reject)'), 'Looks right')
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(await screen.findByRole('heading', { name: 'Approval: 1 of 2' })).toBeInTheDocument()
    expect(screen.getAllByText('Looks right').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('1 waiting')).not.toBeInTheDocument()

    backend.signIn('DEV0002')
    expect(backend.db.newApproval('DEV0002', { deplID: 7, decision: 'A' }).body.deplStatus).toBe('U')
  })

  it('rejects only with a reason', async () => {
    stubBackend({ user: 'DEV0002' })
    openApp('/deployment?deplID=7')
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Give the reason for rejecting.')
    await userEvent.type(screen.getByLabelText('Comment (required to reject)'), 'Not before the freeze ends')
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(await screen.findByText('Rejected by an approver.')).toBeInTheDocument()
    expect(screen.getAllByText('Not before the freeze ends').length).toBeGreaterThan(0)
  })

  it('shows the backend refusal when someone else was faster', async () => {
    const backend = stubBackend({ user: 'DEV0002' })
    openApp('/deployment?deplID=7')
    await screen.findByRole('button', { name: 'Approve' })
    backend.db.newApproval('APR0001', { deplID: 7, decision: 'R', commentText: 'No' })
    await userEvent.click(screen.getByLabelText('I read the JCL of every job'))
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/doesn.t wait for approval any more/)
  })

  it('gives the requester no decision, only the decisions so far', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/deployment?deplID=3')
    expect(await screen.findByRole('heading', { name: 'Approval: 2 of 2' })).toBeInTheDocument()
    expect(screen.getByText('JCL checked')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })
})
