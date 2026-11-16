import { apiRequest } from './client'

// One application with the user's roles in it (GET /applications/{appID},
// LWDM304). 404 when it doesn't exist or the user has no role in it.
export function getApplication(appID) {
  return apiRequest('GET', `/applications/${encodeURIComponent(appID)}`)
}
