import { apiRequest } from './client'

const versionPath = (versionID) => `/versions/${encodeURIComponent(versionID)}`

// O4, owners only (and the CI pipeline). fields: versionName, locType (D,
// U), location, versionDescription
export function registerVersion(appID, fields) {
  return apiRequest('POST', '/versions', { body: { appID, ...fields } })
}

// Change and delete only while isUsed is N (08 53 otherwise)
export function updateVersion(versionID, fields) {
  return apiRequest('PUT', versionPath(versionID), { body: fields })
}

export function deleteVersion(versionID) {
  return apiRequest('DELETE', versionPath(versionID))
}

export function retireVersion(versionID) {
  return apiRequest('POST', `/versionRetirements/${encodeURIComponent(versionID)}`)
}
