import { afterEach, expect, it, vi } from 'vitest'
import { cancelDeployment, continueDeployment, deploymentEvents, getDeployment, getDeploymentJcl, requestDeployment } from './deployments'
import { ok, stubFetch } from '../test/fetchStub'

afterEach(() => vi.unstubAllGlobals())

it('requests a deployment with every field, empty ones as empty strings', async () => {
  const calls = stubFetch(() => ({ status: 201, body: ok({ deplID: 8, deplStatus: 'Q' }) }))
  expect(await requestDeployment({ appID: 1, envID: 2, versionID: 3 })).toMatchObject({ deplID: 8 })
  expect(calls[0]).toMatchObject({
    method: 'POST', path: '/lwdeploy/API/v1/deployments',
    body: { appID: 1, envID: 2, versionID: 3, startAfter: '', requestNote: '' },
  })
})

it('puts the deployment ID in the path of get and the actions', async () => {
  const calls = stubFetch(() => ({ body: ok({ deplID: 6 }) }))
  await getDeployment(6)
  await cancelDeployment(6, 'not now')
  await continueDeployment(6, 'RC 8 is fine')
  expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
    'GET /lwdeploy/API/v1/deployments/6', 'POST /lwdeploy/API/v1/cancellations/6', 'POST /lwdeploy/API/v1/continuations/6',
  ])
  expect(calls[2].body).toEqual({ commentText: 'RC 8 is fine' })
})

it('pages the history by eventNo', async () => {
  stubFetch(() => ({ body: ok({ events: Array.from({ length: 20 }, (_, i) => ({ eventNo: i + 1 })) }) }))
  expect((await deploymentEvents.list({ deplID: 6 })).next).toEqual({ eventNo_since: 20 })
})

it('decodes the frozen JCL', async () => {
  const calls = stubFetch(() => ({ body: ok({ deplID: 7, jobNo: 2, lineCount: 2, jcl: btoa('//A\n//B') }) }))
  expect(await getDeploymentJcl(7, 2)).toEqual({ retCode: '00', reasonCode: '00', infoMessage: '', deplID: 7, jobNo: 2, lineCount: 2, text: '//A\n//B' })
  expect(calls[0]).toMatchObject({ path: '/lwdeploy/API/v1/deploymentJcl/7', query: { jobNo: '2' } })
})
