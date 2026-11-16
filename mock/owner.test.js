import { describe, expect, it } from 'vitest'
import { createDb } from './db.js'
import { dispatch } from './routes.js'
import { buildSeed } from './seed.js'

const fresh = () => createDb(buildSeed(new Date('2026-11-15T12:00:00')))
const call = (db, user, method, path, { query, body } = {}) => dispatch(db, { method, path, user, query, body })

describe('who may change', () => {
  it('refuses members and administrators who aren’t owners with 08 50, and others with 04 01', () => {
    const db = fresh()
    const body = { appID: 1, envCode: 'QA', envName: 'QA' }
    expect(call(db, 'DEV0001', 'POST', '/environments', { body }).body.reasonCode).toBe('50')
    expect(call(db, 'ADMIN01', 'POST', '/environments', { body }).body.reasonCode).toBe('50')
    expect(call(db, 'NOROLE1', 'POST', '/environments', { body }).status).toBe(404)
    expect(call(db, 'DEV0001', 'DELETE', '/variables/1').body.reasonCode).toBe('50')
    expect(call(db, 'NOROLE1', 'PUT', '/versions/3', { body: {} }).status).toBe(404)
  })
})

describe('environments (O1)', () => {
  it('adds one at the end with the protected defaults', () => {
    const db = fresh()
    const r = call(db, 'OWN0001', 'POST', '/environments', { body: { appID: 1, envCode: 'acc', envName: 'Acceptance', promoGate: 'Y' } })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ envCode: 'ACC', sortOrder: 4, approvalReq: 'Y', approvalCount: 1, approverGroup: '', deployUser: '', canDeploy: 'N' })
  })

  it('refuses a taken code and a 21st environment', () => {
    const db = fresh()
    expect(call(db, 'OWN0001', 'POST', '/environments', { body: { appID: 1, envCode: 'TST', envName: 'x' } }).body.reasonCode).toBe('11')
    for (let i = 0; i < 19; i++) call(db, 'OWN0001', 'POST', '/environments', { body: { appID: 3, envCode: `E${i}`, envName: 'x' } })
    const r = call(db, 'OWN0001', 'POST', '/environments', { body: { appID: 3, envCode: 'ONEMORE', envName: 'x' } })
    expect(r.body).toMatchObject({ reasonCode: '53', infoMessage: expect.stringContaining('20 environments') })
  })

  it('changes name, order and gate, never the controls', () => {
    const db = fresh()
    const r = call(db, 'OWN0001', 'PUT', '/environments/2', {
      body: { envCode: 'TST', envName: 'Test 2', sortOrder: 5, promoGate: 'N', deployUser: 'IBMUSER', approvalReq: 'Y' },
    })
    expect(r.body).toMatchObject({ envName: 'Test 2', sortOrder: 5, promoGate: 'N', deployUser: 'LWDDEPL', approvalReq: 'N' })
  })

  it('deletes one without deployments with its variables, and refuses one with', () => {
    const db = fresh()
    expect(call(db, 'OWN0001', 'DELETE', '/environments/3').body.infoMessage).toMatch(/PRD has 2 deployments/)
    const e = call(db, 'OWN0001', 'POST', '/environments', { body: { appID: 1, envCode: 'ACC', envName: 'Acceptance' } }).body
    call(db, 'OWN0001', 'POST', '/variables', { body: { appID: 1, envID: e.envID, varName: 'X', varValue: '1' } })
    expect(call(db, 'OWN0001', 'DELETE', `/environments/${e.envID}`).status).toBe(200)
    expect(db.data.variables.some((x) => x.envID === e.envID)).toBe(false)
  })
})

