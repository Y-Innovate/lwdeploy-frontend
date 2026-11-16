import { describe, expect, it } from 'vitest'
import { createDb } from './db.js'
import { dispatch } from './routes.js'
import { buildSeed } from './seed.js'
import { checkJcl, fillIn } from './templates.js'

const fresh = () => createDb(buildSeed(new Date('2026-11-15T12:00:00')))
const call = (db, user, method, path, { query, body } = {}) => dispatch(db, { method, path, user, query, body })
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
const unb64 = (s) => Buffer.from(s, 'base64').toString('utf8')
const save = (db, id, jcl, changeNote = 'test', user = 'OWN0001') =>
  call(db, user, 'POST', `/templateJcl/${id}`, { body: { jcl: b64(jcl), changeNote } })

describe('checkJcl (the checks of LWDM410)', () => {
  const refusal = (...lines) => checkJcl(lines, new Set()).refusal
  it('refuses a JOB statement, USER= and PASSWORD=, JES2 and JES3 statements, long lines and too many', () => {
    expect(refusal('//STEP EXEC PGM=X', '//LWD01 JOB (ACCT),CLASS=A')).toBe('Line 2: a JOB statement; LWD writes it')
    expect(refusal('//S EXEC PGM=X,USER=IBMUSER')).toMatch(/Line 1: USER=/)
    expect(refusal('//S EXEC PGM=X', '//  PASSWORD=SECRET')).toMatch(/Line 2/)
    expect(refusal('/*JOBPARM SYSAFF=SYSA')).toMatch(/JES2/)
    expect(refusal('//*MAIN CLASS=A')).toMatch(/JES3/)
    expect(refusal('x'.repeat(81))).toMatch(/longer than 80/)
    expect(refusal(...Array(301).fill('//* x'))).toMatch(/at most 300/)
    expect(refusal('', ' ')).toBe('The JCL is empty')
  })

  it('lets comments, in-stream data and USER in other words pass', () => {
    expect(refusal('//* A JOB statement is added by LWD', '//S EXEC PGM=X', '  USERID=X')).toBeUndefined()
  })

  it('warns about undefined variables and statements past column 71', () => {
    const { warnings } = checkJcl(['//S EXEC PGM=X,PARM=\'${LWDENV} ${NEWVAR} ${KNOWN}\'', `//${'X'.repeat(70)}`], new Set(['KNOWN']))
    expect(warnings).toEqual(['Line 1: ${NEWVAR} is defined at no level yet', 'Line 2: the statement passes column 71'])
  })
})

it('fills in variables and names the first without a value', () => {
  expect(fillIn(['A=${X},B=${Y}', '${Z}'], { X: '1', Y: '2' })).toEqual({ lines: ['A=1,B=2', '${Z}'], missing: 'Z' })
})

describe('templates (O2)', () => {
  it('lists the active ones in order for members', () => {
    const r = call(fresh(), 'DEV0001', 'GET', '/templates', { query: { appID: 1 } })
    expect(r.body.templates.map((x) => [x.templateName, x.currentRev])).toEqual([['Copy load modules', 3], ['Refresh CICS', 2]])
  })

  it('adds one without JCL, which deployments refuse until it has some', () => {
    const db = fresh()
    const r = call(db, 'OWN0001', 'POST', '/templates', { body: { appID: 1, templateName: 'Smoke test', maxRC: 0 } })
    expect(r.body).toMatchObject({ templateID: 3, sortOrder: 3, currentRev: 0, templateStatus: 'A' })
    const dep = () => call(db, 'DEV0001', 'POST', '/deployments', { body: { appID: 1, envID: 2, versionID: 2 } }).body
    expect(dep()).toMatchObject({ reasonCode: '59', infoMessage: 'Template Smoke test has no JCL yet' })
    expect(save(db, 3, '//SMOKE EXEC PGM=IEFBR14').status).toBe(201)
    expect(dep().retCode).toBe('00')
  })

  it('changes name, order and highest RC, and deletes as status D, keeping the revisions readable', () => {
    const db = fresh()
    expect(call(db, 'OWN0001', 'PUT', '/templates/2', { body: { templateName: 'Refresh', sortOrder: 0, maxRC: 8 } }).body)
      .toMatchObject({ templateName: 'Refresh', sortOrder: 2, maxRC: 8 })
    expect(call(db, 'OWN0001', 'PUT', '/templates/2', { body: { templateName: 'x', maxRC: -1 } }).body.reasonCode).toBe('02')
    expect(call(db, 'OWN0001', 'DELETE', '/templates/2').status).toBe(200)
    expect(call(db, 'DEV0001', 'GET', '/templates', { query: { appID: 1 } }).body.templates).toHaveLength(1)
    expect(call(db, 'DEV0001', 'GET', '/templates/2').body.templateStatus).toBe('D')
    expect(call(db, 'DEV0001', 'GET', '/templateJcl/2', { query: { revision: 1 } }).body.lineCount).toBe(7)
    expect(call(db, 'OWN0001', 'PUT', '/templates/2', { body: { templateName: 'x' } }).body.reasonCode).toBe('53')
  })

  it('lets only owners change', () => {
    const db = fresh()
    expect(call(db, 'DEV0001', 'POST', '/templates', { body: { appID: 1, templateName: 'x' } }).body.reasonCode).toBe('50')
    expect(save(db, 1, '//S EXEC PGM=X', '', 'DEV0001').body.reasonCode).toBe('50')
  })
})

