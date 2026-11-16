import { afterEach, expect, it, vi } from 'vitest'
import { approvalRequests, decide } from './approvals'
import { ok, stubFetch } from '../test/fetchStub'

afterEach(() => vi.unstubAllGlobals())

it('sends a decision with its comment', async () => {
  const calls = stubFetch(() => ({ status: 201, body: ok({ deplID: 7, deplStatus: 'W', approvedCount: 1, approvalCount: 2 }) }))
  expect(await decide(7, 'A', 'JCL ok')).toMatchObject({ approvedCount: 1 })
  expect(calls[0]).toMatchObject({ method: 'POST', path: '/lwdeploy/API/v1/approvals', body: { deplID: 7, decision: 'A', commentText: 'JCL ok' } })
})

it('pages the requests by deplID', async () => {
  stubFetch(() => ({ body: ok({ approvalRequests: Array.from({ length: 20 }, (_, i) => ({ deplID: i + 1 })) }) }))
  expect((await approvalRequests.list()).next).toEqual({ deplID_since: 20 })
})
