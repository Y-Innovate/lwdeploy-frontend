// In-memory stand-in for the LWD backend: the user operations with the
// checks and reason codes of the LWDMnnn modules (headers in
// lwdeploy/COBOL), the HTTP mapping of the LWDCnnn wrappers, and the rules
// of lwdeploy/docs/04-api.md. Every operation returns { status, body }.
// F1 has the session and GET /me, F2 the lists of the start page and the
// application page, F3 the deployments (deployments.js); F4 and F5 add theirs,
// F12 PUT /me; F7 and F8 the administrators' operations (admin.js), F9 the owners'
// (owner.js), F10 the templates (templates.js).
import { ts } from './clock.js'
import { createAdmin } from './admin.js'
import { createDeployments } from './deployments.js'
import { createOwner } from './owner.js'
import { createTemplates } from './templates.js'
import { int, ok, page, randomCode, refuse, run, text, upper } from './util.js'

export { httpStatus, PAGE_SIZE } from './util.js'

export function createDb(seed, clock = () => new Date()) {
  const d = structuredClone(seed)
  const sessions = new Map()
  const now = () => ts(clock())

  // ---- Roles (FACILITY <GRPPRFX>.<group> in CICS) ---------------------------
  const isAdmin = (userID) => d.admins.includes(upper(userID))
  const inGroup = (userID, group) => Boolean(group) && (d.connects[upper(userID)] ?? []).includes(group)

  // GET /me: deployments waiting for this user's approval, as AP1 lists them
  // (not their own request, not decided by them already)
  function approvalsWaiting(userID) {
    return d.deployments.filter((dp) => dp.deplStatus === 'W' && inGroup(userID, dp.approverGroup) &&
      dp.createdBy !== userID && !d.approvals.some((a) => a.deplID === dp.deplID && a.userID === userID)).length
  }

  // The first call of a userid creates its user row (U1)
  function userRow(userID) {
    let u = d.users.find((x) => x.userID === userID)
    if (!u) {
      u = { userID, email: '', notifyApprove: 'Y', notifyOwn: 'Y', notifyApp: 'N' }
      d.users.push(u)
    }
    return u
  }

  // Roles in an application (LWDSECP): member = access group, owner =
  // owner group, approver = approver group of one of its environments
  const appOf = (appID) => d.applications.find((a) => a.appID === int(appID))
  const envsOf = (appID) => d.environments.filter((e) => e.appID === appID).sort((a, b) => a.sortOrder - b.sortOrder || a.envID - b.envID)
  function rolesIn(userID, app) {
    const member = inGroup(userID, app.accessGroup)
    const owner = inGroup(userID, app.ownerGroup)
    const approver = envsOf(app.appID).some((e) => inGroup(userID, e.approverGroup))
    return { member, owner, approver, any: member || owner || approver }
  }
  const yn = (b) => (b ? 'Y' : 'N')

  // The application, if the user has a role in it; 04 01 otherwise, so the
  // API doesn't tell which applications exist (LWDM206 R105-REQUIRE-SEE)
  function seeApp(userID, appID) {
    const app = appOf(appID)
    // An administrator may see every application (R100-APP-ROLES)
    if (!app || !(rolesIn(userID, app).any || isAdmin(userID))) refuse('04', '01', 'Application not found')
    return app
  }

  // The inventory as ENVIRONMENTS keeps it: the version of the last
  // deployment that succeeded; H when one failed or was cancelled after it
  // had started; the deployment that holds the environment (running, or
  // failed and not cancelled yet)
  function inventory(env) {
    const deps = d.deployments.filter((x) => x.envID === env.envID).sort((a, b) => a.deplID - b.deplID)
    const current = deps.filter((x) => x.deplStatus === 'S').at(-1)
    const later = deps.filter((x) => x.deplID > (current?.deplID ?? 0) && x.startedDate && ['F', 'C'].includes(x.deplStatus))
    const active = deps.find((x) => ['U', 'F'].includes(x.deplStatus))
    const version = current && d.versions.find((v) => v.versionID === current.versionID)
    return {
      envState: later.length ? 'H' : current ? 'O' : 'N',
      currentVersionID: current?.versionID ?? 0,
      currentVersionName: version?.versionName ?? '',
      currentDeplID: current?.deplID ?? 0,
      deployedDate: current?.endedDate ?? '',
      activeDeplID: active?.deplID ?? 0,
    }
  }

  const deploymentRow = (x) => {
    const app = appOf(x.appID)
    const env = d.environments.find((e) => e.envID === x.envID)
    const version = d.versions.find((v) => v.versionID === x.versionID)
    return {
      deplID: x.deplID, appID: x.appID, appCode: app.appCode, envID: x.envID, envCode: env.envCode,
      versionID: x.versionID, versionName: version.versionName, deplStatus: x.deplStatus, startAfter: x.startAfter,
      requestedBy: x.createdBy, requestedDate: x.createdDate, endedDate: x.endedDate,
    }
  }

  // One environment as LWDM006 R and the controls of A2 answer it
  function environmentRow(userID, e) {
    const member = inGroup(userID, appOf(e.appID).accessGroup)
    const { envID, appID, envCode, envName, envDescription, sortOrder, promoGate, deployUser, approvalReq, approverGroup,
      approvalCount, deployerGroup, execNode, createdBy, createdDate, updatedBy, updatedDate } = e
    return {
      envID, appID, envCode, envName, envDescription, sortOrder, promoGate, deployUser, approvalReq, approverGroup,
      approvalCount, deployerGroup, execNode, ...inventory(e),
      canDeploy: yn(member && Boolean(e.deployUser) && (!e.deployerGroup || inGroup(userID, e.deployerGroup))),
      canApprove: yn(e.approvalReq === 'Y' && inGroup(userID, e.approverGroup)),
      createdBy, createdDate, updatedBy, updatedDate,
    }
  }

  const templates = createTemplates({ d, clock, inGroup, appOf, seeApp })
  const { frozenFor, ...templateOps } = templates
  const deployments = createDeployments({ d, clock, inGroup, isAdmin, rolesIn, appOf, seeApp, frozenFor })
  const admin = createAdmin({ d, clock, isAdmin, appOf, environmentRow })
  const owner = createOwner({ d, clock, inGroup, appOf, envsOf, seeApp, environmentRow })

  return {
    ...deployments,
    ...admin,
    ...owner,
    ...templateOps,
    data: d,
    now,
    isAdmin,
    inGroup,

    // ---- LWW's session --------------------------------------------------------
    signIn(userID, passphrase) {
      const id = upper(userID)
      if (!/^[A-Z#$@][A-Z0-9#$@]{0,7}$/.test(id) || !text(passphrase) || /^wrong/i.test(passphrase)) return null
      const token = randomCode(24)
      sessions.set(token, id)
      return token
    },
    // Entra in dev: no Microsoft, straight to a mapped userid
    signInEntra(userID = d.admins[0]) {
      const token = randomCode(24)
      sessions.set(token, upper(userID))
      return token
    },
    signOut(token) {
      sessions.delete(token)
    },
    userOf(token) {
      return token ? sessions.get(token) ?? null : null
    },

    // ---- U1 -------------------------------------------------------------------
    me(userID) {
      const u = userRow(userID)
      return ok({
        userID: u.userID,
        email: u.email,
        notifyApprove: u.notifyApprove,
        notifyOwn: u.notifyOwn,
        notifyApp: u.notifyApp,
        isAdmin: isAdmin(userID) ? 'Y' : 'N',
        approvalsWaiting: approvalsWaiting(userID),
      })
    },

    // ---- U2 -------------------------------------------------------------------
    // PUT /me (LWDM002 U): the three notification settings of the own row,
    // each Y or N (08 02); the address comes from RACF and isn't changed
    updateMe(userID, body) {
      return run(() => {
        const u = userRow(userID)
        const fields = ['notifyApprove', 'notifyOwn', 'notifyApp']
        const values = Object.fromEntries(fields.map((f) => [f, upper(body[f])]))
        const wrong = fields.find((f) => !['Y', 'N'].includes(values[f]))
        if (wrong) refuse('08', '02', `${wrong}: Y or N`)
        Object.assign(u, values)
        return this.me(userID)
      })
    },

    // ---- M1, M2 ---------------------------------------------------------------
    // GET /applications (LWDM204): the ones with a role, by appID
    listApplications(userID, query) {
      const since = int(query.appID_since)
      const rows = d.applications
        .filter((a) => a.appID > since && rolesIn(userID, a).any)
        .sort((a, b) => a.appID - b.appID)
        .map((a) => {
          const r = rolesIn(userID, a)
          return { appID: a.appID, appCode: a.appCode, appName: a.appName, isMember: yn(r.member), isOwner: yn(r.owner), isApprover: yn(r.approver) }
        })
      return ok({ applications: page(rows) })
    },

    // GET /applications/{appID} (LWDM304)
    getApplication(userID, appID) {
      return run(() => {
        const a = seeApp(userID, appID)
        const r = rolesIn(userID, a)
        const { appID: id, appCode, appName, appDescription, accessGroup, ownerGroup, createdBy, createdDate, updatedBy, updatedDate } = a
        return ok({ appID: id, appCode, appName, appDescription, accessGroup, ownerGroup,
          isMember: yn(r.member), isOwner: yn(r.owner), isApprover: yn(r.approver), createdBy, createdDate, updatedBy, updatedDate })
      })
    },

    // GET /environments?appID= (LWDM206): in order, never more than 20
    listEnvironments(userID, query) {
      return run(() => {
        const a = seeApp(userID, query.appID)
        const rows = envsOf(a.appID).map((e) => {
          const { envID, envCode, envName, sortOrder, promoGate, approvalReq, approvalCount, envState, currentVersionID,
            currentVersionName, currentDeplID, deployedDate, activeDeplID, canDeploy, canApprove } = environmentRow(userID, e)
          return { envID, envCode, envName, sortOrder, promoGate, approvalReq, approvalCount, envState, currentVersionID,
            currentVersionName, currentDeplID, deployedDate, activeDeplID, canDeploy, canApprove }
        })
        return ok({ environments: rows })
      })
    },

    // GET /environments/{envID} (LWDM006 R): with the controls; for whoever
    // may see the application
    getEnvironment(userID, envID) {
      return run(() => {
        const e = d.environments.find((x) => x.envID === int(envID))
        if (!e) refuse('04', '01', 'Environment not found')
        try {
          seeApp(userID, e.appID)
        } catch {
          refuse('04', '01', 'Environment not found')
        }
        return ok(environmentRow(userID, e))
      })
    },

    // GET /versions?appID= (LWDM205): newest first
    listVersions(userID, query) {
      return run(() => {
        const a = seeApp(userID, query.appID)
        const since = int(query.versionID_since)
        const status = upper(query.versionStatus_filter)
        const rows = d.versions
          .filter((v) => v.appID === a.appID && (!since || v.versionID < since) && (!status || v.versionStatus === status))
          .sort((x, y) => y.versionID - x.versionID)
          .map((v) => ({
            versionID: v.versionID, versionName: v.versionName, locType: v.locType, location: v.location,
            versionStatus: v.versionStatus, isUsed: yn(d.deployments.some((x) => x.versionID === v.versionID)),
            createdBy: v.createdBy, createdDate: v.createdDate,
          }))
        return ok({ versions: page(rows) })
      })
    },

    // GET /admin/deployments (LWDM211, ADMINVIEW Y): every application,
    // newest first; appID_filter instead of appID, no rule about own requests
    adminListDeployments(userID, query) {
      return run(() => {
        if (!isAdmin(userID)) refuse('08', '50', 'Only an administrator may do this')
        const appID = int(query.appID_filter)
        const requestedBy = upper(query.requestedBy_filter)
        const since = int(query.deplID_since)
        const status = upper(query.deplStatus_filter)
        if (status && !'WJEQUFSC'.includes(status)) refuse('08', '03', 'deplStatus_filter is not a deployment status')
        const rows = d.deployments
          .filter((x) => (!appID || x.appID === appID) && (!since || x.deplID < since) &&
            (!status || x.deplStatus === status) && (!requestedBy || x.createdBy === requestedBy))
          .sort((x, y) => y.deplID - x.deplID)
          .map(deploymentRow)
        return ok({ deployments: page(rows) })
      })
    },

    // ---- M3 -------------------------------------------------------------------
    // GET /deployments (LWDM211): newest first, with the rules of
    // lwdeploy/docs/09-iteration-5.md. appID 0 only for the own requests.
    listDeployments(userID, query) {
      return run(() => {
        const appID = int(query.appID)
        const requestedBy = upper(query.requestedBy_filter)
        let visible
        if (appID) {
          const a = seeApp(userID, appID)
          const r = rolesIn(userID, a)
          const all = r.member || r.owner || isAdmin(userID)
          visible = (x) => x.appID === a.appID &&
            (all || d.approvals.some((ap) => ap.deplID === x.deplID && ap.userID === userID))
        } else {
          if (requestedBy !== userID) refuse('08', '01', 'Without an application, only your own requests can be listed')
          visible = () => true
        }
        const since = int(query.deplID_since)
        const env = int(query.envID_filter)
        const version = int(query.versionID_filter)
        const status = upper(query.deplStatus_filter)
        if (status && !'WJEQUFSC'.includes(status)) refuse('08', '03', 'deplStatus_filter is not a deployment status')
        // LWDM211's LIKE '%text%': codes and names are stored in upper case
        const deplID = int(query.deplID_filter)
        const contains = (value, filter) => value.includes(upper(filter).trim())
        const rows = d.deployments
          .filter((x) => visible(x) && (!since || x.deplID < since) && (!env || x.envID === env) &&
            (!version || x.versionID === version) && (!status || x.deplStatus === status) &&
            (!requestedBy || x.createdBy === requestedBy) && (!deplID || x.deplID === deplID))
          .sort((x, y) => y.deplID - x.deplID)
          .map(deploymentRow)
          .filter((r) => contains(r.appCode, query.appCode_filter) && contains(r.envCode, query.envCode_filter) &&
            contains(r.versionName, query.versionName_filter))
        return ok({ deployments: page(rows) })
      })
    },
  }
}
