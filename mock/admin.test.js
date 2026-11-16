import { describe, expect, it } from 'vitest'
import { createDb } from './db.js'
import { dispatch } from './routes.js'
import { buildSeed } from './seed.js'

const fresh = () => createDb(buildSeed(new Date('2026-11-15T12:00:00')))
const call = (db, user, method, path, { query, body } = {}) => dispatch(db, { method, path, user, query, body })
const newApp = { appCode: 'web', appName: 'Web shop', accessGroup: 'lwdnew', ownerGroup: 'LWDOWN' }

describe('the administrator check', () => {
  it('refuses everyone else with 08 50', () => {
    const db = fresh()
    for (const [method, path] of [['GET', '/admin/applications'], ['POST', '/admin/applications'],
      ['GET', '/admin/applications/1'], ['DELETE', '/admin/applications/2'], ['PUT', '/admin/environmentControls/1'],
      ['GET', '/admin/refTables']]) {
      const r = call(db, 'OWN0001', method, path, { body: newApp, query: { tableID: 'RACFGRP' } })
      expect(r.status, `${method} ${path}`).toBe(403)
      expect(r.body.reasonCode).toBe('50')
    }
    expect(db.data.applications).toHaveLength(3)
  })
})

describe('applications (A1)', () => {
  it('lists every application with its groups, without roles', () => {
    const r = call(fresh(), 'ADMIN01', 'GET', '/admin/applications')
    expect(r.body.applications.map((a) => a.appCode)).toEqual(['DEMO', 'PAYR', 'HRAP'])
    expect(r.body.applications[2]).toEqual({ appID: 3, appCode: 'HRAP', appName: 'HR application', accessGroup: 'LWDHR', ownerGroup: 'LWDOWN' })
  })

  it('creates one with groups from the allowlist, in upper case', () => {
    const db = fresh()
    const r = call(db, 'ADMIN01', 'POST', '/admin/applications', { body: newApp })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ appID: 4, appCode: 'WEB', accessGroup: 'LWDNEW', createdBy: 'ADMIN01' })
    expect(call(db, 'ADMIN01', 'GET', '/admin/applications/4').body.appName).toBe('Web shop')
  })

  it('refuses a taken code, a bad code, a missing name and a group not in the allowlist', () => {
    const db = fresh()
    const refused = (body) => call(db, 'ADMIN01', 'POST', '/admin/applications', { body: { ...newApp, ...body } }).body
    expect(refused({ appCode: 'DEMO' })).toMatchObject({ reasonCode: '11' })
    expect(refused({ appCode: 'WEB-1' })).toMatchObject({ reasonCode: '02' })
    expect(refused({ appName: ' ' })).toMatchObject({ reasonCode: '01' })
    expect(refused({ ownerGroup: 'SYS1' })).toMatchObject({ reasonCode: '02', infoMessage: expect.stringContaining('SYS1') })
    expect(db.data.applications).toHaveLength(3)
  })

  it('updates one, and keeps its own code free', () => {
    const db = fresh()
    const r = call(db, 'ADMIN01', 'PUT', '/admin/applications/2', {
      body: { appCode: 'PAYR', appName: 'Payroll', accessGroup: 'LWDPAYR', ownerGroup: 'LWDNEW' },
    })
    expect(r.body).toMatchObject({ appName: 'Payroll', ownerGroup: 'LWDNEW', updatedBy: 'ADMIN01' })
    expect(call(db, 'ADMIN01', 'PUT', '/admin/applications/9', { body: newApp }).status).toBe(404)
  })

  it('deletes one without deployments with its environments, and refuses one with deployments', () => {
    const db = fresh()
    const refused = call(db, 'ADMIN01', 'DELETE', '/admin/applications/1')
    expect(refused.status).toBe(409)
    expect(refused.body.infoMessage).toMatch(/DEMO has 7 deployments/)
    expect(call(db, 'ADMIN01', 'DELETE', '/admin/applications/2').status).toBe(200)
    expect(db.data.applications.map((a) => a.appCode)).toEqual(['DEMO', 'HRAP'])
    expect(db.data.environments.some((e) => e.appID === 2)).toBe(false)
    expect(call(db, 'ADMIN01', 'DELETE', '/admin/applications/2').status).toBe(404)
  })
})

