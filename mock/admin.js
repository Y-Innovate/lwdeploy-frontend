// The administrators' side of the mock backend (lwdeploy/docs/10-iteration-6.md,
// 6a): applications (LWDM204 with ADMINVIEW, LWDM004), environment controls
// (LWDM006 K) and the allowlists (LWDM201). Every operation starts with the
// administrator check, R095-CHECK-ADMIN: 08 50 for anyone else.
import { ts } from './clock.js'
import { int, ok, page, refuse, run, text, upper } from './util.js'

const RACF_NAME = /^[A-Z#$@][A-Z0-9#$@]{0,7}$/
const APP_CODE = /^[A-Z0-9]{1,8}$/
export const REF_TABLES = ['RACFGRP', 'DEPLUSER', 'SETTINGS']

// The settings an administrator may change (A5), each with its check; the
// others come from envs/<env>.yaml through DDL/SETTINGS, or (LASTTICK) from
// the scheduler (lwdeploy/docs/10-iteration-6.md, Decisions)
const range = (min, max) => (v) => (/^\d+$/.test(v) && +v >= min && +v <= max ? '' : `a whole number from ${min} to ${max}`)
export const EDITABLE_SETTINGS = {
  APPRHRS: range(1, 720),
  JOBMINS: range(5, 1440),
  OUTDAYS: range(1, 3650),
  OUTLINES: range(1000, 500000),
  GRPMINS: range(1, 1440),
  JOBCLASS: (v) => (/^[A-Z0-9]$/.test(v) ? '' : 'one character, A-Z or 0-9'),
  MSGCLASS: (v) => (/^[A-Z0-9]$/.test(v) ? '' : 'one character, A-Z or 0-9'),
  MAILFROM: (v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && v.length <= 255 ? '' : 'an email address'),
  MAILURL: (v) => (/^https?:\/\/\S+$/.test(v) && v.length <= 255 ? '' : 'a URL starting with https://'),
}

export function createAdmin({ d, clock, isAdmin, appOf, environmentRow }) {
  const now = () => ts(clock())
  const next = (rows, key) => rows.reduce((m, r) => Math.max(m, r[key]), 0) + 1

  function requireAdmin(userID) {
    if (!isAdmin(userID)) refuse('08', '50', 'Only an administrator may do this')
  }

  const inList = (tableID, key) => d.refTables.some((r) => r.tableID === tableID && r.tabKey === key)
  function event(dep, eventType, { jobNo = 0, commentText = '', by, at }) {
    d.events.push({ deplID: dep.deplID, eventNo: d.events.filter((x) => x.deplID === dep.deplID).length + 1, eventType,
      jobNo, commentText, createdBy: by, createdDate: at })
  }
  const refOf = (tableID, key) => d.refTables.find((r) => r.tableID === tableID && r.tabKey === key)

  // Where an allowlist entry is used, for the refusal of its deletion
  function usedBy(tableID, key) {
    if (tableID === 'DEPLUSER') {
      const e = d.environments.find((x) => x.deployUser === key)
      return e && `deploy userid of ${appOf(e.appID).appCode} ${e.envCode}`
    }
    const a = d.applications.find((x) => x.accessGroup === key || x.ownerGroup === key)
    if (a) return `${a.accessGroup === key ? 'access' : 'owner'} group of ${a.appCode}`
    const e = d.environments.find((x) => x.approverGroup === key || x.deployerGroup === key)
    return e && `${e.approverGroup === key ? 'approver' : 'deployer'} group of ${appOf(e.appID).appCode} ${e.envCode}`
  }

  // A group field: required or not, and from the RACFGRP allowlist (08 02)
  function group(body, field, { required = false } = {}) {
    const value = upper(body[field])
    if (!value) {
      if (required) refuse('08', '01', `${field} is required`)
      return ''
    }
    if (!inList('RACFGRP', value)) refuse('08', '02', `${field} ${value} is not in the allowlist of RACF groups`)
    return value
  }

  const appRow = (a) => {
    const { appID, appCode, appName, appDescription, accessGroup, ownerGroup, createdBy, createdDate, updatedBy, updatedDate } = a
    return { appID, appCode, appName, appDescription, accessGroup, ownerGroup, createdBy, createdDate, updatedBy, updatedDate }
  }

  // The fields of POST and PUT /admin/applications, checked as LWDM004 does
  function appFields(body, appID = 0) {
    const appCode = upper(body.appCode)
    const appName = text(body.appName)
    const appDescription = text(body.appDescription)
    if (!appCode) refuse('08', '01', 'appCode is required')
    if (!APP_CODE.test(appCode)) refuse('08', '02', 'appCode: A-Z and 0-9 only, at most 8')
    if (!appName) refuse('08', '01', 'appName is required')
    if (appName.length > 60) refuse('08', '02', 'appName: at most 60 characters')
    if (appDescription.length > 1000) refuse('08', '02', 'appDescription: at most 1000 characters')
    const accessGroup = group(body, 'accessGroup', { required: true })
    const ownerGroup = group(body, 'ownerGroup', { required: true })
    if (d.applications.some((a) => a.appCode === appCode && a.appID !== appID)) {
      refuse('08', '11', `Application code ${appCode} is taken`)
    }
    return { appCode, appName, appDescription, accessGroup, ownerGroup }
  }

  return {
    // GET /admin/applications (LWDM204, ADMINVIEW Y): every application, by appID
    adminListApplications: (userID, query) => run(() => {
      requireAdmin(userID)
      const since = int(query.appID_since)
      const rows = d.applications.filter((a) => a.appID > since).sort((a, b) => a.appID - b.appID)
        .map(({ appID, appCode, appName, accessGroup, ownerGroup }) => ({ appID, appCode, appName, accessGroup, ownerGroup }))
      return ok({ applications: page(rows) })
    }),

    // GET /admin/applications/{appID} (LWDM004 R)
    adminGetApplication: (userID, appID) => run(() => {
      requireAdmin(userID)
      const a = appOf(appID)
      if (!a) refuse('04', '01', 'Application not found')
      return ok(appRow(a))
    }),

    // POST /admin/applications (LWDM004 C)
    adminNewApplication: (userID, body) => run(() => {
      requireAdmin(userID)
      const fields = appFields(body)
      const a = { appID: next(d.applications, 'appID'), ...fields,
        createdBy: userID, createdDate: now(), updatedBy: userID, updatedDate: now() }
      d.applications.push(a)
      return ok(appRow(a), 201)
    }),

    // PUT /admin/applications/{appID} (LWDM004 U)
    adminUpdateApplication: (userID, appID, body) => run(() => {
      requireAdmin(userID)
      const a = appOf(appID)
      if (!a) refuse('08', '31', 'Application not found')
      Object.assign(a, appFields(body, a.appID), { updatedBy: userID, updatedDate: now() })
      return ok(appRow(a))
    }),

    // DELETE /admin/applications/{appID} (LWDM004 D): only without
    // deployments; takes its environments, versions, variables, templates
    // and revisions with it in one unit of work
    adminDeleteApplication: (userID, appID) => run(() => {
      requireAdmin(userID)
      const a = appOf(appID)
      if (!a) refuse('08', '41', 'Application not found')
      const count = d.deployments.filter((x) => x.appID === a.appID).length
      if (count) refuse('08', '53', `${a.appCode} has ${count === 1 ? '1 deployment' : `${count} deployments`}: it can't be deleted`)
      const gone = (rows) => rows.filter((r) => r.appID !== a.appID)
      d.applications = gone(d.applications)
      d.environments = gone(d.environments)
      d.versions = gone(d.versions)
      d.templates = gone(d.templates)
      if (d.variables) d.variables = gone(d.variables)
      return ok()
    }),

    // PUT /admin/environmentControls/{envID} (LWDM006 K). Deployments already
    // requested keep the controls they were requested with (A2): they have
    // their own copy.
    adminSetEnvironmentControls: (userID, envID, body) => run(() => {
      requireAdmin(userID)
      const e = d.environments.find((x) => x.envID === int(envID))
      if (!e) refuse('08', '31', 'Environment not found')
      const deployUser = upper(body.deployUser)
      if (deployUser && !inList('DEPLUSER', deployUser)) {
        refuse('08', '02', `deployUser ${deployUser} is not in the allowlist of deploy userids`)
      }
      const approvalReq = upper(body.approvalReq) || 'N'
      if (!['Y', 'N'].includes(approvalReq)) refuse('08', '02', 'approvalReq: Y or N')
      const approverGroup = group(body, 'approverGroup')
      const deployerGroup = group(body, 'deployerGroup')
      const count = int(body.approvalCount)
      if (approvalReq === 'Y' && !approverGroup) refuse('08', '02', 'Approval needs an approver group')
      if (approvalReq === 'Y' && count < 1) refuse('08', '02', 'Approval needs at least 1 approval')
      const execNode = upper(body.execNode)
      if (execNode && !RACF_NAME.test(execNode)) refuse('08', '02', 'execNode: a JES2 node name of 1 to 8 characters')
      Object.assign(e, {
        deployUser, approvalReq, approverGroup, deployerGroup, execNode,
        approvalCount: approvalReq === 'Y' ? count : 0, updatedBy: userID, updatedDate: now(),
      })
      return ok(environmentRow(userID, e))
    }),

    // GET /admin/refTables?tableID= (LWDM201): one list by key, pages of 20
    adminListRefTables: (userID, query) => run(() => {
      requireAdmin(userID)
      const tableID = upper(query.tableID)
      if (!REF_TABLES.includes(tableID)) refuse('08', '02', 'tableID: RACFGRP, DEPLUSER or SETTINGS')
      const since = upper(query.tabKey_since)
      const rows = d.refTables.filter((r) => r.tableID === tableID && (!since || r.tabKey > since))
        .sort((a, b) => a.tabKey.localeCompare(b.tabKey))
      return ok({ refTables: page(rows.map((r) => ({ ...r }))) })
    }),

    // POST /admin/refTables (LWDM001 C): an allowlist entry; no settings
    adminNewRefTable: (userID, body) => run(() => {
      requireAdmin(userID)
      const tableID = upper(body.tableID)
      const tabKey = upper(body.tabKey)
      const tabValue = text(body.tabValue)
      if (tableID === 'SETTINGS') refuse('08', '50', 'Settings come from envs/<env>.yaml: none is created here')
      if (!REF_TABLES.includes(tableID)) refuse('08', '02', 'tableID: RACFGRP or DEPLUSER')
      if (!tabKey) refuse('08', '01', 'tabKey is required')
      if (!RACF_NAME.test(tabKey)) refuse('08', '02', `${tabKey} is not a RACF name: 1 to 8, A-Z 0-9 # $ @, not starting with a digit`)
      if (tabValue.length > 255) refuse('08', '02', 'tabValue: at most 255 characters')
      if (inList(tableID, tabKey)) refuse('08', '11', `${tabKey} is in the list already`)
      const r = { tableID, tabKey, tabValue, createdBy: userID, createdDate: now(), updatedBy: userID, updatedDate: now() }
      d.refTables.push(r)
      return ok({ ...r }, 201)
    }),

    // PUT /admin/refTables/{tableID}?tabKey= (LWDM001 U): the description of
    // an allowlist entry, or the value of an editable setting
    adminUpdateRefTable: (userID, tableID, query, body) => run(() => {
      requireAdmin(userID)
      const table = upper(tableID)
      const tabKey = upper(query.tabKey)
      const r = refOf(table, tabKey)
      if (!r) refuse('08', '31', `${table} ${tabKey} not found`)
      let tabValue = text(body.tabValue)
      if (table === 'SETTINGS') {
        const check = EDITABLE_SETTINGS[tabKey]
        if (!check) refuse('08', '50', `${tabKey} comes from envs/<env>.yaml and can't be changed here`)
        if (['JOBCLASS', 'MSGCLASS'].includes(tabKey)) tabValue = tabValue.toUpperCase()
        const wrong = check(tabValue)
        if (wrong) refuse('08', '02', `${tabKey}: ${wrong}`)
      } else if (tabValue.length > 255) {
        refuse('08', '02', 'tabValue: at most 255 characters')
      }
      Object.assign(r, { tabValue, updatedBy: userID, updatedDate: now() })
      return ok({ ...r })
    }),

    // DELETE /admin/refTables/{tableID}?tabKey= (LWDM001 D): an allowlist
    // entry nothing uses
    adminDeleteRefTable: (userID, tableID, query) => run(() => {
      requireAdmin(userID)
      const table = upper(tableID)
      const tabKey = upper(query.tabKey)
      if (table === 'SETTINGS') refuse('08', '50', 'Settings are never deleted')
      const r = refOf(table, tabKey)
      if (!r) refuse('08', '41', `${table} ${tabKey} not found`)
      const use = usedBy(table, tabKey)
      if (use) refuse('08', '53', `${tabKey} is still used: ${use}`)
      d.refTables = d.refTables.filter((x) => x !== r)
      return ok()
    }),

    // POST /admin/stuckRuns/{runID} (LWDM514, A4): a submitted run whose
    // result step never reported fails as LWDM930 does after JOBMINS: run F
    // with result T, job and deployment F, event F
    adminMarkStuck: (userID, runID) => run(() => {
      requireAdmin(userID)
      const r = d.jobRuns.find((x) => x.runID === int(runID))
      if (!r) refuse('08', '31', 'Run not found')
      if (r.runStatus !== 'S') refuse('08', '53', `Run ${r.runID} isn't submitted any more: nothing changed`)
      const at = now()
      const dep = d.deployments.find((x) => x.deplID === r.deplID)
      const job = d.deplJobs.find((j) => j.deplID === r.deplID && j.jobNo === r.jobNo)
      Object.assign(r, { runStatus: 'F', jobResult: 'T', endedDate: at, jobMessage: `Marked stuck by ${userID}` })
      job.jobStatus = 'F'
      Object.assign(dep, { deplStatus: 'F', endedDate: at, updatedBy: userID, updatedDate: at })
      event(dep, 'F', { jobNo: r.jobNo, commentText: `Marked stuck by ${userID}`, by: userID, at })
      return ok({ runID: r.runID, runStatus: r.runStatus, jobResult: r.jobResult, deplID: dep.deplID, deplStatus: dep.deplStatus })
    }),
  }
}
