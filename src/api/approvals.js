import { apiRequest } from './client'
import { defineList } from './lists'

// AP1: the deployments waiting for my approval, oldest first
export const approvalRequests = defineList({
  path: '/approvalRequests', listKey: 'approvalRequests', since: [['deplID_since', 'deplID']],
})
// M3, AP2: the decisions on one deployment, oldest first; never paged
export const approvals = defineList({ path: '/approvals', listKey: 'approvals' })

// AP2: decision A (approve) or R (reject, comment required). Answers the
// deployment's new status and approvedCount of approvalCount.
export function decide(deplID, decision, commentText = '') {
  return apiRequest('POST', '/approvals', { body: { deplID, decision, commentText } })
}
