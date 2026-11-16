// npm "prebuild": removes the previous build from LWWAdmin.
import { cleanLwwDir, LWW_DIR } from './lww-dir.js'

cleanLwwDir()
console.log(`Removed the previous build from ${LWW_DIR}`)
