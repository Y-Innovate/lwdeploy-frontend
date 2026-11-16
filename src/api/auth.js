import { apiRequest, BASE, LOGIN_PATH } from './client'

// The signed-in user (GET /me, LWDC302): userID, email, isAdmin (Y/N) and
// approvalsWaiting, or null without a session. Doesn't send the user to
// sign-in. Without a session LWW answers 404 (see ApiError.isNoSession).
export async function fetchMe() {
  try {
    return await apiRequest('GET', '/me', { signInOn401: false })
  } catch (err) {
    if (err.isNoSession) return null
    throw err
  }
}

// U2: the own notification settings, each Y or N: notifyApprove (an
// approval waits for me), notifyOwn (my deployment is decided or ends),
// notifyApp (a deployment of an application I own ends). Answers GET /me's
// fields. The address isn't sent: it comes from RACF.
export function updateMe({ notifyApprove, notifyOwn, notifyApp }) {
  return apiRequest('PUT', '/me', { body: { notifyApprove, notifyOwn, notifyApp } })
}

// The sign-in page, returning to `returnTo` (a path under /lwdeploy) afterwards
export function signInHref(returnTo) {
  return returnTo ? `${LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}` : LOGIN_PATH
}

// Sign-out: LWW's page logout.html, whose pre-exec program (LWWADPLO) ends
// the session on LWW before the page says so. A full page load, so the app
// forgets the user too.
export const SIGN_OUT_URL = `${BASE}/logout.html`

// Where the Entra sign-in starts: LWW's SSO redirect. Open to every user,
// as RACF sign-in is (lwdeploy/docs/02-use-cases.md, U1)
export const ENTRA_SIGN_IN_URL = `${BASE}/redirect_to_sso_login.html`
