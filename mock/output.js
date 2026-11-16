// Job output for the mock: the steps and spool files the output collector
// (LWDM945) would have stored for a run, made up from the run itself, and
// the operations GET /jobRuns (LWDM214), GET /jobSteps (LWDM215),
// GET /spoolFiles (LWDM216) and GET /spoolText/{runID} (LWDM317).
// Job 1 (IEBCOPY) has a long SYSPRINT, so paging through it can be tried.
import { int, ok, refuse } from './util.js'

export const TEXT_LINES = 300
export const TEXT_BYTES = 24000

// The steps of a run as JESYSMSG names them: the template's step, then the
// result steps under IF tests, of which one runs (lwdeploy/docs/07-iteration-3.md)
export function stepsOf(r) {
  const main = r.jobNo === 1 ? 'COPY' : 'REFRESH'
  const rc = r.jobRC < 0 ? 0 : r.jobRC
  const ran = { O: 'LWDRSO', H: 'LWDRSH', A: 'LWDRSA' }[r.jobResult]
  const step = (stepNo, stepName, stepRC, flushed) =>
    ({ stepNo, stepName, procStep: '', pgmName: '', stepRC: flushed ? -1 : stepRC, abendCode: '', flushed: flushed ? 'Y' : 'N' })
  return [
    step(1, main, rc, false),
    ...['LWDRSO', 'LWDRSH', 'LWDRSA'].map((name, i) => step(i + 2, name, 0, name !== ran)),
  ]
}

const pad = (s, n) => String(s).padEnd(n)

// The spool files with their lines, in spool order
export function filesOf(r) {
  const steps = stepsOf(r)
  const time = r.submittedDate.slice(11, 19).replaceAll('.', ':')
  const msglg = [
    `${time} ${r.jesJobID}  ---- ${r.submittedDate.slice(0, 10)} ----`,
    `${time} ${r.jesJobID}  IRR010I  USERID LWDDEPL  IS ASSIGNED TO THIS JOB.`,
    `${time} ${r.jesJobID}  $HASP373 ${pad(r.jobName, 8)} STARTED - INIT 1    - CLASS A        - SYS T01`,
    ...steps.filter((s) => s.flushed === 'N').map((s) =>
      `${time} ${r.jesJobID}  IEF403I ${pad(r.jobName, 8)} - STEP ${pad(s.stepName, 8)} RC=${String(s.stepRC).padStart(4, '0')}`),
    `${time} ${r.jesJobID}  $HASP395 ${pad(r.jobName, 8)} ENDED - RC=${String(Math.max(r.jobRC, 0)).padStart(4, '0')}`,
  ]
  const jcl = [
    `        1 //${pad(r.jobName, 8)} JOB (ACCT),'LWD',CLASS=A,MSGCLASS=X,USER=LWDDEPL`,
    `        2 //${pad(steps[0].stepName, 8)} EXEC PGM=${r.jobNo === 1 ? 'IEBCOPY' : 'DFHCSDUP'}`,
    `        3 //SYSPRINT DD SYSOUT=*`,
    `        4 //LWDRSO   EXEC PGM=IKJEFT1B,PARM='%LWDR916 ${r.runID} O'`,
  ]
  const sysmsg = steps.map((s) => (s.flushed === 'Y'
    ? `IEF202I ${r.jobName} ${s.stepName} - STEP WAS NOT RUN BECAUSE OF CONDITION CODES`
    : `IEF142I ${r.jobName} ${s.stepName} - STEP WAS EXECUTED - COND CODE ${String(s.stepRC).padStart(4, '0')}`))
  const sysprint = r.jobNo === 1
    ? [
        'IEBCOPY MESSAGES AND CONTROL STATEMENTS                                PAGE 1',
        '  COPY INDD=IN,OUTDD=OUT',
        ...Array.from({ length: 640 }, (_, i) => `IEB167I FOLLOWING MEMBER(S) LOADED FROM INPUT DATA SET REFERENCED BY IN      MEMBER DEMO${String(i + 1).padStart(4, '0')}`),
        `IEB144I THERE ARE 1200 UNUSED TRACKS IN OUTPUT DATA SET REFERENCED BY OUT`,
        `IEB147I END OF JOB - ${r.jobRC} WAS HIGHEST SEVERITY CODE`,
      ]
    : [
        'DFH5120 I PRIMARY CSD OPENED; DDNAME: DFHCSD',
        'DFH5104 I SYSIN  LIST GROUP(DEMO)',
        ...(r.jobRC > 4 ? ['DFH5178 E GROUP DEMO IS LOCKED BY ANOTHER USER', 'DFH5109 I END OF DFHCSDUP UTILITY JOB. HIGHEST RETURN CODE WAS: 8'] : ['DFH5109 I END OF DFHCSDUP UTILITY JOB. HIGHEST RETURN CODE WAS: 0']),
      ]
  const systsprt = [
    `LWDR916 RUN ${r.runID} JOB ${r.jobName} ${r.jesJobID} RESULT ${r.jobResult}`,
    'LWDR916 POST /token: HTTP 200',
    'LWDR916 POST /jobResults: HTTP 200, RECORDED',
  ]
  const ran = steps.find((s) => s.stepName.startsWith('LWDRS') && s.flushed === 'N')
  const file = (fileNo, ddName, stepName, lines) => ({ fileNo, ddName, stepName, procStep: '', lines })
  return [
    file(1, 'JESMSGLG', 'JES2', msglg),
    file(2, 'JESJCL', 'JES2', jcl),
    file(3, 'JESYSMSG', 'JES2', sysmsg),
    file(4, 'SYSPRINT', steps[0].stepName, sysprint),
    ...(ran ? [file(5, 'SYSTSPRT', ran.stepName, systsprt)] : []),
  ]
}

