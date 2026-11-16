import { beforeEach, describe, expect, it } from 'vitest'
import { createDb } from './db.js'
import { JOB_MS, tsValid } from './deployments.js'
import { dispatch } from './routes.js'
import { buildSeed } from './seed.js'

let clock, db
beforeEach(() => {
  clock = { now: new Date('2026-11-15T12:00:00') }
  db = createDb(buildSeed(clock.now), () => clock.now)
})
const call = (user, method, path, body = {}, query = {}) => dispatch(db, { method, path, user, body, query })
const later = (ms) => {
  clock.now = new Date(clock.now.getTime() + ms)
}
const status = (deplID) => call('DEV0001', 'GET', `/deployments/${deplID}`).body.deplStatus

describe('POST /deployments', () => {
  it('queues a deployment without approval, runs its jobs one by one, and succeeds', () => {
    // TST: V1.0.1-BAD never succeeded in DEV, but V1.0.0 did
    call('DEV0001', 'POST', '/cancellations/6')
    const r = call('DEV0001', 'POST', '/deployments', { appID: 1, envID: 1, versionID: 2, requestNote: 'again' })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ deplID: 8, deplStatus: 'U', envCode: 'DEV', versionName: 'V1.0.0', requestedBy: 'DEV0001' })
    const jobs = () => call('DEV0001', 'GET', '/deploymentJobs', {}, { deplID: 8 }).body.jobs
    expect(jobs().map((j) => j.jobStatus)).toEqual(['S', 'W'])
    expect(jobs()[0]).toMatchObject({ runStatus: 'S', jobRC: -1 })
    later(JOB_MS)
    expect(jobs().map((j) => j.jobStatus)).toEqual(['D', 'S'])
    later(JOB_MS)
    expect(jobs().map((j) => [j.jobStatus, j.jobResult, j.jobRC])).toEqual([['D', 'O', 0], ['D', 'O', 0]])
    expect(status(8)).toBe('S')
    const events = call('DEV0001', 'GET', '/deploymentEvents', {}, { deplID: 8 }).body.events
    expect(events.map((e) => e.eventType)).toEqual(['R', 'U', 'S'])
  })

  it('keeps it queued while the environment is held, and starts it when that is cancelled', () => {
    const r = call('DEV0001', 'POST', '/deployments', { appID: 1, envID: 1, versionID: 2 })
    expect(r.body.deplStatus).toBe('Q')
    call('DEV0001', 'POST', '/cancellations/6', { commentText: 'giving up' })
    expect(status(8)).toBe('U')
  })

  it('waits for a requested start time', () => {
    call('DEV0001', 'POST', '/cancellations/6')
    const r = call('DEV0001', 'POST', '/deployments', { appID: 1, envID: 1, versionID: 2, startAfter: '2026-11-15-13.00.00.000000' })
    expect(r.body).toMatchObject({ deplStatus: 'Q', startAfter: '2026-11-15-13.00.00.000000' })
    later(59 * 60 * 1000)
    expect(status(8)).toBe('Q')
    later(60 * 1000)
    expect(status(8)).toBe('U')
  })

  it('waits for approval in PRD', () => {
    const r = call('DEV0001', 'POST', '/deployments', { appID: 1, envID: 3, versionID: 2 })
    expect(r.body).toMatchObject({ deplStatus: 'W', approvalCount: 2, approvedCount: 0, approverGroup: 'LWDAPR' })
  })

  it('refuses as the backend does', () => {
    const post = (user, body) => call(user, 'POST', '/deployments', { appID: 1, ...body }).body
    expect(post('DEV0001', { envID: 2, versionID: 3 })).toMatchObject({ reasonCode: '54', infoMessage: 'V1.0.1-BAD did not succeed in DEV yet' })
    expect(post('DEV0002', { envID: 3, versionID: 2 }).reasonCode).toBe('50')
    expect(post('DEV0001', { envID: 1, versionID: 1 }).reasonCode).toBe('53')
    expect(post('DEV0001', { envID: 1, versionID: 2, startAfter: 'tomorrow' }).reasonCode).toBe('04')
    expect(post('DEV0001', { envID: 4, versionID: 2 }).reasonCode).toBe('01')
    expect(post('NOROLE1', { envID: 1, versionID: 2 }).reasonCode).toBe('01')
    db.data.templates = []
    expect(post('DEV0001', { envID: 1, versionID: 2 }).reasonCode).toBe('59')
  })
})

describe('GET /deployments/{deplID}', () => {
  it('lets the requester and members cancel, members retry, approvers approve', () => {
    expect(call('DEV0001', 'GET', '/deployments/6').body).toMatchObject({ canCancel: 'Y', canRetry: 'Y', canApprove: 'N' })
    expect(call('DEV0002', 'GET', '/deployments/7').body).toMatchObject({ canCancel: 'Y', canApprove: 'Y' })
    expect(call('DEV0001', 'GET', '/deployments/7').body.canApprove).toBe('N')
    expect(call('APR0001', 'GET', '/deployments/7').body).toMatchObject({ canCancel: 'N', canApprove: 'Y' })
    expect(call('DEV0001', 'GET', '/deployments/4').body).toMatchObject({ canCancel: 'N', canRetry: 'N' })
  })

  it('is not found without a role', () => {
    expect(call('NOROLE1', 'GET', '/deployments/7').status).toBe(404)
    expect(call('ADMIN01', 'GET', '/deployments/7').status).toBe(200)
  })
})

