// Time for the mocks: DB2 timestamps in local time, as the backend sends them.

const pad = (n, w = 2) => String(n).padStart(w, '0')

export function ts(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-` +
    `${pad(date.getHours())}.${pad(date.getMinutes())}.${pad(date.getSeconds())}.` +
    `${pad(date.getMilliseconds() * 1000, 6)}`
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// A timestamp relative to `now`: at(now, { days: -1, hours: 2 })
export function at(now, { days = 0, hours = 0, minutes = 0 } = {}) {
  return ts(new Date(now.getTime() + days * DAY + hours * HOUR + minutes * MINUTE))
}

export const FAR_FUTURE = '9999-12-31-23.59.59.999999'
