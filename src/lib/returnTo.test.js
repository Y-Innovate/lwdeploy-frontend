import { expect, it } from 'vitest'
import { rememberReturn, safeReturn } from './returnTo'

const ORIGIN = 'https://t01.example'

it('accepts paths of the app, also as a full URL of this host', () => {
  expect(safeReturn('/lwdeploy/deployment?deplID=1', ORIGIN)).toBe('/lwdeploy/deployment?deplID=1')
  expect(safeReturn('https://t01.example/lwdeploy/app?appID=2', ORIGIN)).toBe('/lwdeploy/app?appID=2')
})

it('drops a trailing slash, which LWW refuses', () => {
  expect(safeReturn('/lwdeploy/', ORIGIN)).toBe('/lwdeploy')
  expect(safeReturn('/lwdeploy', ORIGIN)).toBe('/lwdeploy')
  expect(safeReturn('/lwdeploy/?x=1', ORIGIN)).toBe('/lwdeploy?x=1')
  expect(safeReturn('/lwdeploy/approvals/', ORIGIN)).toBe('/lwdeploy/approvals')
  expect(safeReturn('https://t01.example/lwdeploy/', ORIGIN)).toBe('/lwdeploy')
})

it('refuses anything that leaves the app', () => {
  for (const bad of ['https://evil.example/lwdeploy/', '//evil.example/lwdeploy/', '/otherapp/', '/lwdeployx/', '/lwdeploy//evil', 'javascript:alert(1)',
    '/lwdeploy\\..\\x', '', null, undefined, '/lwdeploy/login', '/lwdeploy/login?failed=1']) {
    expect(safeReturn(bad, ORIGIN)).toBeNull()
  }
})

it('keeps the path for the LWW pages in sessionStorage', () => {
  rememberReturn('/lwdeploy/approvals')
  expect(sessionStorage.getItem('requestedURL')).toBe('/lwdeploy/approvals')
  rememberReturn(null)
  expect(sessionStorage.getItem('requestedURL')).toBeNull()
})
