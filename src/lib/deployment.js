import { formatTs } from './timestamps'

// Texts and timing of the deployment page, kept apart so they can be tested

// STARTAFTER is never empty: for "as soon as possible" it is the request
// time (LWDM411). Only a later minute is a start the requester asked for.
export function laterStart(d) {
  const start = formatTs(d.startAfter)
  return start && start > formatTs(d.requestedDate) ? d.startAfter : ''
}

// How often the page asks again: often while something happens, seldom
// while it waits for people, not at all once nothing changes by itself
export function pollMs(status) {
  if (status === 'Q' || status === 'U') return 5000
  if (status === 'W') return 30000
  return 0
}

// -1 is "not known yet"; an abend code says more than an RC
export function rcText(j) {
  if (j.abendCode) return j.abendCode
  return j.jobRC >= 0 ? String(j.jobRC) : ''
}

export function statusText(d, jobs = []) {
  const running = jobs.find((j) => j.jobStatus === 'S')
  const failed = jobs.find((j) => j.jobStatus === 'F')
  switch (d.deplStatus) {
    case 'W':
      return `Waits for approval: ${d.approvedCount} of ${d.approvalCount} so far.`
    case 'Q':
      return laterStart(d) ? `Queued: starts at ${formatTs(d.startAfter)}, or later if ${d.envCode} is busy then.` : `Queued: starts as soon as ${d.envCode} is free.`
    case 'U':
      return running ? `Running job ${running.jobNo}, ${running.jobTitle}.` : 'Running: the next job is being submitted.'
    case 'F':
      return failed
        ? `Job ${failed.jobNo}, ${failed.jobTitle}, failed. It holds ${d.envCode} until it is retried, continued or cancelled.`
        : `Failed. It holds ${d.envCode} until it is retried, continued or cancelled.`
    case 'S':
      return `Succeeded: ${d.versionName} is in ${d.envCode}.`
    case 'C':
      return 'Cancelled.'
    case 'J':
      return 'Rejected by an approver.'
    case 'E':
      return 'Expired: it wasn’t approved in time.'
    default:
      return ''
  }
}

// The filters of DeploymentTable's filter row, by the query field of
// GET /deployments; '' is no filter
export const NO_DEPLOYMENT_FILTERS = {
  deplID_filter: '', appCode_filter: '', envCode_filter: '', versionName_filter: '', deplStatus_filter: '',
}
