import { describe, expect, it } from 'vitest'
import { createDb, httpStatus } from './db.js'
import { dispatch, NO_SESSION } from './routes.js'
import { buildSeed } from './seed.js'

const fresh = () => createDb(buildSeed(new Date('2026-11-15T12:00:00')))

describe('sessions', () => {
  it('signs in any well-formed userid, unless the passphrase starts with wrong', () => {
    const db = fresh()
    const token = db.signIn('dev0001', 'any passphrase')
    expect(db.userOf(token)).toBe('DEV0001')
    expect(db.signIn('DEV0001', 'wrong one')).toBeNull()
    expect(db.signIn('DEV0001', '')).toBeNull()
    expect(db.signIn('TOOLONGID', 'x')).toBeNull()
    db.signOut(token)
    expect(db.userOf(token)).toBeNull()
  })

  it('maps Entra to the administrator', () => {
    const db = fresh()
    expect(db.userOf(db.signInEntra())).toBe('ADMIN01')
  })
})

describe('GET /me', () => {
  const me = (db, user) => dispatch(db, { method: 'GET', path: '/me', user }).body

  it('answers 404 without a session, as LWW does', () => {
    expect(dispatch(fresh(), { method: 'GET', path: '/me', user: null })).toEqual(NO_SESSION)
  })

  it('counts the approvals waiting, but never the own request', () => {
    const db = fresh()
    expect(me(db, 'DEV0002')).toMatchObject({ userID: 'DEV0002', isAdmin: 'N', approvalsWaiting: 1 })
    expect(me(db, 'APR0001').approvalsWaiting).toBe(1)
    // DEV0001 requested the PRD deployment and isn't an approver anyway
    expect(me(db, 'DEV0001').approvalsWaiting).toBe(0)
  })

  it('knows the administrator', () => {
    expect(me(fresh(), 'ADMIN01')).toMatchObject({ isAdmin: 'Y', approvalsWaiting: 0 })
  })

  it('creates the user row of a new userid', () => {
    const db = fresh()
    expect(me(db, 'NEW0001')).toMatchObject({ userID: 'NEW0001', email: '' })
    expect(db.data.users.some((u) => u.userID === 'NEW0001')).toBe(true)
  })
})

it('answers an unknown path with the backend envelope', () => {
  expect(dispatch(fresh(), { method: 'GET', path: '/nothing', user: 'DEV0001' }).status).toBe(404)
})

it('maps reason codes to HTTP status as the wrappers do', () => {
  expect(httpStatus('00', '00')).toBe(200)
  expect(httpStatus('04', '01')).toBe(404)
  expect(httpStatus('08', '01')).toBe(400)
  expect(httpStatus('08', '50')).toBe(403)
  expect(httpStatus('08', '53')).toBe(409)
  expect(httpStatus('08', '54')).toBe(409)
  expect(httpStatus('08', '55')).toBe(403)
  expect(httpStatus('08', '57')).toBe(400)
  expect(httpStatus('08', '59')).toBe(409)
  expect(httpStatus('08', '12')).toBe(500)
})

describe('seed', () => {
  it('has the DEMO application of t01 with three environments in order', () => {
    const d = fresh().data
    const demo = d.applications.find((a) => a.appCode === 'DEMO')
    expect(d.environments.filter((e) => e.appID === demo.appID).map((e) => e.envCode)).toEqual(['DEV', 'TST', 'PRD'])
  })

  it('gives every deployment a job per template, with frozen JCL', () => {
    const d = fresh().data
    for (const dp of d.deployments) {
      const jobs = d.deplJobs.filter((j) => j.deplID === dp.deplID)
      expect(jobs).toHaveLength(d.templates.filter((t) => t.appID === dp.appID).length)
      for (const j of jobs) {
        expect(j.jcl).toMatch(/^\/\/\* /)
        // No JOB statement: LWDM920 adds it at submission
        expect(j.jcl).not.toMatch(/ JOB /)
      }
    }
  })
})

describe('applications and environments', () => {
  const call = (db, user, path, query = {}) => dispatch(db, { method: 'GET', path, user, query })

  it('lists only the applications with a role, with the roles', () => {
    const db = fresh()
    expect(call(db, 'DEV0001', '/applications').body.applications.map((a) => a.appCode)).toEqual(['DEMO', 'PAYR'])
    expect(call(db, 'APR0001', '/applications').body.applications)
      .toEqual([expect.objectContaining({ appCode: 'DEMO', isMember: 'N', isOwner: 'N', isApprover: 'Y' })])
    expect(call(db, 'OWN0001', '/applications').body.applications.map((a) => [a.appCode, a.isOwner]))
      .toEqual([['DEMO', 'Y'], ['PAYR', 'Y'], ['HRAP', 'Y']])
    expect(call(db, 'NOROLE1', '/applications').body.applications).toEqual([])
  })

  it('hides an application without a role as not found', () => {
    const db = fresh()
    expect(call(db, 'DEV0001', '/applications/3').status).toBe(404)
    expect(call(db, 'DEV0001', '/environments', { appID: 3 }).body.reasonCode).toBe('01')
    expect(call(db, 'DEV0001', '/applications/1').body).toMatchObject({ appCode: 'DEMO', isMember: 'Y' })
  })

  it('keeps the inventory: current version, half deployed, the holding deployment', () => {
    const envs = call(fresh(), 'DEV0001', '/environments', { appID: 1 }).body.environments
    const [dev, tst, prd] = envs
    expect(dev).toMatchObject({ envCode: 'DEV', currentVersionName: 'V1.0.0', envState: 'H', activeDeplID: 6 })
    expect(tst).toMatchObject({ currentVersionName: 'V1.0.0', envState: 'O', activeDeplID: 0 })
    expect(prd).toMatchObject({ currentVersionName: 'V0.9.0', approvalReq: 'Y', approvalCount: 2 })
  })

  it('lets deploy only members, and in PRD only its deployer group', () => {
    const can = (user) => call(fresh(), user, '/environments', { appID: 1 }).body.environments.map((e) => e.canDeploy).join('')
    expect(can('DEV0001')).toBe('YYY')
    expect(can('DEV0002')).toBe('YYN')
    expect(can('APR0001')).toBe('NNN')
  })

  it('lists versions newest first, with a status filter', () => {
    const db = fresh()
    expect(call(db, 'DEV0001', '/versions', { appID: 1 }).body.versions.map((v) => v.versionName))
      .toEqual(['V1.0.1-BAD', 'V1.0.0', 'V0.9.0'])
    expect(call(db, 'DEV0001', '/versions', { appID: 1, versionStatus_filter: 'A' }).body.versions).toHaveLength(2)
  })
})

