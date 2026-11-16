import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { checkLwwDir, cleanLwwDir } from './lww-dir.js'

let dir

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lwwadmin-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function file(path) {
  mkdirSync(join(dir, path, '..'), { recursive: true })
  writeFileSync(join(dir, path), 'x')
}

test('refuses a folder without API/v1', () => {
  expect(() => checkLwwDir(dir)).toThrow(/not the LWWAdmin folder/)
  expect(() => cleanLwwDir(dir)).toThrow()
})

test('removes the previous build and what public/ holds, and nothing else', () => {
  const pub = mkdtempSync(join(tmpdir(), 'public-'))
  mkdirSync(join(pub, 'board'))
  writeFileSync(join(pub, '.board'), 'x')
  writeFileSync(join(pub, 'auth'), 'x')
  writeFileSync(join(pub, '.API'), 'x') // never, even if public/ had one
  file('API/v1/events')
  file('API/v1/.events')
  file('.API')
  file('index.html')
  file('assets/index-abc.js')
  file('board/.gitignore')
  file('.board')
  file('auth')
  file('oldpage.html')

  cleanLwwDir(dir, pub)
  rmSync(pub, { recursive: true, force: true })

  for (const gone of ['index.html', 'assets', 'board', '.board', 'auth']) {
    expect(existsSync(join(dir, gone))).toBe(false)
  }
  for (const kept of ['API/v1/events', 'API/v1/.events', '.API', 'oldpage.html']) {
    expect(existsSync(join(dir, kept))).toBe(true)
  }
})

test('a second clean is harmless', () => {
  file('API/v1/events')
  cleanLwwDir(dir)
  expect(() => cleanLwwDir(dir)).not.toThrow()
})
