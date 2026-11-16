// The deployment side of the mock backend: request (LWDM411), get
// (LWDM311), jobs (LWDM212), frozen JCL (LWDM313), history (LWDM219), the
// actions (LWDM511) and approval (LWDM290, LWDM218, LWDM418),
// plus a stand-in for the submit task, the jobs and the result step: on
// every call, progress() moves running deployments along the mock clock.
// A job runs JOB_MS; job 2 of a version with BAD in its name ends with RC 8,
// above its highest RC, every other job with RC 0. The jobs of a request
// whose note has the word "hang" never report.
import { ts } from './clock.js'
import { createOutput } from './output.js'
import { int, ok, refuse, run, text, upper } from './util.js'

export const JOB_MS = 8000
// The output collector finds a job's output this long after it ended
export const COLLECT_MS = 10000

const TS_RE = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})\.(\d{2})\.(\d{2})\.(\d{6})$/
export function tsValid(value) {
  const m = TS_RE.exec(value)
  if (!m) return false
  const date = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
  return date.getMonth() === +m[2] - 1 && date.getDate() === +m[3] && +m[4] < 24
}
const msOf = (value) => {
  const m = TS_RE.exec(value)
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], Math.floor(+m[7] / 1000)).getTime()
}

export function createDeployments({ d, clock, inGroup, isAdmin, rolesIn, appOf, seeApp, frozenFor }) {
  const nowMs = () => clock().getTime()
  const yn = (b) => (b ? 'Y' : 'N')
  const next = (rows, key) => rows.reduce((m, r) => Math.max(m, r[key]), 0) + 1

  const depOf = (deplID) => d.deployments.find((x) => x.deplID === int(deplID))
  const envOf = (envID) => d.environments.find((e) => e.envID === int(envID))
  const versionOf = (versionID) => d.versions.find((v) => v.versionID === int(versionID))
  const jobsOf = (deplID) => d.deplJobs.filter((j) => j.deplID === deplID).sort((a, b) => a.jobNo - b.jobNo)
  const runOf = (runID) => d.jobRuns.find((r) => r.runID === runID)

  const isDeployer = (userID, env) =>
    inGroup(userID, appOf(env.appID).accessGroup) && (!env.deployerGroup || inGroup(userID, env.deployerGroup))

  function event(dep, eventType, { jobNo = 0, commentText = '', by = 'LWDSCHD', at } = {}) {
    d.events.push({
      deplID: dep.deplID, eventNo: d.events.filter((x) => x.deplID === dep.deplID).length + 1, eventType, jobNo,
      commentText, createdBy: by, createdDate: at ?? ts(clock()),
    })
  }

  // LWDM311's visibility: a role in the application, the approver group
  // copied into the deployment, or an administrator; 04 01 otherwise
  function seeDeployment(userID, deplID) {
    const dep = depOf(deplID)
    if (!dep || !(rolesIn(userID, appOf(dep.appID)).any || inGroup(userID, dep.approverGroup) || isAdmin(userID))) {
      refuse('04', '01', 'Deployment not found')
    }
    return dep
  }

  // ---- The submit task, the jobs and the result step -----------------------
  // Starts due Q deployments in a free environment, submits the next job,
  // and ends the runs whose time is up, in the order it would have happened
  function progress() {
    for (let guard = 0; guard < 200 && step(); guard++);
  }

  function step() {
    const t = nowMs()
    for (const dep of d.deployments.filter((x) => x.deplStatus === 'Q').sort((a, b) => a.deplID - b.deplID)) {
      const due = msOf(dep.startAfter)
      const held = d.deployments.some((x) => x.envID === dep.envID && ['U', 'F'].includes(x.deplStatus))
      if (due <= t && !held) {
        // Not before it was queued (at the request, or at the last approval)
        const at = ts(new Date(Math.max(due, dep.queuedMs ?? 0, envOf(dep.envID).freeAtMs ?? 0)))
        dep.deplStatus = 'U'
        dep.startedDate = at
        event(dep, 'U', { at })
        submitNext(dep, at)
        return true
      }
    }
    // The output of a run that failed in LWD (marked stuck) is collected too:
    // the job did end in JES
    for (const r of d.jobRuns.filter((x) => ['E', 'F'].includes(x.runStatus) && x.endedDate && x.outputStatus === 'W')) {
      if (msOf(r.endedDate) + COLLECT_MS <= t) {
        r.outputStatus = 'C'
        return true
      }
    }
    // A request note with the word "hang": its jobs never report, as when
    // the result step can't reach LWW, so a run can be marked stuck (A4)
    for (const r of d.jobRuns.filter((x) => x.runStatus === 'S' && !/\bhang\b/i.test(depOf(x.deplID).requestNote))) {
      const end = msOf(r.submittedDate) + JOB_MS
      if (end <= t) {
        endRun(r, ts(new Date(end)))
        return true
      }
    }
    return false
  }

  function submitNext(dep, at) {
    const job = jobsOf(dep.deplID).find((j) => j.jobStatus === 'W')
    if (!job) {
      dep.deplStatus = 'S'
      dep.endedDate = at
      envOf(dep.envID).freeAtMs = msOf(at)
      event(dep, 'S', { at })
      return
    }
    const runID = next(d.jobRuns, 'runID')
    d.jobRuns.push({
      runID, deplID: dep.deplID, jobNo: job.jobNo, jobName: `LWD${String(runID).padStart(5, '0')}`, runStatus: 'S',
      jobResult: '', jesJobID: `JOB${String(4000 + runID).padStart(5, '0')}`, submittedDate: at, endedDate: '',
      jobRC: -1, abendCode: '', jobMessage: '', outputStatus: 'W',
    })
    job.jobStatus = 'S'
    job.lastRunID = runID
  }

  function endRun(r, at) {
    const dep = depOf(r.deplID)
    const job = jobsOf(dep.deplID).find((j) => j.jobNo === r.jobNo)
    const bad = r.jobNo === 2 && /BAD/.test(versionOf(dep.versionID).versionName)
    Object.assign(r, { runStatus: 'E', endedDate: at, jobResult: bad ? 'H' : 'O', jobRC: bad ? 8 : 0 })
    if (bad) {
      job.jobStatus = 'F'
      dep.deplStatus = 'F'
      dep.endedDate = at
      event(dep, 'F', { jobNo: job.jobNo, at })
    } else {
      job.jobStatus = 'D'
      submitNext(dep, at)
    }
  }

  // ---- Responses -------------------------------------------------------------
  function deploymentBody(userID, dep) {
    const app = appOf(dep.appID)
    const env = envOf(dep.envID)
    const version = versionOf(dep.versionID)
    const member = inGroup(userID, app.accessGroup)
    const requester = dep.createdBy === userID
    const jobBusy = jobsOf(dep.deplID).some((j) => j.jobStatus === 'S')
    const decided = d.approvals.some((a) => a.deplID === dep.deplID && a.userID === userID)
    return {
      deplID: dep.deplID, appID: app.appID, appCode: app.appCode, appName: app.appName, envID: env.envID,
      envCode: env.envCode, envName: env.envName, versionID: version.versionID, versionName: version.versionName,
      location: version.location, deplStatus: dep.deplStatus, startAfter: dep.startAfter, requestNote: dep.requestNote,
      deployUser: dep.deployUser, approverGroup: dep.approverGroup, approvalCount: dep.approvalCount,
      approvedCount: dep.approvedCount, startedDate: dep.startedDate, endedDate: dep.endedDate,
      requestedBy: dep.createdBy, requestedDate: dep.createdDate,
      canCancel: yn((requester || member) && (['W', 'Q', 'F'].includes(dep.deplStatus) || (dep.deplStatus === 'U' && !jobBusy))),
      canRetry: yn(member && dep.deplStatus === 'F'),
      canApprove: yn(dep.deplStatus === 'W' && inGroup(userID, dep.approverGroup) && !requester && !decided),
    }
  }

  // ---- D1 --------------------------------------------------------------------
  function request(userID, body) {
    const app = seeApp(userID, body.appID)
    const env = envOf(body.envID)
    const version = versionOf(body.versionID)
    if (!env || env.appID !== app.appID) refuse('04', '01', 'Environment not found')
    if (!version || version.appID !== app.appID) refuse('04', '01', 'Version not found')
    const asked = text(body.startAfter)
    if (asked && !tsValid(asked)) refuse('08', '04', 'startAfter is not a valid timestamp')
    if (!isDeployer(userID, env)) refuse('08', '50', `You may not deploy to ${env.envCode}`)
    if (version.versionStatus === 'R') refuse('08', '53', `${version.versionName} is retired`)
    const templates = d.templates.filter((tp) => tp.appID === app.appID && tp.templateStatus === 'A')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    if (!env.deployUser) refuse('08', '59', `${env.envCode} has no deploy userid yet: ask an administrator`)
    if (env.approvalReq === 'Y' && !env.approverGroup) refuse('08', '59', `${env.envCode} has no approver group yet`)
    if (!templates.length) refuse('08', '59', `${app.appCode} has no job templates yet`)
    const noJcl = templates.find((tp) => tp.currentRev === 0)
    if (noJcl) refuse('08', '59', `Template ${noJcl.templateName} has no JCL yet`)
    if (env.promoGate === 'Y') {
      const before = d.environments.filter((e) => e.appID === app.appID && e.sortOrder < env.sortOrder)
        .sort((a, b) => b.sortOrder - a.sortOrder)[0]
      if (before && !d.deployments.some((x) => x.envID === before.envID && x.versionID === version.versionID && x.deplStatus === 'S')) {
        refuse('08', '54', `${version.versionName} did not succeed in ${before.envCode} yet`)
      }
    }
    // The JCL of every job, frozen now with the variables filled in (08 57)
    const frozen = templates.map((tp) => frozenFor(tp, env, version))

    const deplID = next(d.deployments, 'deplID')
    const now = ts(clock())
    // STARTAFTER is never empty: the request time for "now" or a time past (LWDM411 R250)
    const startAfter = asked && msOf(asked) > nowMs() ? asked : now
    const approval = env.approvalReq === 'Y'
    const dep = {
      deplID, appID: app.appID, envID: env.envID, versionID: version.versionID, deplStatus: approval ? 'W' : 'Q',
      startAfter, requestNote: text(body.requestNote), deployUser: env.deployUser,
      approverGroup: approval ? env.approverGroup : '', approvalCount: approval ? env.approvalCount : 0, approvedCount: 0,
      startedDate: '', endedDate: '', createdBy: userID, createdDate: now, updatedBy: userID, updatedDate: now,
      queuedMs: nowMs(),
    }
    d.deployments.push(dep)
    event(dep, 'R', { by: userID, commentText: dep.requestNote })
    templates.forEach((tp, i) => d.deplJobs.push({
      deplID, jobNo: i + 1, jobTitle: tp.templateName, templateID: tp.templateID, templateRev: tp.currentRev,
      maxRC: tp.maxRC, jobStatus: 'W', lastRunID: 0, skipReason: '', jcl: frozen[i],
    }))
    progress()
    return ok(deploymentBody(userID, dep), 201)
  }

  // ---- D3, D4 (LWDM511) ------------------------------------------------------
  function act(userID, deplID, action, body) {
    const dep = seeDeployment(userID, deplID)
    const env = envOf(dep.envID)
    const comment = text(body.commentText)
    const jobs = jobsOf(dep.deplID)
    if (action === 'C') {
      if (dep.createdBy !== userID && !isDeployer(userID, env)) refuse('08', '50', 'Only the requester or a deployer may cancel')
      const busy = jobs.some((j) => j.jobStatus === 'S')
      if (!['W', 'Q', 'F', 'U'].includes(dep.deplStatus)) refuse('08', '53', `The deployment is ${dep.deplStatus}: nothing to cancel`)
      if (busy) refuse('08', '53', 'A job is running: wait until it ends')
      jobs.filter((j) => j.jobStatus === 'W').forEach((j) => {
        j.jobStatus = 'K'
      })
      dep.deplStatus = 'C'
      dep.endedDate = ts(clock())
      env.freeAtMs = nowMs()
      event(dep, 'C', { by: userID, commentText: comment })
    } else {
      if (!isDeployer(userID, env)) refuse('08', '50', `You may not deploy to ${env.envCode}`)
      if (dep.deplStatus !== 'F') refuse('08', '53', 'Only a failed deployment can be retried or continued')
      const failed = jobs.find((j) => j.jobStatus === 'F')
      if (action === 'K' && !comment) refuse('08', '05', 'Give the reason for skipping the job')
      dep.deplStatus = 'U'
      dep.endedDate = ''
      if (action === 'T') {
        failed.jobStatus = 'W'
        event(dep, 'T', { by: userID, jobNo: failed.jobNo, commentText: comment })
      } else {
        failed.jobStatus = 'K'
        failed.skipReason = comment
        event(dep, 'K', { by: userID, jobNo: failed.jobNo, commentText: comment })
      }
      submitNext(dep, ts(clock()))
    }
    progress()
    return ok({ deplID: dep.deplID, deplStatus: dep.deplStatus })
  }

  // ---- AP1, AP2 -------------------------------------------------------------
  // The rows of GET /me's count: W, in the group, not own, not decided
  const waitsFor = (userID, dep) => dep.deplStatus === 'W' && inGroup(userID, dep.approverGroup) &&
    dep.createdBy !== userID && !d.approvals.some((a) => a.deplID === dep.deplID && a.userID === userID)

  function decide(userID, body) {
    const decision = upper(body.decision)
    const comment = text(body.commentText)
    const dep = seeDeployment(userID, body.deplID)
    if (!['A', 'R'].includes(decision)) refuse('08', '02', 'decision must be A or R')
    if (decision === 'R' && !comment) refuse('08', '05', 'Give the reason for rejecting')
    if (!inGroup(userID, dep.approverGroup)) refuse('08', '50', `You are not in approver group ${dep.approverGroup}`)
    if (dep.deplStatus !== 'W') refuse('08', '53', 'The deployment doesn\u2019t wait for approval any more')
    if (dep.createdBy === userID) refuse('08', '55', 'You can\u2019t approve your own request')
    if (d.approvals.some((a) => a.deplID === dep.deplID && a.userID === userID)) refuse('08', '55', 'You decided on this deployment already')
    const now = ts(clock())
    d.approvals.push({ deplID: dep.deplID, userID, decision, commentText: comment, createdDate: now })
    if (decision === 'R') {
      dep.deplStatus = 'J'
      dep.endedDate = now
      jobsOf(dep.deplID).forEach((j) => {
        j.jobStatus = 'K'
      })
      event(dep, 'J', { by: userID, commentText: comment })
    } else {
      dep.approvedCount += 1
      event(dep, 'A', { by: userID, commentText: comment })
      if (dep.approvedCount >= dep.approvalCount) {
        dep.deplStatus = 'Q'
        dep.queuedMs = nowMs()
        event(dep, 'Q', { by: userID })
      }
    }
    progress()
    return ok({ deplID: dep.deplID, deplStatus: dep.deplStatus, approvedCount: dep.approvedCount, approvalCount: dep.approvalCount }, 201)
  }

  const output = createOutput({ d, seeDeployment })

  return {
    progress,

    listJobRuns: (userID, query) => run(() => output.listJobRuns(userID, query)),
    listJobSteps: (userID, query) => run(() => output.listJobSteps(userID, query)),
    listSpoolFiles: (userID, query) => run(() => output.listSpoolFiles(userID, query)),
    getSpoolText: (userID, runID, query) => run(() => output.getSpoolText(userID, runID, query)),

    listApprovalRequests: (userID, query) => {
      const since = int(query.deplID_since)
      const rows = d.deployments.filter((x) => x.deplID > since && waitsFor(userID, x)).sort((a, b) => a.deplID - b.deplID)
        .map((x) => {
          const app = appOf(x.appID)
          const env = envOf(x.envID)
          return {
            deplID: x.deplID, appID: app.appID, appCode: app.appCode, appName: app.appName, envID: env.envID,
            envCode: env.envCode, envName: env.envName, versionName: versionOf(x.versionID).versionName,
            approvedCount: x.approvedCount, approvalCount: x.approvalCount, startAfter: x.startAfter,
            requestedBy: x.createdBy, requestedDate: x.createdDate,
          }
        })
      return ok({ approvalRequests: rows.slice(0, 20) })
    },
    listApprovals: (userID, query) => run(() => {
      const dep = seeDeployment(userID, query.deplID)
      const rows = d.approvals.filter((a) => a.deplID === dep.deplID).sort((a, b) => a.createdDate.localeCompare(b.createdDate))
        .map(({ userID: u, decision, commentText, createdDate }) => ({ userID: u, decision, commentText, createdDate }))
      return ok({ approvals: rows })
    }),
    newApproval: (userID, body) => run(() => decide(userID, body)),

    // The frozen JCL as base64 of UTF-8 text, lines separated by LF
    getDeploymentJcl: (userID, deplID, query) => run(() => {
      const dep = seeDeployment(userID, deplID)
      const job = jobsOf(dep.deplID).find((j) => j.jobNo === int(query.jobNo))
      if (!job) refuse('04', '01', 'Job not found')
      return ok({
        deplID: dep.deplID, jobNo: job.jobNo, lineCount: job.jcl.split('\n').length,
        jcl: Buffer.from(job.jcl, 'utf8').toString('base64'),
      })
    }),

    newDeployment: (userID, body) => run(() => request(userID, body)),
    getDeployment: (userID, deplID) => run(() => ok(deploymentBody(userID, seeDeployment(userID, deplID)))),

    listDeploymentJobs: (userID, query) => run(() => {
      const dep = seeDeployment(userID, query.deplID)
      return ok({
        jobs: jobsOf(dep.deplID).map((j) => {
          const r = runOf(j.lastRunID)
          return {
            jobNo: j.jobNo, jobTitle: j.jobTitle, templateID: j.templateID, templateRev: j.templateRev, maxRC: j.maxRC,
            jobStatus: j.jobStatus, lineCount: j.jcl.split('\n').length, lastRunID: j.lastRunID,
            runStatus: r?.runStatus ?? '', jobResult: r?.jobResult ?? '', jobRC: r ? r.jobRC : -1,
            abendCode: r?.abendCode ?? '', skipReason: j.skipReason,
          }
        }),
      })
    }),

    // Oldest first, pages of 20 (eventNo_since)
    listDeploymentEvents: (userID, query) => run(() => {
      const dep = seeDeployment(userID, query.deplID)
      const since = int(query.eventNo_since)
      const rows = d.events.filter((x) => x.deplID === dep.deplID && x.eventNo > since).sort((a, b) => a.eventNo - b.eventNo)
        .map(({ eventNo, eventType, jobNo, commentText, createdBy, createdDate }) => ({ eventNo, eventType, jobNo, commentText, createdBy, createdDate }))
      return ok({ events: rows.slice(0, 20) })
    }),

    cancelDeployment: (userID, deplID, body) => run(() => act(userID, deplID, 'C', body)),
    retryDeployment: (userID, deplID, body) => run(() => act(userID, deplID, 'T', body)),
    continueDeployment: (userID, deplID, body) => run(() => act(userID, deplID, 'K', body)),
  }
}

