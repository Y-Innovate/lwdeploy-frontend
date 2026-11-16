import { afterEach, expect, it, vi } from 'vitest'
import { getSpoolText } from './output'
import { ok, stubFetch } from '../test/fetchStub'

afterEach(() => vi.unstubAllGlobals())

it('decodes a part of a spool file into lines', async () => {
  const calls = stubFetch(() => ({ body: ok({ runID: 5, fileNo: 4, firstLineNum: 301, lineCount: 2, moreLines: 'N', spoolText: btoa('A\nB') }) }))
  expect(await getSpoolText(5, 4, 300)).toMatchObject({ firstLineNum: 301, lines: ['A', 'B'], moreLines: 'N' })
  expect(calls[0]).toMatchObject({ path: '/lwdeploy/API/v1/spoolText/5', query: { fileNo: '4', lineNum_since: '300' } })
})

it('leaves lineNum_since out for the first part, and has no lines for an empty file', async () => {
  const calls = stubFetch(() => ({ body: ok({ lineCount: 0, moreLines: 'N', spoolText: '' }) }))
  expect((await getSpoolText(5, 4)).lines).toEqual([])
  expect(calls[0].query).toEqual({ fileNo: '4' })
})