describe('revisions and JCL', () => {
  it('lists the revisions newest first, and gives the JCL of one, 0 being the current', () => {
    const db = fresh()
    const revs = call(db, 'DEV0001', 'GET', '/templateRevisions', { query: { templateID: 1 } }).body.revisions
    expect(revs.map((r) => [r.revision, r.changeNote])).toEqual([[3, 'Replace members'], [2, 'Target library from a variable'], [1, 'First version']])
    const current = call(db, 'DEV0001', 'GET', '/templateJcl/1').body
    expect(current).toMatchObject({ revision: 3, lineCount: 8 })
    expect(unb64(current.jcl)).toContain('COPY INDD=((IN,R)),OUTDD=OUT')
    expect(unb64(call(db, 'DEV0001', 'GET', '/templateJcl/1', { query: { revision: 1 } }).body.jcl)).toContain('DSN=LWD.DEMO.LOAD')
    expect(call(db, 'DEV0001', 'GET', '/templateJcl/1', { query: { revision: 9 } }).status).toBe(404)
  })

  it('saves a new revision, drops CR, and answers the warnings', () => {
    const db = fresh()
    const r = save(db, 1, '//COPY EXEC PGM=IEBCOPY\r\n//OUT DD DSN=${NEWLIB},DISP=SHR\r\n', 'New library')
    expect(r.body).toMatchObject({ revision: 4, lineCount: 2, warningCount: 1, infoMessage: 'Line 2: ${NEWLIB} is defined at no level yet' })
    expect(db.data.templates.find((x) => x.templateID === 1).currentRev).toBe(4)
    expect(unb64(call(db, 'DEV0001', 'GET', '/templateJcl/1').body.jcl)).toBe('//COPY EXEC PGM=IEBCOPY\n//OUT DD DSN=${NEWLIB},DISP=SHR')
  })

  it('refuses JCL that breaks the rules with 08 56, and bad form fields with 08 58', () => {
    const db = fresh()
    expect(save(db, 1, '//LWD JOB 1').body).toMatchObject({ reasonCode: '56', infoMessage: 'Line 1: a JOB statement; LWD writes it' })
    expect(call(db, 'OWN0001', 'POST', '/templateJcl/1', { body: { changeNote: 'x' } }).body.reasonCode).toBe('58')
    expect(call(db, 'OWN0001', 'POST', '/templateJcl/1', { body: { jcl: 'not base64!' } }).body.reasonCode).toBe('58')
    expect(call(db, 'OWN0001', 'POST', '/templateJcl/1', { body: { jcl: [b64('//S EXEC PGM=X')] } }).status).toBe(201)
    expect(db.data.templates.find((x) => x.templateID === 1).currentRev).toBe(4)
  })
})

describe('frozen JCL of a new deployment', () => {
  const jclOf = (db, deplID, jobNo) => unb64(call(db, 'DEV0001', 'GET', `/deploymentJcl/${deplID}`, { query: { jobNo } }).body.jcl)

  it('is the current revision with the variables filled in, the environment overriding the application', () => {
    const db = fresh()
    const r = call(db, 'DEV0001', 'POST', '/deployments', { body: { appID: 1, envID: 2, versionID: 2 } })
    expect(r.status).toBe(201)
    expect(jclOf(db, r.body.deplID, 1)).toContain('//IN       DD DISP=SHR,DSN=LWD.DEMO.V100.LOAD')
    expect(jclOf(db, r.body.deplID, 1)).toContain('DSN=LWD.DEMO.LOAD')
    expect(jclOf(db, r.body.deplID, 2)).toContain('LIST GROUP(DEMO)')
    expect(jclOf(db, r.body.deplID, 2)).toContain('Refresh the CICS definitions of DEMO in TST')
  })

  it('refuses 08 57 for a variable without a value', () => {
    const db = fresh()
    save(db, 2, '//S EXEC PGM=X,PARM=\'${NOWHERE}\'')
    expect(call(db, 'DEV0001', 'POST', '/deployments', { body: { appID: 1, envID: 2, versionID: 2 } }).body)
      .toMatchObject({ reasonCode: '57', infoMessage: expect.stringContaining('NOWHERE') })
  })
})
