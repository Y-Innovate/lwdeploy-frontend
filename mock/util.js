// Helpers of the mock backend (db.js):
// results as the LWDCnnn wrappers send them, and refusals with reason codes.

export const PAGE_SIZE = 20

// The wrappers' mapping of return and reason code to HTTP status
// (lwdeploy/docs/04-api.md, "Status and reason codes")
export function httpStatus(retCode, reasonCode) {
  if (retCode === '00') return 200
  if (retCode === '04' || ['13', '31', '33', '41'].includes(reasonCode)) return 404
  if (['11', '53', '54', '59'].includes(reasonCode)) return 409
  if (['50', '55'].includes(reasonCode)) return 403
  if (reasonCode.startsWith('0') || ['56', '57', '58'].includes(reasonCode)) return 400
  return 500
}

export const ok = (fields = {}, status = 200) =>
  ({ status, body: { retCode: '00', reasonCode: '00', infoMessage: '', ...fields } })

export class Refused extends Error {
  constructor(retCode, reasonCode, infoMessage) {
    super(infoMessage)
    this.result = { status: httpStatus(retCode, reasonCode), body: { retCode, reasonCode, infoMessage } }
  }
}
export const refuse = (retCode, reasonCode, infoMessage) => {
  throw new Refused(retCode, reasonCode, infoMessage)
}

// Runs an operation; a Refused becomes its result
export function run(fn) {
  try {
    return fn()
  } catch (e) {
    if (e instanceof Refused) return e.result
    throw e
  }
}

export const int = (v) => Number.parseInt(v ?? 0, 10) || 0
export const text = (v) => String(v ?? '').trim()
export const upper = (v) => text(v).toUpperCase()
export const page = (rows) => rows.slice(0, PAGE_SIZE)
export const randomCode = (n) =>
  Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
