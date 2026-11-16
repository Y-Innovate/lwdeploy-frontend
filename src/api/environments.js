import { apiRequest } from './client'

const envPath = (envID) => `/environments/${encodeURIComponent(envID)}`

// One environment with its controls (GET /environments/{envID}, LWDM006 R).
// 404 when it doesn't exist or the user has no role in its application.
export function getEnvironment(envID) {
  return apiRequest('GET', envPath(envID))
}

// O1, owners only. fields: envCode, envName, envDescription, sortOrder
// (0: at the end), promoGate. A new environment needs an administrator's
// controls before it can be deployed to.
export function createEnvironment(appID, fields) {
  return apiRequest('POST', '/environments', { body: { appID, ...fields } })
}

export function updateEnvironment(envID, fields) {
  return apiRequest('PUT', envPath(envID), { body: fields })
}

// Refused with 08 53 while it has deployments
export function deleteEnvironment(envID) {
  return apiRequest('DELETE', envPath(envID))
}
