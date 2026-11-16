// Where the build goes: the LWWAdmin folder of the backend repo, which
// python/uploadLWW.py there uploads to the /lwdeploy folder of LWW.
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

export const LWW_DIR = resolve(process.env.LWD_LWW_DIR ?? join(root, '..', 'lwdeploy', 'LWWAdmin'))

// What a build writes: index.html, assets/, and what public/ holds (the LWW
// sign-in pages, the route folders and their .name files). Everything else
// in LWWAdmin, the API placeholders above all, is left alone.
export const PUBLIC_DIR = join(root, 'public')

export function buildOutput(publicDir = PUBLIC_DIR) {
  const fromPublic = existsSync(publicDir) ? readdirSync(publicDir) : []
  return ['index.html', 'assets', ...fromPublic].filter((n) => n !== 'API' && n !== '.API')
}

// The folder must look like LWWAdmin: it has the API placeholders.
export function checkLwwDir(dir = LWW_DIR) {
  if (!existsSync(join(dir, 'API', 'v1'))) {
    throw new Error(`${dir} has no API/v1: not the LWWAdmin folder of lwdeploy. Set LWD_LWW_DIR.`)
  }
  return dir
}

// Removes the previous build, so old hashed assets don't pile up (and are
// deleted on LWW by uploadLWW.py).
export function cleanLwwDir(dir = LWW_DIR, publicDir = PUBLIC_DIR) {
  checkLwwDir(dir)
  for (const name of buildOutput(publicDir)) {
    rmSync(join(dir, name), { recursive: true, force: true })
  }
}