describe('environment controls (A2)', () => {
  const controls = { deployUser: 'LWDDEPP', approvalReq: 'Y', approverGroup: 'LWDAPR', approvalCount: 1, deployerGroup: '', execNode: 'n2' }

  it('sets them and answers the whole environment', () => {
    const db = fresh()
    const r = call(db, 'ADMIN01', 'PUT', '/admin/environmentControls/4', { body: controls })
    expect(r.body).toMatchObject({ envID: 4, envCode: 'DEV', deployUser: 'LWDDEPP', approvalReq: 'Y', approvalCount: 1, execNode: 'N2' })
    expect(call(db, 'DEV0001', 'GET', '/environments/4').body).toMatchObject({ approverGroup: 'LWDAPR', canDeploy: 'Y' })
  })

  it('stores no approval count without approval', () => {
    const db = fresh()
    call(db, 'ADMIN01', 'PUT', '/admin/environmentControls/4', { body: { ...controls, approvalReq: 'N', approvalCount: 3 } })
    expect(db.data.environments.find((e) => e.envID === 4)).toMatchObject({ approvalReq: 'N', approvalCount: 0 })
  })

  it('refuses userids and groups outside the allowlists, and approval without group or N', () => {
    const db = fresh()
    const refused = (body) => call(db, 'ADMIN01', 'PUT', '/admin/environmentControls/4', { body: { ...controls, ...body } }).body
    expect(refused({ deployUser: 'IBMUSER' }).reasonCode).toBe('02')
    expect(refused({ deployerGroup: 'SYS1' }).reasonCode).toBe('02')
    expect(refused({ approverGroup: '' }).infoMessage).toMatch(/approver group/)
    expect(refused({ approvalCount: 0 }).infoMessage).toMatch(/at least 1/)
    expect(refused({ execNode: 'TOOLONGNODE' }).reasonCode).toBe('02')
    expect(call(db, 'ADMIN01', 'PUT', '/admin/environmentControls/99', { body: controls }).status).toBe(404)
  })

  it('leaves deployments already requested as they were', () => {
    const db = fresh()
    call(db, 'ADMIN01', 'PUT', '/admin/environmentControls/3', { body: { ...controls, approvalCount: 1 } })
    expect(db.data.deployments.find((x) => x.deplID === 7)).toMatchObject({ approvalCount: 2, deployUser: 'LWDDEPL' })
  })
})

describe('GET /environments/{envID}', () => {
  it('shows the controls to whoever sees the application, and not found to others', () => {
    const db = fresh()
    expect(call(db, 'DEV0002', 'GET', '/environments/3').body).toMatchObject({ envCode: 'PRD', deployerGroup: 'LWDDPL', canApprove: 'Y' })
    expect(call(db, 'ADMIN01', 'GET', '/environments/5').status).toBe(200)
    expect(call(db, 'DEV0001', 'GET', '/environments/5').status).toBe(404)
  })
})

describe('allowlists', () => {
  it('lists one table by key', () => {
    const r = call(fresh(), 'ADMIN01', 'GET', '/admin/refTables', { query: { tableID: 'DEPLUSER' } })
    expect(r.body.refTables.map((x) => x.tabKey)).toEqual(['LWDDEPL', 'LWDDEPP'])
  })

  it('refuses a table that isn’t one', () => {
    expect(call(fresh(), 'ADMIN01', 'GET', '/admin/refTables', { query: { tableID: 'USERS' } }).body.reasonCode).toBe('02')
  })
})

describe('allowlist changes (A3)', () => {
  it('adds an entry in RACF form, once', () => {
    const db = fresh()
    const add = (body) => call(db, 'ADMIN01', 'POST', '/admin/refTables', { body })
    expect(add({ tableID: 'RACFGRP', tabKey: 'lwdops', tabValue: 'Operations' })).toMatchObject({ status: 201, body: { tabKey: 'LWDOPS' } })
    expect(add({ tableID: 'RACFGRP', tabKey: 'LWDOPS' }).body.reasonCode).toBe('11')
    expect(add({ tableID: 'RACFGRP', tabKey: '1GROUP' }).body.reasonCode).toBe('02')
    expect(add({ tableID: 'SETTINGS', tabKey: 'NEWKEY', tabValue: '1' }).body.reasonCode).toBe('50')
  })

  it('changes a description', () => {
    const db = fresh()
    const r = call(db, 'ADMIN01', 'PUT', '/admin/refTables/RACFGRP', { query: { tabKey: 'LWDNEW' }, body: { tabValue: 'Web team' } })
    expect(r.body).toMatchObject({ tabValue: 'Web team', updatedBy: 'ADMIN01' })
  })

  it('deletes an unused entry, and names a use otherwise', () => {
    const db = fresh()
    const del = (tableID, tabKey) => call(db, 'ADMIN01', 'DELETE', `/admin/refTables/${tableID}`, { query: { tabKey } })
    expect(del('RACFGRP', 'LWDNEW').status).toBe(200)
    expect(del('RACFGRP', 'LWDNEW').status).toBe(404)
    expect(del('RACFGRP', 'LWDHR').body.infoMessage).toBe('LWDHR is still used: access group of HRAP')
    expect(del('RACFGRP', 'LWDDPL').body.infoMessage).toBe('LWDDPL is still used: deployer group of DEMO PRD')
    expect(del('DEPLUSER', 'LWDDEPL').body.infoMessage).toBe('LWDDEPL is still used: deploy userid of DEMO DEV')
    expect(del('DEPLUSER', 'LWDDEPP').status).toBe(200)
    expect(del('SETTINGS', 'JOBMINS').body.reasonCode).toBe('50')
  })
})

