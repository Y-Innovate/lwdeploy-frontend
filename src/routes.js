// The app's routes (PLAN.md, "Routes and LWW folders";
// lwdeploy/docs/09-iteration-5.md, "Screens"). IDs go in the query string:
// LWW serves index.html from a folder per route, so paths are fixed.

export const PATHS = {
  home: '/',
  login: '/login',
  app: '/app',
  deploy: '/deploy',
  deployment: '/deployment',
  jcl: '/jcl',
  run: '/run',
  output: '/output',
  approvals: '/approvals',
  template: '/template',
  profile: '/profile',
}

// The administrators' pages (lwdeploy/docs/10-iteration-6.md, 6a): folders
// under admin/ on LWW, in a lazy chunk of their own (pages/admin/AdminApp)
export const ADMIN_PATHS = {
  applications: '/admin',
  application: '/admin/app',
  lists: '/admin/lists',
  settings: '/admin/settings',
  deployments: '/admin/deployments',
}

// The admin navigation; `also`: pages that belong to an item
export const ADMIN_NAV = [
  { path: ADMIN_PATHS.applications, title: 'Applications', icon: 'ti-apps', also: [ADMIN_PATHS.application] },
  { path: ADMIN_PATHS.deployments, title: 'Deployments', icon: 'ti-history', also: [] },
  { path: ADMIN_PATHS.lists, title: 'Allowlists', icon: 'ti-list-check', also: [] },
  { path: ADMIN_PATHS.settings, title: 'Settings', icon: 'ti-settings', also: [] },
]

// Router paths are relative to the basename /lwdeploy
export function linkTo(path, params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.append(k, String(v))
  const s = qs.toString()
  return s ? `${path}?${s}` : path
}
