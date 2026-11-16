import { expect, it } from 'vitest'
import { jclStats } from './jcl'

it('counts lines, lines over 80 and statements past column 71', () => {
  expect(jclStats(`//S EXEC PGM=X\n${'x'.repeat(81)}\n//${'A'.repeat(70)}\n//* ${'c'.repeat(70)}\n`))
    .toEqual({ lines: 4, over80: 1, past71: 1 })
})
