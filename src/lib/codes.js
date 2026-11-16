// The backend's one-letter codes in words. Values from openapi/lwd.yaml.

export const DEPL_STATUS = {
  W: 'Awaiting approval',
  J: 'Rejected',
  E: 'Expired',
  Q: 'Queued',
  U: 'Running',
  F: 'Failed',
  S: 'Succeeded',
  C: 'Cancelled',
}
// No further change without someone acting: polling can stop
export const FINAL_DEPL_STATUSES = ['J', 'E', 'S', 'F', 'C']

export const JOB_STATUS = { W: 'Waiting', S: 'Submitted', D: 'Done', F: 'Failed', K: 'Skipped' }
export const RUN_STATUS = { N: 'New', S: 'Submitted', E: 'Ended', F: 'Failed' }
export const JOB_RESULT = {
  O: 'Within the highest RC',
  H: 'Above the highest RC',
  A: 'Abend',
  X: 'Submit failed',
  T: 'No result in time',
}
export const OUTPUT_STATUS = { W: 'Not collected yet', C: 'Collected', N: 'None found', P: 'Purged' }
export const VERSION_STATUS = { A: 'Active', R: 'Retired' }
export const LOC_TYPE = { D: 'Dataset prefix', U: 'USS path' }
export const ENV_STATE = { N: 'Never deployed', O: 'OK', H: 'Possibly half deployed' }
export const EVENT_TYPE = {
  R: 'Requested',
  A: 'Approved',
  J: 'Rejected',
  Q: 'Queued',
  U: 'Started',
  T: 'Retried',
  K: 'Continued',
  C: 'Cancelled',
  E: 'Expired',
  S: 'Succeeded',
  F: 'Failed',
}
export const DECISION = { A: 'Approved', R: 'Rejected' }

// The word for a code, or the code itself when it is unknown, so a new code
// shows up instead of disappearing.
export function label(map, code) {
  const c = String(code ?? '').trim().toUpperCase()
  return map[c] ?? c
}

export function isYes(value) {
  return String(value ?? '').trim().toUpperCase() === 'Y'
}
