import { expect, it } from 'vitest'
import { laterStart, pollMs, rcText, statusText } from './deployment'

it('polls often while running or queued, seldom while waiting, never when final', () => {
  expect(pollMs('U')).toBe(5000)
  expect(pollMs('Q')).toBe(5000)
  expect(pollMs('W')).toBe(30000)
  for (const s of ['S', 'F', 'C', 'J', 'E']) expect(pollMs(s)).toBe(0)
})

it('shows an abend before an RC, and nothing while not known', () => {
  expect(rcText({ jobRC: 8, abendCode: '' })).toBe('8')
  expect(rcText({ jobRC: 0, abendCode: '' })).toBe('0')
  expect(rcText({ jobRC: -1, abendCode: '' })).toBe('')
  expect(rcText({ jobRC: -1, abendCode: 'S0C4' })).toBe('S0C4')
})

it('says how a deployment stands', () => {
  const d = { deplStatus: 'W', approvedCount: 1, approvalCount: 2, envCode: 'PRD', versionName: 'V1.0.0', startAfter: '' }
  expect(statusText(d)).toBe('Waits for approval: 1 of 2 so far.')
  expect(statusText({ ...d, deplStatus: 'Q' })).toBe('Queued: starts as soon as PRD is free.')
  expect(statusText({ ...d, deplStatus: 'U' }, [{ jobNo: 2, jobTitle: 'Refresh CICS', jobStatus: 'S' }]))
    .toBe('Running job 2, Refresh CICS.')
  expect(statusText({ ...d, deplStatus: 'F' }, [{ jobNo: 2, jobTitle: 'Refresh CICS', jobStatus: 'F' }]))
    .toMatch(/^Job 2, Refresh CICS, failed\. It holds PRD/)
})

it('takes startAfter as a requested start only when it is later than the request', () => {
  const requestedDate = '2026-11-15-12.00.00.123456'
  expect(laterStart({ requestedDate, startAfter: '2026-11-15-12.00.00.123999' })).toBe('')
  expect(laterStart({ requestedDate, startAfter: '2026-11-15-18.30.00.000000' })).toBe('2026-11-15-18.30.00.000000')
  expect(laterStart({ requestedDate, startAfter: '' })).toBe('')
})
