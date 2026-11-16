// DB2 timestamps travel as 'YYYY-MM-DD-HH.MM.SS.ffffff', in the mainframe's
// local time; they are shown as they come, without time-zone conversion.
// NULL timestamps arrive as blanks (or null, which the client makes "").

const TS_RE = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})\.(\d{2})\.(\d{2})\.(\d{6})$/

export function isBlank(ts) {
  return !ts || !String(ts).trim()
}

// '2026-01-31-12.05.00.000000' -> '2026-01-31 12:05'; withTime: false -> date
export function formatTs(ts, { withTime = true } = {}) {
  if (isBlank(ts)) return ''
  const m = TS_RE.exec(String(ts).trim())
  if (!m) return String(ts).trim()
  const date = `${m[1]}-${m[2]}-${m[3]}`
  return withTime ? `${date} ${m[4]}:${m[5]}` : date
}

// '2026-01-31 12:05 - 2026-02-01 18:00', or one date for a range within a day
export function formatRange(from, to) {
  if (isBlank(from) || isBlank(to)) return formatTs(from) || formatTs(to)
  const [fromDate] = formatTs(from).split(' ')
  const [toDate, toTime] = formatTs(to).split(' ')
  return fromDate === toDate ? `${formatTs(from)} - ${toTime}` : `${formatTs(from)} - ${formatTs(to)}`
}

// Timestamps in this format sort correctly as strings.
export function compareTs(a, b) {
  return String(a).localeCompare(String(b))
}

// For <input type="datetime-local">: '2026-01-31-12.05.00.000000' <->
// '2026-01-31T12:05'. Same local time both ways; seconds are dropped.
export function toInputValue(ts) {
  if (isBlank(ts)) return ''
  const m = TS_RE.exec(String(ts).trim())
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : ''
}

export function fromInputValue(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value ?? '').trim())
  return m ? `${m[1]}-${m[2]}-${m[3]}-${m[4]}.${m[5]}.00.000000` : ''
}
