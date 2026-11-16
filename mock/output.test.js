import { beforeEach, describe, expect, it } from 'vitest'
import { createDb } from './db.js'
import { COLLECT_MS, JOB_MS } from './deployments.js'
import { dispatch } from './routes.js'
import { buildSeed } from './seed.js'

let clock, db
beforeEach(() => {
  clock = { now: new Date('2026-11-15T12:00:00') }
  db = createDb(buildSeed(clock.now), () => clock.now)
})
const get = (user, path, query = {}) => dispatch(db, { method: 'GET', path, user, query })
const lastRun = (deplID, jobNo) => get('DEV0001', '/jobRuns', { deplID, jobNo }).body.runs[0]
const text = (b64) => Buffer.from(b64, 'base64').toString('utf8')

describe('runs', () => {
  it('lists the runs of a job newest first, so the failed one stays readable after a retry', () => {
    dispatch(db, { method: 'POST', path: '/retries/6', user: 'DEV0001', body: {} })
    const runs = get('DEV0001', '/jobRuns', { deplID: 6, jobNo: 2 }).body.runs
    expect(runs.map((r) => [r.runStatus, r.jobResult, r.outputStatus])).toEqual([['S', '', 'W'], ['E', 'H', 'C']])
    expect(runs[0].jobRC).toBe(-1)
  })

  it('collects the output a while after the job ended', () => {
    dispatch(db, { method: 'POST', path: '/retries/6', user: 'DEV0001', body: {} })
    clock.now = new Date(clock.now.getTime() + JOB_MS)
    expect(lastRun(6, 2)).toMatchObject({ runStatus: 'E', outputStatus: 'W' })
    expect(get('DEV0001', '/spoolFiles', { runID: lastRun(6, 2).runID }).body.spoolFiles).toEqual([])
    clock.now = new Date(clock.now.getTime() + COLLECT_MS)
    expect(lastRun(6, 2).outputStatus).toBe('C')
  })

  it('is not found without a role', () => {
    expect(get('NOROLE1', '/jobRuns', { deplID: 6, jobNo: 2 }).status).toBe(404)
    expect(get('NOROLE1', '/jobSteps', { runID: lastRun(6, 2).runID }).status).toBe(404)
  })
})

describe('steps and spool files', () => {
  it('has the step of the template and the result step that ran', () => {
    const steps = get('DEV0001', '/jobSteps', { runID: lastRun(6, 2).runID }).body.steps
    expect(steps.map((s) => [s.stepName, s.stepRC, s.flushed])).toEqual([
      ['REFRESH', 8, 'N'], ['LWDRSO', -1, 'Y'], ['LWDRSH', 0, 'N'], ['LWDRSA', -1, 'Y'],
    ])
  })

  it('lists the spool files in spool order with their sizes', () => {
    const files = get('DEV0001', '/spoolFiles', { runID: lastRun(6, 1).runID }).body.spoolFiles
    expect(files.map((f) => f.ddName)).toEqual(['JESMSGLG', 'JESJCL', 'JESYSMSG', 'SYSPRINT', 'SYSTSPRT'])
    expect(files[3]).toMatchObject({ stepName: 'COPY', lineCount: 644, truncated: 'N' })
  })
})

describe('GET /spoolText', () => {
  it('pages a long file within 300 lines and 24000 bytes, as base64 of UTF-8', () => {
    const runID = lastRun(6, 1).runID
    const lines = []
    let since = 0
    let part
    do {
      part = get('DEV0001', `/spoolText/${runID}`, { fileNo: 4, lineNum_since: since }).body
      const got = text(part.spoolText)
      expect(part.firstLineNum).toBe(since + 1)
      expect(part.lineCount).toBeLessThanOrEqual(300)
      expect(Buffer.byteLength(got, 'utf8')).toBeLessThanOrEqual(24000)
      expect(got.split('\n')).toHaveLength(part.lineCount)
      lines.push(...got.split('\n'))
      since = part.firstLineNum + part.lineCount - 1
    } while (part.moreLines === 'Y')
    expect(lines).toHaveLength(644)
    expect(lines[0]).toMatch(/^IEBCOPY MESSAGES/)
    expect(lines.at(-1)).toMatch(/WAS HIGHEST SEVERITY CODE$/)
  })

  it('is not found for a file that is not there', () => {
    expect(get('DEV0001', `/spoolText/${lastRun(6, 1).runID}`, { fileNo: 9 }).status).toBe(404)
  })
})