describe('actions', () => {
  it('retries the failed job, which fails again for a BAD version', () => {
    expect(call('DEV0001', 'POST', '/retries/6', { commentText: 'once more' }).body).toMatchObject({ deplStatus: 'U' })
    expect(call('DEV0001', 'POST', '/cancellations/6').body.reasonCode).toBe('53')
    later(JOB_MS)
    expect(status(6)).toBe('F')
    const events = call('DEV0001', 'GET', '/deploymentEvents', {}, { deplID: 6 }).body.events
    expect(events.slice(-2).map((e) => [e.eventType, e.jobNo])).toEqual([['T', 2], ['F', 2]])
  })

  it('continues past the failed job only with a reason, and succeeds when none is left', () => {
    expect(call('DEV0001', 'POST', '/continuations/6', {}).body.reasonCode).toBe('05')
    expect(call('DEV0001', 'POST', '/continuations/6', { commentText: 'RC 8 is fine here' }).body.deplStatus).toBe('S')
    const job2 = call('DEV0001', 'GET', '/deploymentJobs', {}, { deplID: 6 }).body.jobs[1]
    expect(job2).toMatchObject({ jobStatus: 'K', skipReason: 'RC 8 is fine here' })
  })

  it('cancels: jobs not run are skipped, and only the requester or a deployer may', () => {
    expect(call('APR0001', 'POST', '/cancellations/7').body.reasonCode).toBe('50')
    expect(call('DEV0001', 'POST', '/cancellations/7', { commentText: 'not now' }).body.deplStatus).toBe('C')
    expect(call('DEV0001', 'GET', '/deploymentJobs', {}, { deplID: 7 }).body.jobs.map((j) => j.jobStatus)).toEqual(['K', 'K'])
    expect(call('DEV0001', 'POST', '/cancellations/7').body.reasonCode).toBe('53')
    expect(call('DEV0002', 'POST', '/retries/4').body.reasonCode).toBe('53')
  })
})

it('checks timestamps as DB2 would', () => {
  expect(tsValid('2026-11-15-13.00.00.000000')).toBe(true)
  expect(tsValid('2026-02-30-13.00.00.000000')).toBe(false)
  expect(tsValid('2026-11-15 13:00')).toBe(false)
})

describe('approval', () => {
  const approve = (user, body) => call(user, 'POST', '/approvals', { deplID: 7, decision: 'A', ...body })
  const waiting = (user) => call(user, 'GET', '/approvalRequests').body.approvalRequests.map((x) => x.deplID)

  it('lists what waits for an approver, never the own request', () => {
    expect(waiting('APR0001')).toEqual([7])
    expect(waiting('DEV0002')).toEqual([7])
    expect(waiting('DEV0001')).toEqual([])
    expect(call('APR0001', 'GET', '/approvalRequests').body.approvalRequests[0])
      .toMatchObject({ appCode: 'DEMO', envCode: 'PRD', versionName: 'V1.0.0', approvedCount: 0, approvalCount: 2, requestedBy: 'DEV0001' })
  })

  it('starts the deployment at the second approval', () => {
    expect(approve('APR0001', { commentText: 'JCL ok' })).toMatchObject({ status: 201, body: { deplStatus: 'W', approvedCount: 1 } })
    expect(waiting('APR0001')).toEqual([])
    expect(approve('APR0001').body.reasonCode).toBe('55')
    expect(approve('DEV0002').body).toMatchObject({ deplStatus: 'U', approvedCount: 2 })
    const events = call('DEV0001', 'GET', '/deploymentEvents', {}, { deplID: 7 }).body.events.map((e) => e.eventType)
    expect(events).toEqual(['R', 'A', 'A', 'Q', 'U'])
    expect(call('DEV0001', 'GET', '/approvals', {}, { deplID: 7 }).body.approvals.map((a) => [a.userID, a.decision, a.commentText]))
      .toEqual([['APR0001', 'A', 'JCL ok'], ['DEV0002', 'A', '']])
  })

  it('rejects at the first rejection, which needs a comment', () => {
    expect(approve('APR0001', { decision: 'R' }).body.reasonCode).toBe('05')
    expect(approve('APR0001', { decision: 'R', commentText: 'Not this week' }).body.deplStatus).toBe('J')
    expect(call('DEV0001', 'GET', '/deploymentJobs', {}, { deplID: 7 }).body.jobs.map((j) => j.jobStatus)).toEqual(['K', 'K'])
    expect(approve('DEV0002').body.reasonCode).toBe('53')
  })

  it('refuses the requester, outsiders and a wrong decision', () => {
    // DEV0001 requested it, but isn't an approver at all: the group is checked first
    expect(approve('DEV0001').body.reasonCode).toBe('50')
    expect(approve('OWN0001').body.reasonCode).toBe('50')
    expect(approve('NOROLE1').body.reasonCode).toBe('01')
    expect(approve('APR0001', { decision: 'X' }).body.reasonCode).toBe('02')
  })
})

describe('GET /deploymentJcl', () => {
  it('sends the frozen JCL of a job as base64 of UTF-8', () => {
    const r = call('APR0001', 'GET', '/deploymentJcl/7', {}, { jobNo: 1 }).body
    const jcl = Buffer.from(r.jcl, 'base64').toString('utf8')
    expect(jcl).toContain('DSN=LWD.DEMO.V100.LOAD')
    expect(r.lineCount).toBe(jcl.split('\n').length)
    expect(call('APR0001', 'GET', '/deploymentJcl/7', {}, { jobNo: 9 }).status).toBe(404)
  })
})
