import { describe, expect, it } from 'vitest'
import { compareTs, formatRange, formatTs, fromInputValue, isBlank, toInputValue } from './timestamps'

it('formats DB2 timestamps without seconds or conversion', () => {
  expect(formatTs('2026-11-10-21.05.33.123456')).toBe('2026-11-10 21:05')
  expect(formatTs('2026-11-10-21.05.33.123456', { withTime: false })).toBe('2026-11-10')
  expect(formatTs('   ')).toBe('')
  expect(formatTs('')).toBe('')
  expect(formatTs('soon')).toBe('soon')
})

it('formats ranges, shorter within one day', () => {
  expect(formatRange('2026-11-10-09.00.00.000000', '2026-11-10-17.00.00.000000')).toBe('2026-11-10 09:00 - 17:00')
  expect(formatRange('2026-11-10-09.00.00.000000', '2026-11-12-17.00.00.000000'))
    .toBe('2026-11-10 09:00 - 2026-11-12 17:00')
  expect(formatRange('2026-11-10-09.00.00.000000', '')).toBe('2026-11-10 09:00')
})

it('sorts and spots blanks', () => {
  expect(compareTs('2026-11-10-09.00.00.000000', '2026-11-10-10.00.00.000000')).toBeLessThan(0)
  expect(isBlank(null)).toBe(true)
  expect(isBlank(' ')).toBe(true)
})

describe('date-time inputs', () => {
  it('converts DB2 timestamps to input values and back', () => {
    expect(toInputValue('2026-01-31-12.05.59.123456')).toBe('2026-01-31T12:05')
    expect(fromInputValue('2026-01-31T12:05')).toBe('2026-01-31-12.05.00.000000')
    expect(fromInputValue('2026-01-31T12:05:30')).toBe('2026-01-31-12.05.00.000000')
  })

  it('leaves blanks blank', () => {
    expect(toInputValue('')).toBe('')
    expect(toInputValue('  ')).toBe('')
    expect(fromInputValue('')).toBe('')
    expect(fromInputValue(undefined)).toBe('')
  })
})
