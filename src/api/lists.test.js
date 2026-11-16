import { afterEach, describe, expect, it, vi } from 'vitest'
import { deployments, environments, versions } from './lists'
import { err, ok, stubFetch } from '../test/fetchStub'

afterEach(() => vi.unstubAllGlobals())

const rows = (n, from) => Array.from({ length: n }, (_, i) => ({ deplID: from - i }))

describe('lists', () => {
  it('asks for the next page with the key of the last row', async () => {
    const calls = stubFetch(({ query }) => ({ body: ok({ deployments: query.deplID_since ? rows(5, 80) : rows(20, 100) }) }))
    const first = await deployments.list({ appID: 1 })
    expect(first.rows).toHaveLength(20)
    expect(first.next).toEqual({ deplID_since: 81 })
    const second = await deployments.list({ appID: 1 }, first.next)
    expect(second.next).toBeNull()
    expect(calls[1]).toMatchObject({ path: '/lwdeploy/API/v1/deployments', query: { appID: '1', deplID_since: '81' } })
  })

  it('collects all pages with listAll', async () => {
    stubFetch(({ query }) => ({ body: ok({ deployments: query.deplID_since ? rows(3, 80) : rows(20, 100) }) }))
    expect(await deployments.listAll({ appID: 1 })).toHaveLength(23)
  })

  it('never pages a list without since keys', async () => {
    stubFetch(() => ({ body: ok({ environments: Array.from({ length: 20 }, (_, i) => ({ envID: i })) }) }))
    expect((await environments.list({ appID: 1 })).next).toBeNull()
  })

  it('takes an empty array sent as null as no rows', async () => {
    stubFetch(() => ({ body: ok({ versions: null }) }))
    expect(await versions.list({ appID: 1 })).toEqual({ rows: [], next: null, meta: {} })
  })

  it('throws a 404: the application is unknown or not visible', async () => {
    stubFetch(() => err(404, '04', '01', 'Application not found'))
    await expect(versions.list({ appID: 99 })).rejects.toMatchObject({ status: 404 })
  })
})
