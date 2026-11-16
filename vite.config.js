import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { mockDevServerPlugin } from 'vite-plugin-mock-dev-server'
import { checkLwwDir, LWW_DIR } from './scripts/lww-dir.js'

// .../node_modules/@scope/pkg/... -> vendor-scope-pkg, .../node_modules/pkg/... -> vendor-pkg
function vendorChunk(id) {
  const match = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/g)
  if (!match) return null
  const pkg = match.at(-1).slice('node_modules/'.length)
  return `vendor-${pkg.replace('@', '').replace('/', '-')}`
}

// The app is served from /lwdeploy by LWW, and by Vite in dev. In dev,
// /lwdeploy/API/v1 and LWW's sign-in pages are answered by the mocks in mock/.
export default defineConfig(({ command, isPreview }) => ({
  base: '/lwdeploy/',
  plugins: [
    react(),
    tailwindcss(),
    mockDevServerPlugin({
      prefix: [
        '^/lwdeploy/API/',
        '^/lwdeploy/process_login\\.html',
        '^/lwdeploy/redirect_to_sso_login\\.html',
        '^/lwdeploy/auth',
        '^/lwdeploy/logout\\.html',
      ],
      include: ['**/*.mock.js'],
      log: 'info',
    }),
  ],
  server: {
    // 5174 is ctflww-frontend's, so both can run at once
    port: 5175,
  },
  build: {
    // Into the backend repo's LWWAdmin, next to the API placeholders, which
    // must stay: no emptying. npm run prebuild removes the previous build.
    outDir: command === 'build' || isPreview ? checkLwwDir(LWW_DIR) : 'dist',
    emptyOutDir: false,
    rolldownOptions: {
      output: {
        // Each npm package in its own assets/vendor-<package>-[hash].js, so a
        // change in our own code doesn't invalidate the cached vendor files.
        codeSplitting: {
          groups: [{ debugName: 'vendor', name: vendorChunk, test: /node_modules/ }],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}', 'mock/**/*.test.js', 'scripts/**/*.test.js'],
  },
}))
