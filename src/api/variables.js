import { apiRequest } from './client'
import { defineList } from './lists'

// One level: application (appID only), environment (envID) or version
// (versionID); by varID
export const variables = defineList({
  path: '/variables', listKey: 'variables', since: [['varID_since', 'varID']],
})

// Owners only. level: { appID, envID?, versionID? }; fields: varName,
// varValue, varDescription. Values are never secret.
export function createVariable(level, fields) {
  return apiRequest('POST', '/variables', { body: { ...level, ...fields } })
}

export function updateVariable(varID, fields) {
  return apiRequest('PUT', `/variables/${encodeURIComponent(varID)}`, { body: fields })
}

export function deleteVariable(varID) {
  return apiRequest('DELETE', `/variables/${encodeURIComponent(varID)}`)
}
