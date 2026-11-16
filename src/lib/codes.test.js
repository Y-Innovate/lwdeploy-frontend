import { expect, it } from 'vitest'
import { DEPL_STATUS, FINAL_DEPL_STATUSES, isYes, label } from './codes'

it('translates a code, and shows an unknown one as it is', () => {
  expect(label(DEPL_STATUS, 'u')).toBe('Running')
  expect(label(DEPL_STATUS, ' S ')).toBe('Succeeded')
  expect(label(DEPL_STATUS, 'Z')).toBe('Z')
  expect(label(DEPL_STATUS, null)).toBe('')
})

it('knows Y, in any case and with padding', () => {
  expect(isYes('Y')).toBe(true)
  expect(isYes(' y ')).toBe(true)
  expect(isYes('N')).toBe(false)
  expect(isYes(null)).toBe(false)
})

it('has a word for every final status', () => {
  for (const s of FINAL_DEPL_STATUSES) expect(DEPL_STATUS[s]).toBeTruthy()
})
