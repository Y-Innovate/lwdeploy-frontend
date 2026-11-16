import { describe, expect, it } from 'vitest'
import { diffLines, sideBySide } from './diff'

describe('diffLines', () => {
  it('keeps common lines and marks the rest', () => {
    expect(diffLines(['a', 'b', 'c'], ['a', 'x', 'c', 'd'])).toEqual([
      { type: 'same', text: 'a', aNo: 1, bNo: 1 },
      { type: 'del', text: 'b', aNo: 2 },
      { type: 'add', text: 'x', bNo: 2 },
      { type: 'same', text: 'c', aNo: 3, bNo: 3 },
      { type: 'add', text: 'd', bNo: 4 },
    ])
  })

  it('handles empty sides and 300 lines a side', () => {
    expect(diffLines([], ['a'])).toEqual([{ type: 'add', text: 'a', bNo: 1 }])
    const a = Array.from({ length: 300 }, (_, i) => `line ${i}`)
    const b = a.map((l, i) => (i % 50 === 0 ? `${l} changed` : l))
    const rows = diffLines(a, b)
    expect(rows.filter((r) => r.type === 'same')).toHaveLength(294)
  })
})

it('pairs removed and added lines side by side', () => {
  const rows = sideBySide(diffLines(['a', 'b', 'c'], ['a', 'x', 'y', 'c']))
  expect(rows.map((r) => [r.type, r.left?.text ?? null, r.right?.text ?? null])).toEqual([
    ['same', 'a', 'a'], ['change', 'b', 'x'], ['change', null, 'y'], ['same', 'c', 'c'],
  ])
})
