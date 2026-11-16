import { expect, it } from 'vitest'
import { decodeBase64Utf8 } from './base64'

it('decodes UTF-8 text, also with characters outside ASCII', () => {
  const text = '//STEP1 EXEC PGM=IEFBR14\n//* Gedeeld: €, ü, ¬\n'
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(text)))
  expect(decodeBase64Utf8(b64)).toBe(text)
})

it('copes with nothing and with line breaks in the base64', () => {
  expect(decodeBase64Utf8('')).toBe('')
  expect(decodeBase64Utf8(null)).toBe('')
  expect(decodeBase64Utf8('Ly9B\nQg==')).toBe('//AB')
})
