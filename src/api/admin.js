import { apiRequest } from './client'
import { defineList } from './lists'

// The administrators' paths (lwdeploy/docs/10-iteration-6.md, 6a). The
// backend checks the administrator (08 50 otherwise); the UI only hides the
// pages from others.

// A1, A4: every application, by appID, with its groups
export const adminApplications = defineList({
  path: '/admin/applications', listKey: 'applications', since: [['appID_since', 'appID']],
})

// A3, A5: one allowlist (RACFGRP, DEPLUSER) or the settings, by key
export const refTables = defineList({
  path: '/admin/refTables', listKey: 'refTables', since: [['tabKey_since', 'tabKey']],
})

const appPath = (appID) => `/admin/applications/${encodeURIComponent(appID)}`

// A1. fields: appCode, appName, appDescription, accessGroup, ownerGroup
export function getAdminApplication(appID) {
  return apiRequest('GET', appPath(appID))
}

export function createApplication(fields) {
  return apiRequest('POST', '/admin/applications', { body: fields })
}

export function updateApplication(appID, fields) {
  return apiRequest('PUT', appPath(appID), { body: fields })
}

// Refused with 08 53 while the application has deployments
export function deleteApplication(appID) {
  return apiRequest('DELETE', appPath(appID))
}

// A2. controls: deployUser, approvalReq, approverGroup, approvalCount,
// deployerGroup, execNode. Answers the whole environment.
export function setEnvironmentControls(envID, controls) {
  return apiRequest('PUT', `/admin/environmentControls/${encodeURIComponent(envID)}`, { body: controls })
}

// A4: deployments of every application, newest first; filters appID_filter,
// deplStatus_filter, requestedBy_filter
export const adminDeployments = defineList({
  path: '/admin/deployments', listKey: 'deployments', since: [['deplID_since', 'deplID']],
})

// A3: an entry of RACFGRP or DEPLUSER. Settings are never created or deleted.
export function createRefEntry(tableID, tabKey, tabValue) {
  return apiRequest('POST', '/admin/refTables', { body: { tableID, tabKey, tabValue } })
}

// A3, A5: the description of an allowlist entry, or the value of a setting
export function updateRefEntry(tableID, tabKey, tabValue) {
  return apiRequest('PUT', `/admin/refTables/${encodeURIComponent(tableID)}`, { query: { tabKey }, body: { tabValue } })
}

// Refused with 08 53 while an application or environment uses the entry
export function deleteRefEntry(tableID, tabKey) {
  return apiRequest('DELETE', `/admin/refTables/${encodeURIComponent(tableID)}`, { query: { tabKey } })
}

// A4: a submitted run whose result step never reported fails now, with its
// job and deployment. 08 53 when the run isn't submitted any more.
export function markRunStuck(runID) {
  return apiRequest('POST', `/admin/stuckRuns/${encodeURIComponent(runID)}`)
}
