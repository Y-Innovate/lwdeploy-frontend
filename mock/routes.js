// The API routes of the mock backend, shared by the Vite mocks
// (api.mock.js) and the page tests (src/test/backend.js).
// Each route: [method, path pattern under /lwdeploy/API/v1, handler].
// Every path needs a session: LWD has no anonymous paths but POST /token,
// which the UI doesn't use (lwdeploy/docs/04-api.md, Access).
// handler(db, { user, id, query, body }) returns { status, body }.

export const ROUTES = [
  ['GET', '/me', (db, r) => db.me(r.user)],
  ['PUT', '/me', (db, r) => db.updateMe(r.user, r.body)],
  ['GET', '/applications/:id', (db, r) => db.getApplication(r.user, r.id)],
  ['GET', '/applications', (db, r) => db.listApplications(r.user, r.query)],
  ['GET', '/environments/:id', (db, r) => db.getEnvironment(r.user, r.id)],
  ['GET', '/environments', (db, r) => db.listEnvironments(r.user, r.query)],
  ['GET', '/versions', (db, r) => db.listVersions(r.user, r.query)],
  // Owners (mock/owner.js)
  ['POST', '/environments', (db, r) => db.newEnvironment(r.user, r.body)],
  ['PUT', '/environments/:id', (db, r) => db.updateEnvironment(r.user, r.id, r.body)],
  ['DELETE', '/environments/:id', (db, r) => db.deleteEnvironment(r.user, r.id)],
  ['GET', '/versions/:id', (db, r) => db.getVersion(r.user, r.id)],
  ['POST', '/versions', (db, r) => db.newVersion(r.user, r.body)],
  ['PUT', '/versions/:id', (db, r) => db.updateVersion(r.user, r.id, r.body)],
  ['DELETE', '/versions/:id', (db, r) => db.deleteVersion(r.user, r.id)],
  ['POST', '/versionRetirements/:id', (db, r) => db.retireVersion(r.user, r.id)],
  ['GET', '/variables', (db, r) => db.listVariables(r.user, r.query)],
  ['POST', '/variables', (db, r) => db.newVariable(r.user, r.body)],
  ['PUT', '/variables/:id', (db, r) => db.updateVariable(r.user, r.id, r.body)],
  ['DELETE', '/variables/:id', (db, r) => db.deleteVariable(r.user, r.id)],
  ['GET', '/templates/:id', (db, r) => db.getTemplate(r.user, r.id)],
  ['PUT', '/templates/:id', (db, r) => db.updateTemplate(r.user, r.id, r.body)],
  ['DELETE', '/templates/:id', (db, r) => db.deleteTemplate(r.user, r.id)],
  ['GET', '/templates', (db, r) => db.listTemplates(r.user, r.query)],
  ['POST', '/templates', (db, r) => db.newTemplate(r.user, r.body)],
  ['GET', '/templateRevisions', (db, r) => db.listTemplateRevisions(r.user, r.query)],
  ['GET', '/templateJcl/:id', (db, r) => db.getTemplateJcl(r.user, r.id, r.query)],
  ['POST', '/templateJcl/:id', (db, r) => db.newTemplateJcl(r.user, r.id, r.body)],
  ['GET', '/deployments/:id', (db, r) => db.getDeployment(r.user, r.id)],
  ['GET', '/deployments', (db, r) => db.listDeployments(r.user, r.query)],
  ['POST', '/deployments', (db, r) => db.newDeployment(r.user, r.body)],
  ['GET', '/deploymentJobs', (db, r) => db.listDeploymentJobs(r.user, r.query)],
  ['GET', '/deploymentJcl/:id', (db, r) => db.getDeploymentJcl(r.user, r.id, r.query)],
  ['GET', '/approvalRequests', (db, r) => db.listApprovalRequests(r.user, r.query)],
  ['GET', '/approvals', (db, r) => db.listApprovals(r.user, r.query)],
  ['POST', '/approvals', (db, r) => db.newApproval(r.user, r.body)],
  ['GET', '/jobRuns', (db, r) => db.listJobRuns(r.user, r.query)],
  ['GET', '/jobSteps', (db, r) => db.listJobSteps(r.user, r.query)],
  ['GET', '/spoolFiles', (db, r) => db.listSpoolFiles(r.user, r.query)],
  ['GET', '/spoolText/:id', (db, r) => db.getSpoolText(r.user, r.id, r.query)],
  ['GET', '/deploymentEvents', (db, r) => db.listDeploymentEvents(r.user, r.query)],
  ['POST', '/cancellations/:id', (db, r) => db.cancelDeployment(r.user, r.id, r.body)],
  ['POST', '/retries/:id', (db, r) => db.retryDeployment(r.user, r.id, r.body)],
  ['POST', '/continuations/:id', (db, r) => db.continueDeployment(r.user, r.id, r.body)],
  // Administrators (mock/admin.js)
  ['GET', '/admin/applications/:id', (db, r) => db.adminGetApplication(r.user, r.id)],
  ['PUT', '/admin/applications/:id', (db, r) => db.adminUpdateApplication(r.user, r.id, r.body)],
  ['DELETE', '/admin/applications/:id', (db, r) => db.adminDeleteApplication(r.user, r.id)],
  ['GET', '/admin/applications', (db, r) => db.adminListApplications(r.user, r.query)],
  ['POST', '/admin/applications', (db, r) => db.adminNewApplication(r.user, r.body)],
  ['PUT', '/admin/environmentControls/:id', (db, r) => db.adminSetEnvironmentControls(r.user, r.id, r.body)],
  ['GET', '/admin/refTables', (db, r) => db.adminListRefTables(r.user, r.query)],
  ['POST', '/admin/refTables', (db, r) => db.adminNewRefTable(r.user, r.body)],
  ['PUT', '/admin/refTables/:id', (db, r) => db.adminUpdateRefTable(r.user, r.id, r.query, r.body)],
  ['DELETE', '/admin/refTables/:id', (db, r) => db.adminDeleteRefTable(r.user, r.id, r.query)],
  ['GET', '/admin/deployments', (db, r) => db.adminListDeployments(r.user, r.query)],
  ['POST', '/admin/stuckRuns/:id', (db, r) => db.adminMarkStuck(r.user, r.id)],
]

// Without a session LWW answers 404 on a non-public path, as seen on t01,
// without the backend's envelope
export const NO_SESSION = { status: 404, body: '' }
const UNKNOWN = { status: 404, body: { retCode: '08', reasonCode: '99', infoMessage: 'Unknown path' } }

// Answers one call; path is relative to /lwdeploy/API/v1
export function dispatch(db, { method, path, user, query = {}, body = {} }) {
  for (const [m, pattern, handler] of ROUTES) {
    if (m !== method) continue
    const re = new RegExp(`^${pattern.replace(':id', '([^/]+)')}$`)
    const match = re.exec(path)
    if (!match) continue
    if (!user) return NO_SESSION
    // The submit task, the jobs and the result step catch up with the clock
    db.progress?.()
    return handler(db, { user, id: match[1] && decodeURIComponent(match[1]), query, body: body ?? {} })
  }
  return UNKNOWN
}
