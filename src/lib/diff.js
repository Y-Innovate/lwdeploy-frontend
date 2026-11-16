// A line diff for comparing two template revisions: longest common
// subsequence, fine for the at most 300 lines a side of a template.

// rows of { type: 'same' | 'del' | 'add', text, aNo, bNo } in order
export function diffLines(a, b) {
  const n = a.length
  const m = b.length
  // lcs[i][j]: length of the LCS of a[i..] and b[j..]
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const rows = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'same', text: a[i], aNo: ++i, bNo: ++j })
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ type: 'del', text: a[i], aNo: ++i })
    } else {
      rows.push({ type: 'add', text: b[j], bNo: ++j })
    }
  }
  while (i < n) rows.push({ type: 'del', text: a[i], aNo: ++i })
  while (j < m) rows.push({ type: 'add', text: b[j], bNo: ++j })
  return rows
}

// Side by side: a run of removed lines is paired with the run of added lines
// after it, so a changed line shows next to what it became. Rows of
// { left, right, type } where left and right are { no, text } or null, and
// type is 'same' or 'change'.
export function sideBySide(rows) {
  const out = []
  let k = 0
  while (k < rows.length) {
    if (rows[k].type === 'same') {
      const r = rows[k++]
      out.push({ type: 'same', left: { no: r.aNo, text: r.text }, right: { no: r.bNo, text: r.text } })
      continue
    }
    const dels = []
    const adds = []
    while (k < rows.length && rows[k].type === 'del') dels.push(rows[k++])
    while (k < rows.length && rows[k].type === 'add') adds.push(rows[k++])
    for (let p = 0; p < Math.max(dels.length, adds.length); p++) {
      const d = dels[p]
      const a = adds[p]
      out.push({ type: 'change', left: d ? { no: d.aNo, text: d.text } : null, right: a ? { no: a.bNo, text: a.text } : null })
    }
  }
  return out
}