describe('versions (O4)', () => {
  const v = { appID: 1, versionName: 'v1.1.0', locType: 'D', location: 'lwd.demo.v110' }

  it('registers one, as CI does, with the checks of LWDM405', () => {
    const db = fresh()
    const r = call(db, 'OWN0001', 'POST', '/versions', { body: v })
    expect(r.body).toMatchObject({ versionName: 'V1.1.0', location: 'LWD.DEMO.V110', versionStatus: 'A', isUsed: 'N' })
    expect(call(db, 'OWN0001', 'POST', '/versions', { body: v }).body.reasonCode).toBe('11')
    expect(call(db, 'OWN0001', 'POST', '/versions', { body: { ...v, versionName: 'V 2' } }).body.reasonCode).toBe('01')
    expect(call(db, 'OWN0001', 'POST', '/versions', { body: { ...v, versionName: 'V2', locType: 'X' } }).body.reasonCode).toBe('02')
    expect(call(db, 'OWN0001', 'POST', '/versions', { body: { ...v, versionName: 'V2', locType: 'U', location: 'rel' } }).body.reasonCode).toBe('03')
  })

  it('changes and deletes a version only while it was never requested', () => {
    const db = fresh()
    const id = call(db, 'OWN0001', 'POST', '/versions', { body: v }).body.versionID
    expect(call(db, 'OWN0001', 'PUT', `/versions/${id}`, { body: { ...v, versionDescription: 'Fixes' } }).body.versionDescription).toBe('Fixes')
    expect(call(db, 'OWN0001', 'PUT', '/versions/2', { body: { ...v, versionName: 'V1.0.0' } }).body.reasonCode).toBe('53')
    expect(call(db, 'OWN0001', 'DELETE', '/versions/2').body.infoMessage).toMatch(/retire it instead/)
    expect(call(db, 'OWN0001', 'DELETE', `/versions/${id}`).status).toBe(200)
  })

  it('retires a version once, and shows one to members', () => {
    const db = fresh()
    expect(call(db, 'OWN0001', 'POST', '/versionRetirements/3').body.versionStatus).toBe('R')
    expect(call(db, 'OWN0001', 'POST', '/versionRetirements/3').body.reasonCode).toBe('53')
    expect(call(db, 'DEV0001', 'GET', '/versions/3').body).toMatchObject({ versionName: 'V1.0.1-BAD', isUsed: 'Y' })
  })
})

describe('variables (O1, O3, O4)', () => {
  const names = (db, query) => call(db, 'DEV0001', 'GET', '/variables', { query }).body.variables.map((x) => x.varName)

  it('lists one level for members', () => {
    const db = fresh()
    expect(names(db, { appID: 1 })).toEqual(['TARGETLIB', 'CICSHLQ'])
    expect(names(db, { appID: 1, envID: 3 })).toEqual(['TARGETLIB'])
    expect(names(db, { appID: 1, versionID: 2 })).toEqual(['CHGNR'])
    expect(call(db, 'DEV0001', 'GET', '/variables', { query: { appID: 1, envID: 3, versionID: 2 } }).body.reasonCode).toBe('02')
    expect(call(db, 'DEV0001', 'GET', '/variables', { query: { appID: 1, envID: 4 } }).body.reasonCode).toBe('13')
  })

  it('adds, changes and deletes, with the name rules and once per level', () => {
    const db = fresh()
    const add = (body) => call(db, 'OWN0001', 'POST', '/variables', { body: { appID: 1, varValue: 'x', ...body } })
    const r = add({ envID: 1, varName: 'targetlib', varValue: 'LWD.DEMO.DEV.LOAD' })
    expect(r.body).toMatchObject({ varName: 'TARGETLIB', envID: 1, versionID: 0 })
    expect(add({ envID: 1, varName: 'TARGETLIB' }).body.reasonCode).toBe('11')
    expect(add({ varName: 'LWDAPP' }).body.infoMessage).toMatch(/LWD/)
    expect(add({ varName: '1ST' }).body.reasonCode).toBe('02')
    expect(add({ varName: 'A_VERY_LONG_NAME_X' }).body.reasonCode).toBe('02')
    expect(call(db, 'OWN0001', 'PUT', `/variables/${r.body.varID}`, { body: { varName: 'TARGETLIB', varValue: 'NEW' } }).body.varValue).toBe('NEW')
    expect(call(db, 'OWN0001', 'PUT', '/variables/2', { body: { varName: 'TARGETLIB', varValue: 'x' } }).body.reasonCode).toBe('11')
    expect(call(db, 'OWN0001', 'DELETE', `/variables/${r.body.varID}`).status).toBe(200)
  })
})
