import { afterEach, expect, it, vi } from 'vitest'
import { err, ok, stubFetch } from '../test/fetchStub'
import { getTemplateJcl, saveTemplateJcl } from './templates'

afterEach(() => vi.unstubAllGlobals())

it('sends the JCL as multipart, base64 of UTF-8, without a JSON content type', async () => {
  const calls = stubFetch(() => ({ status: 201, body: ok({ revision: 4, warningCount: 0 }) }))
  expect(await saveTemplateJcl(1, '//S EXEC PGM=X\n//* é', 'Note')).toMatchObject({ revision: 4 })
  expect(calls[0]).toMatchObject({ method: 'POST', path: '/lwdeploy/API/v1/templateJcl/1' })
  expect(calls[0].body).toEqual({ jcl: btoa(String.fromCharCode(...new TextEncoder().encode('//S EXEC PGM=X\n//* é'))), changeNote: 'Note' })
  const init = fetch.mock.calls[0][1]
  expect(init.body).toBeInstanceOf(FormData)
  expect(init.headers['Content-Type']).toBeUndefined()
})

it('decodes the JCL of a revision, and leaves out revision 0', async () => {
  const calls = stubFetch(() => ({ body: ok({ revision: 3, lineCount: 2, jcl: btoa('//A\n//B') }) }))
  expect(await getTemplateJcl(1)).toMatchObject({ revision: 3, text: '//A\n//B' })
  expect(calls[0].query).toEqual({})
})

it('throws a refusal with the line it names', async () => {
  stubFetch(() => err(400, '08', '56', 'Line 1: a JOB statement; LWD writes it'))
  await expect(saveTemplateJcl(1, '//X JOB', '')).rejects.toMatchObject({ isJclRefused: true, infoMessage: expect.stringContaining('Line 1') })
})
