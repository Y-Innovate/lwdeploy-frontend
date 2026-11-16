import { BASE } from '../api/client'

// The page to return to after sign-in, from ?requestedURL= (LWW's login
// redirect, LWWADPLR) or ?returnTo= (the app's own links). Only paths of this
// app are accepted, so a crafted link can't send anyone elsewhere; anything
// else gives null.
export function safeReturn(value, origin = window.location.origin) {
  if (typeof value !== 'string' || !value) return null
  let path = value
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      const u = new URL(value)
      if (u.origin !== origin) return null
      path = u.pathname + u.search
    } catch {
      return null
    }
  }
  if (!/^\/lwdeploy(\/|\?|$)/.test(path) || path.includes('//') || path.includes('\\')) return null
  // LWW refuses paths that end in "/": /lwdeploy/ becomes /lwdeploy
  path = path.replace(/\/+(\?|$)/, '$1')
  if (path === `${BASE}/login` || path.startsWith(`${BASE}/login?`)) return null
  return path
}

// Kept for LWW's process_login.html and auth pages, which go there after
// sign-in. Only the path is stored; never a passphrase.
export function rememberReturn(path) {
  if (path) sessionStorage.setItem('requestedURL', path)
  else sessionStorage.removeItem('requestedURL')
}
