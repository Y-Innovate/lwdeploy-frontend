import { apiRequest } from './client'

// Backend lists return at most 20 rows; the next page is requested with the
// keys of the last row as <key>_since. Fewer than 20 rows means the end.
export const PAGE_SIZE = 20

// path: a string, or a function of the filters for an ID in the path.
// since: [query parameter, field of the last row] pairs; none for lists that
// never page (environments: at most 20 per application).
export function defineList({ path, listKey, since = [] }) {
  const pathOf = typeof path === 'function' ? path : () => path

  // The LWD list modules answer 00 00 with no rows, so a 404 means that the
  // parent (an application) wasn't found or isn't visible, and is thrown.
  async function list(filters = {}, sinceKeys = {}) {
    const data = await apiRequest('GET', pathOf(filters), { query: { ...filters, ...sinceKeys } })
    // LWW may send an empty array as null
    const rows = Array.isArray(data[listKey]) ? data[listKey] : []
    const next = since.length && rows.length >= PAGE_SIZE ? sinceFrom(rows[rows.length - 1]) : null
    const { [listKey]: _rows, retCode: _r, reasonCode: _c, infoMessage: _i, ...meta } = data
    return { rows, next, meta }
  }

  function sinceFrom(row) {
    return Object.fromEntries(since.map(([param, field]) => [param, row[field]]))
  }

  async function listAll(filters = {}, maxPages = 50) {
    const all = []
    let sinceKeys = {}
    for (let page = 0; page < maxPages; page++) {
      const { rows, next } = await list(filters, sinceKeys)
      all.push(...rows)
      if (!next) break
      sinceKeys = next
    }
    return all
  }

  return { path, listKey, since, list, listAll }
}

// M1: by appID
export const applications = defineList({
  path: '/applications', listKey: 'applications', since: [['appID_since', 'appID']],
})
// M1, M2: in order, with the inventory; never more than 20
export const environments = defineList({ path: '/environments', listKey: 'environments' })
// M2, D1: newest first
export const versions = defineList({
  path: '/versions', listKey: 'versions', since: [['versionID_since', 'versionID']],
})
// M3: newest first; appID 0 only with requestedBy_filter = own userid
export const deployments = defineList({
  path: '/deployments', listKey: 'deployments', since: [['deplID_since', 'deplID']],
})