export function createOutput({ d, seeDeployment }) {
  // The run, if the user may see its deployment; 04 01 otherwise
  function seeRun(userID, runID) {
    const r = d.jobRuns.find((x) => x.runID === int(runID))
    if (!r) refuse('04', '01', 'Run not found')
    seeDeployment(userID, r.deplID)
    return r
  }
  const collected = (r) => r.outputStatus === 'C'

  return {
    listJobRuns(userID, query) {
      const dep = seeDeployment(userID, query.deplID)
      const rows = d.jobRuns.filter((r) => r.deplID === dep.deplID && r.jobNo === int(query.jobNo))
        .sort((a, b) => b.runID - a.runID).slice(0, 20)
        .map(({ runID, jobNo, jobName, runStatus, jobResult, jesJobID, submittedDate, endedDate, jobRC, abendCode, jobMessage, outputStatus }) =>
          ({ runID, jobNo, jobName, runStatus, jobResult, jesJobID, submittedDate, endedDate, jobRC, abendCode, jobMessage, outputStatus }))
      return ok({ runs: rows })
    },

    listJobSteps(userID, query) {
      const r = seeRun(userID, query.runID)
      const since = int(query.stepNo_since)
      return ok({ steps: collected(r) ? stepsOf(r).filter((s) => s.stepNo > since).slice(0, 20) : [] })
    },

    listSpoolFiles(userID, query) {
      const r = seeRun(userID, query.runID)
      const since = int(query.fileNo_since)
      const rows = collected(r) ? filesOf(r).filter((f) => f.fileNo > since).slice(0, 20) : []
      return ok({
        spoolFiles: rows.map(({ lines, ...f }) => ({ ...f, lineCount: lines.length, truncated: 'N' })),
      })
    },

    // Whole lines after lineNum_since: at most 300 and 24000 bytes of UTF-8
    getSpoolText(userID, runID, query) {
      const r = seeRun(userID, runID)
      const f = collected(r) && filesOf(r).find((x) => x.fileNo === int(query.fileNo))
      if (!f) refuse('04', '01', 'Spool file not found')
      const since = int(query.lineNum_since)
      const part = []
      let bytes = 0
      for (const line of f.lines.slice(since)) {
        const size = Buffer.byteLength(line, 'utf8') + 1
        if (part.length >= TEXT_LINES || bytes + size > TEXT_BYTES) break
        part.push(line)
        bytes += size
      }
      return ok({
        runID: r.runID, fileNo: f.fileNo, firstLineNum: since + 1, lineCount: part.length,
        moreLines: since + part.length < f.lines.length ? 'Y' : 'N',
        spoolText: Buffer.from(part.join('\n'), 'utf8').toString('base64'),
      })
    },
  }
}
