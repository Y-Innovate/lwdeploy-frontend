import { decodeBase64Utf8 } from '../lib/base64'
import { apiRequest } from './client'
import { defineList } from './lists'

// M3: the runs of one job, newest first; at most 20, never paged
export const jobRuns = defineList({ path: '/jobRuns', listKey: 'runs' })
// M3: the steps of a run as the collector found them; empty until collected
export const jobSteps = defineList({ path: '/jobSteps', listKey: 'steps', since: [['stepNo_since', 'stepNo']] })
// M4: the collected spool files of a run, in spool order
export const spoolFiles = defineList({ path: '/spoolFiles', listKey: 'spoolFiles', since: [['fileNo_since', 'fileNo']] })

// M4: the lines of a spool file after lineNum_since, decoded. The next
// part starts after firstLineNum + lineCount - 1, while moreLines is Y.
export async function getSpoolText(runID, fileNo, lineNumSince = 0) {
  const { spoolText, ...rest } = await apiRequest('GET', `/spoolText/${encodeURIComponent(runID)}`, {
    query: { fileNo, lineNum_since: lineNumSince || undefined },
  })
  const text = decodeBase64Utf8(spoolText)
  return { ...rest, lines: rest.lineCount > 0 ? text.split('\n') : [] }
}
