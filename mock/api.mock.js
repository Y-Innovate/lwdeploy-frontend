import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineMock } from 'vite-plugin-mock-dev-server'
import { createDb } from './db.js'
import { buildSeed } from './seed.js'
import { dispatch } from './routes.js'

// One file for all routes so they share one in-memory database. It is kept
// on globalThis so it survives mock reloads; restart Vite to reset it.
const db = (globalThis.__lwdMockDb ??= createDb(buildSeed()))

const BASE = '/lwdeploy'
const PUBLIC = join(dirname(dirname(fileURLToPath(import.meta.url))), 'public')
const API = `${BASE}/API/v1`

// Stands in for LWW's session cookie, whose name the app never needs to know
const COOKIE = 'LWDMOCKSESSION'

function sessionOf(req) {
  const m = /(?:^|;\s*)LWDMOCKSESSION=([^;]+)/.exec(req.headers.cookie ?? '')
  return m ? m[1] : null
}

function send(res, { status, body }) {
  res.statusCode = status
  if (body === '') return res.end()
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function setCookie(res, token) {
  res.setHeader('Set-Cookie', token
    ? `${COOKIE}=${token}; Path=${BASE}; HttpOnly; SameSite=Lax`
    : `${COOKIE}=; Path=${BASE}; Max-Age=0`)
}

function redirect(res, location) {
  res.statusCode = 302
  res.setHeader('Location', location)
  res.end()
}

// LWW's own answer to a wrong userid or passphrase (wording approximate)
function sendWrongCombination(res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html')
  res.end('<!DOCTYPE html><html><body><p>The combination of userid and password is wrong.</p>' +
    '<p><em>Mock of LWW\'s page: go back to sign in again.</em></p></body></html>')
}

// A page of public/ as LWW serves it after its pre-exec program
function sendLwwPage(res, name, nextPage) {
  const html = readFileSync(join(PUBLIC, name), 'utf8').replaceAll('&NEXTPAGE;', nextPage ? 'true' : 'false')
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html')
  res.end(html)
}

export default defineMock([
  // All API calls, routed by mock/routes.js
  {
    url: `${API}/*path`,
    method: ['GET', 'POST', 'PUT', 'DELETE'],
    delay: [60, 200],
    response(req, res) {
      const path = req.url.split('?')[0].slice(API.length)
      send(res, dispatch(db, {
        method: req.method, path, user: db.userOf(sessionOf(req)), query: req.query, body: req.body,
      }))
    },
  },

  // LWW's sign-in, imitated with the real pages of public/: LWW runs its
  // sign-in program, then serves the page with &NEXTPAGE; filled in. After a
  // wrong passphrase LWW shows a page of its own instead, from which the user
  // goes back to the sign-in page; so does the mock.
  {
    url: `${BASE}/process_login.html`,
    method: 'POST',
    response(req, res) {
      const { username, password } = req.body ?? {}
      const token = db.signIn(username, password)
      if (!token) return sendWrongCombination(res)
      setCookie(res, token)
      sendLwwPage(res, 'process_login.html', true)
    },
  },
  {
    url: `${BASE}/redirect_to_sso_login.html`,
    method: 'GET',
    response(req, res) {
      // Entra is skipped: straight to LWW's callback page, signed in as the
      // administrator of the seed
      setCookie(res, db.signInEntra())
      redirect(res, `${BASE}/auth?code=mock&state=mock`)
    },
  },
  {
    url: `${BASE}/auth`,
    method: 'GET',
    response(req, res) {
      sendLwwPage(res, 'auth', Boolean(db.userOf(sessionOf(req))))
    },
  },
  // LWW's sign-out: LWWADPLO ends the session, then LWW serves the page
  {
    url: `${BASE}/logout.html`,
    method: 'GET',
    response(req, res) {
      db.signOut(sessionOf(req))
      setCookie(res, '')
      sendLwwPage(res, 'logout.html', true)
    },
  },
])
