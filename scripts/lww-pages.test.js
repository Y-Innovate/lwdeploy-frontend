import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { PUBLIC_DIR } from './lww-dir.js'

// Runs the script of an LWW page of public/ as LWW would serve it, with
// &NEXTPAGE; filled in; returns where the page sends the browser.
function run(name, nextPage, requested) {
  const html = readFileSync(join(PUBLIC_DIR, name), 'utf8').replaceAll('&NEXTPAGE;', nextPage)
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1]
  const store = new Map(requested === undefined ? [] : [['requestedURL', requested]])
  const sessionStorage = {
    getItem: (k) => store.get(k) ?? null,
    removeItem: (k) => store.delete(k),
  }
  const replace = vi.fn()
  new Function('window', 'sessionStorage', script)({ location: { replace } }, sessionStorage)
  expect(store.has('requestedURL')).toBe(false)
  return replace.mock.calls[0][0]
}

describe.each([
  ['process_login.html', '/lwdeploy'],
  ['auth', '/lwdeploy'],
])('%s', (name, fallback) => {
  it('goes to the requested page after sign-in', () => {
    expect(run(name, 'true', '/lwdeploy/deployment?deplID=1')).toBe('/lwdeploy/deployment?deplID=1')
  })

  it('goes to its default page without one, or with one outside the app', () => {
    expect(run(name, 'true')).toBe(fallback)
    expect(run(name, 'true', 'https://evil.example/')).toBe(fallback)
    expect(run(name, 'true', '/lwdeploy//evil.example')).toBe(fallback)
  })

  it('drops a trailing slash, which LWW refuses', () => {
    expect(run(name, 'true', '/lwdeploy/')).toBe('/lwdeploy')
    expect(run(name, 'true', '/lwdeploy/run/?runID=1')).toBe('/lwdeploy/run?runID=1')
    expect(run(name, 'true', '/lwdeployx')).toBe(fallback)
  })

  it('goes back to the sign-in page otherwise', () => {
    expect(run(name, 'false', '/lwdeploy/approvals')).toBe('/lwdeploy/login?failed=1')
  })
})

it('points the login redirect at the React sign-in page, and the Entra button at the SSO redirect', () => {
  expect(readFileSync(join(PUBLIC_DIR, 'redirect_to_login.html'), 'utf8')).toBe('/lwdeploy/login<% LINK(LWWADPLR) %>')
  // Only LWWADPLS, as fixed on t01: LWWADPLR there broke the redirect to Entra
  const sso = readFileSync(join(PUBLIC_DIR, 'redirect_to_sso_login.html'), 'utf8')
  expect(sso).toMatch(/^<% LINK\(LWWADPLS\) %>&AUTHEPV2;\?client_id=&CLIENTID;/)
  expect(sso).not.toContain('LWWADPLR')
})

it('has no page that sends the browser to a path ending in a slash', () => {
  for (const name of ['process_login.html', 'auth']) {
    // <base href="/lwdeploy/"> must end in a slash; it is never navigated to
    const html = readFileSync(join(PUBLIC_DIR, name), 'utf8').replace(/<base [^>]*>/, '')
    expect(html).not.toMatch(/['"]\/lwdeploy\/['"]/)
  }
})

describe('logout.html', () => {
  const page = () => readFileSync(join(PUBLIC_DIR, 'logout.html'), 'utf8')

  it('has LWW end the session with LWWADPLO, never from a cache', () => {
    const meta = readFileSync(join(PUBLIC_DIR, '.logout.html'), 'utf8')
    expect(meta).toMatch(/^\s+preexecLoadModule: "LWWADPLO"$/m)
    expect(meta).toMatch(/^\s+preventCache: "Y"$/m)
    expect(meta).toMatch(/^\s+transaction: "LWBL"$/m)
  })

  it('says so, and links back to the sign-in page', () => {
    expect(page()).toContain('You have been signed out')
    expect(page()).toContain('href="/lwdeploy/login"')
  })

  it('forgets the page to return to after sign-in', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(page())[1]
    const removeItem = vi.fn()
    new Function('sessionStorage', script)({ removeItem })
    expect(removeItem).toHaveBeenCalledWith('requestedURL')
  })

  it('has no & that LWW could take for a symbol to fill in', () => {
    expect(page()).not.toContain('&')
  })
})

describe('route folders', () => {
  // 'admin/.app': the folder app inside admin
  const meta = (name) => readFileSync(join(PUBLIC_DIR, name.includes('/') ? name : `.${name}`), 'utf8')
  const routes = ['app', 'template', 'profile', 'deploy', 'deployment', 'jcl', 'run', 'output', 'approvals', 'admin', 'admin/.app', 'admin/.lists', 'admin/.settings', 'admin/.deployments']

  it('run under LWDU and send a request without a session to the sign-in page', () => {
    for (const r of routes) {
      expect(meta(r)).toMatch(/^\s+defaultTran: LWDU$/m)
      expect(meta(r)).toMatch(/^\s+loginRedirectWebpageId: LD000003$/m)
      expect(meta(r)).toMatch(/^\s+defaultWebpageId: LD000001$/m)
    }
  })

  it('keep the sign-in page and what loads before sign-in on LWD\u2019s public LWDP', () => {
    expect(meta('login')).toMatch(/^\s+defaultTran: LWDP$/m)
    expect(meta('login')).not.toContain('loginRedirectWebpageId')
    expect(meta('assets')).toMatch(/^\s+defaultTran: LWDP$/m)
    expect(meta('index.html')).toMatch(/^\s+transaction: "LWDP"$/m)
  })

  it('leave LWW\u2019s own sign-in pages on LWBL', () => {
    for (const page of ['process_login.html', 'redirect_to_login.html', 'redirect_to_sso_login.html', 'auth', 'logout.html']) {
      expect(meta(page)).toMatch(/^\s+transaction: "LWBL"$/m)
    }
  })
})
