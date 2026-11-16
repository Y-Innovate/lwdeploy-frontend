import { decodeBase64Utf8 } from '../lib/base64'
import { apiRequest } from './client'
import { defineList } from './lists'

const enc = encodeURIComponent

// D1: answers 201 with the deployment, W (approval) or Q/U
export function requestDeployment({ appID, envID, versionID, startAfter = '', requestNote = '' }) {
  return apiRequest('POST', '/deployments', { body: { appID, envID, versionID, startAfter, requestNote } })
}

// M3, D2, AP2: the deployment with canCancel, canRetry and canApprove
export function getDeployment(deplID) {
  return apiRequest('GET', `/deployments/${enc(deplID)}`)
}

// D3, D4: each answers deplID and the new deplStatus
export function cancelDeployment(deplID, commentText = '') {
  return apiRequest('POST', `/cancellations/${enc(deplID)}`, { body: { commentText } })
}
export function retryDeployment(deplID, commentText = '') {
  return apiRequest('POST', `/retries/${enc(deplID)}`, { body: { commentText } })
}
// commentText is required: the reason for skipping the failed job
export function continueDeployment(deplID, commentText) {
  return apiRequest('POST', `/continuations/${enc(deplID)}`, { body: { commentText } })
}

// The jobs in order with their latest run; at most 20, never paged
export const deploymentJobs = defineList({ path: '/deploymentJobs', listKey: 'jobs' })
// The history, oldest first
export const deploymentEvents = defineList({
  path: '/deploymentEvents', listKey: 'events', since: [['eventNo_since', 'eventNo']],
})

// M3, AP2: the frozen JCL of one job, decoded: { deplID, jobNo, lineCount, text }
export async function getDeploymentJcl(deplID, jobNo) {
  const { jcl, ...rest } = await apiRequest('GET', `/deploymentJcl/${enc(deplID)}`, { query: { jobNo } })
  return { ...rest, text: decodeBase64Utf8(jcl) }
}