describe('GET /deployments', () => {
  const list = (db, user, query) => dispatch(db, { method: 'GET', path: '/deployments', user, query })

  it('lists all of an application for a member, newest first, with filters', () => {
    const db = fresh()
    expect(list(db, 'DEV0002', { appID: 1 }).body.deployments.map((x) => x.deplID)).toEqual([7, 6, 5, 4, 3, 2, 1])
    expect(list(db, 'DEV0002', { appID: 1, envID_filter: 1 }).body.deployments.map((x) => x.deplID)).toEqual([6, 4, 1])
    expect(list(db, 'DEV0002', { appID: 1, deplStatus_filter: 'F' }).body.deployments.map((x) => x.deplID)).toEqual([6])
    expect(list(db, 'DEV0002', { appID: 1, deplID_since: 4 }).body.deployments.map((x) => x.deplID)).toEqual([3, 2, 1])
  })

  it('shows an approver without other roles only what they decided', () => {
    expect(list(fresh(), 'APR0001', { appID: 1 }).body.deployments.map((x) => x.deplID)).toEqual([3])
  })

  it('lists the own requests across applications, and refuses anything else without appID', () => {
    const db = fresh()
    expect(list(db, 'DEV0001', { requestedBy_filter: 'DEV0001' }).body.deployments).toHaveLength(7)
    expect(list(db, 'DEV0002', { requestedBy_filter: 'DEV0002' }).body.deployments).toEqual([])
    expect(list(db, 'DEV0001', {}).status).toBe(400)
    expect(list(db, 'DEV0002', { requestedBy_filter: 'DEV0001' }).body.reasonCode).toBe('01')
  })

  it('filters the own requests on deployment, and on application, environment and version text', () => {
    const db = fresh()
    const ids = (query) => list(db, 'DEV0001', { requestedBy_filter: 'DEV0001', ...query }).body.deployments.map((x) => x.deplID)
    expect(ids({ deplID_filter: 5 })).toEqual([5])
    expect(ids({ appCode_filter: 'dem' })).toHaveLength(7)
    expect(ids({ appCode_filter: 'PAY' })).toEqual([])
    expect(ids({ envCode_filter: 'ev' })).toEqual([6, 4, 1])
    expect(ids({ versionName_filter: '0.9' })).toEqual([3, 2, 1])
    expect(ids({ versionName_filter: 'bad', envCode_filter: 'DEV' })).toEqual([6])
  })

  it('sends the fields of the list', () => {
    expect(list(fresh(), 'DEV0001', { appID: 1 }).body.deployments[0]).toMatchObject({
      deplID: 7, appCode: 'DEMO', envCode: 'PRD', versionName: 'V1.0.0', deplStatus: 'W', requestedBy: 'DEV0001',
    })
  })
})

describe('administrators and the user paths', () => {
  const call = (db, user, path, query = {}) => dispatch(db, { method: 'GET', path, user, query })

  it('lets an administrator open any application and its history, but not list it as theirs', () => {
    const db = fresh()
    expect(call(db, 'ADMIN01', '/applications').body.applications).toEqual([])
    expect(call(db, 'ADMIN01', '/applications/3').status).toBe(200)
    expect(call(db, 'ADMIN01', '/deployments', { appID: 1 }).body.deployments).toHaveLength(7)
  })

  it('refuses a status filter that is not a status', () => {
    expect(call(fresh(), 'DEV0001', '/deployments', { appID: 1, deplStatus_filter: 'X' }).body.reasonCode).toBe('03')
  })
})

describe('PUT /me (U2)', () => {
  it('changes the own notification settings, and nothing else', () => {
    const db = fresh()
    const r = dispatch(db, { method: 'PUT', path: '/me', user: 'DEV0001',
      body: { notifyApprove: 'n', notifyOwn: 'Y', notifyApp: 'Y', email: 'other@example.com' } })
    expect(r.body).toMatchObject({ userID: 'DEV0001', notifyApprove: 'N', notifyOwn: 'Y', notifyApp: 'Y', email: 'dev0001@example.com' })
    expect(db.data.users.find((u) => u.userID === 'DEV0002').notifyApp).toBe('N')
  })

  it('refuses a value other than Y or N, or a missing one', () => {
    const db = fresh()
    const put = (body) => dispatch(db, { method: 'PUT', path: '/me', user: 'DEV0001', body }).body
    expect(put({ notifyApprove: 'X', notifyOwn: 'Y', notifyApp: 'N' })).toMatchObject({ reasonCode: '02', infoMessage: 'notifyApprove: Y or N' })
    expect(put({ notifyApprove: 'Y', notifyOwn: 'Y' }).reasonCode).toBe('02')
    expect(db.data.users.find((u) => u.userID === 'DEV0001').notifyApprove).toBe('Y')
  })
})