describe('settings (A5)', () => {
  const put = (db, tabKey, tabValue) => call(db, 'ADMIN01', 'PUT', '/admin/refTables/SETTINGS', { query: { tabKey }, body: { tabValue } })

  it('changes an editable setting within its range', () => {
    const db = fresh()
    expect(put(db, 'JOBMINS', '60').body.tabValue).toBe('60')
    expect(put(db, 'JOBCLASS', 'b').body.tabValue).toBe('B')
    expect(put(db, 'JOBMINS', '4').body.infoMessage).toBe('JOBMINS: a whole number from 5 to 1440')
    expect(put(db, 'OUTLINES', '1e5').body.reasonCode).toBe('02')
    expect(put(db, 'MAILURL', 'lww.example.com').body.reasonCode).toBe('02')
  })

  it('refuses the settings from envs/<env>.yaml and the scheduler', () => {
    const db = fresh()
    for (const key of ['ADMINRES', 'GRPPRFX', 'LWDURL', 'LASTTICK']) expect(put(db, key, 'X').body.reasonCode).toBe('50')
    expect(put(db, 'NOSUCH', '1').status).toBe(404)
  })
})

describe('deployments of every application (A4)', () => {
  it('lists them all, with filters, for administrators only', () => {
    const db = fresh()
    const list = (query) => call(db, 'ADMIN01', 'GET', '/admin/deployments', { query }).body.deployments.map((x) => x.deplID)
    expect(list({})).toEqual([7, 6, 5, 4, 3, 2, 1])
    expect(list({ deplStatus_filter: 'F' })).toEqual([6])
    expect(list({ appID_filter: 2 })).toEqual([])
    expect(list({ requestedBy_filter: 'dev0001', deplID_since: 4 })).toEqual([3, 2, 1])
    expect(call(db, 'DEV0001', 'GET', '/admin/deployments').status).toBe(403)
  })
})

describe('mark a run stuck (A4)', () => {
  it('fails a submitted run whose result step never reports, with its job and deployment', () => {
    const now = new Date('2026-11-15T12:00:00')
    const clock = { now }
    const db = createDb(buildSeed(now), () => clock.now)
    const r = call(db, 'DEV0001', 'POST', '/deployments', { body: { appID: 1, envID: 2, versionID: 2, requestNote: 'Let it hang' } })
    expect(r.status).toBe(201)
    clock.now = new Date(now.getTime() + 60 * 60000)
    const run = () => db.data.jobRuns.find((x) => x.deplID === r.body.deplID)
    call(db, 'DEV0001', 'GET', '/me')
    expect(run().runStatus).toBe('S')
    expect(call(db, 'DEV0001', 'POST', `/admin/stuckRuns/${run().runID}`).status).toBe(403)
    const stuck = call(db, 'ADMIN01', 'POST', `/admin/stuckRuns/${run().runID}`)
    expect(stuck.body).toMatchObject({ runStatus: 'F', jobResult: 'T', deplStatus: 'F' })
    expect(run().jobMessage).toBe('Marked stuck by ADMIN01')
    expect(db.data.events.filter((x) => x.deplID === r.body.deplID).at(-1)).toMatchObject({ eventType: 'F', jobNo: 1, createdBy: 'ADMIN01' })
    expect(call(db, 'ADMIN01', 'POST', `/admin/stuckRuns/${run().runID}`).status).toBe(409)
  })

  it('refuses a run that has ended', () => {
    expect(call(fresh(), 'ADMIN01', 'POST', '/admin/stuckRuns/101').body.reasonCode).toBe('53')
  })
})
