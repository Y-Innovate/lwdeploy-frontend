// The owners' side of the mock backend (lwdeploy/docs/10-iteration-6.md,
// 6b): environments (LWDM006 C, U, D), versions (LWDM405, LWDM005 R, U, D,
// T) and variables (LWDM207, LWDM007). Reading is for whoever sees the
// application; changing only for its owners (08 50), administrators
// included, unless they are in the owner group too.
import { ts } from './clock.js'
import { int, ok, page, refuse, run, text, upper } from './util.js'

const ENV_CODE = /^[A-Z0-9]{1,8}$/
const VERSION_NAME = /^[A-Z0-9._-]{1,30}$/
const VAR_NAME = /^[A-Z][A-Z0-9_]{0,15}$/
const DSN_PREFIX = /^[A-Z#$@][A-Z0-9#$@-]{0,7}(\.[A-Z#$@][A-Z0-9#$@-]{0,7})*$/
export const MAX_ENVIRONMENTS = 20

export function createOwner({ d, clock, inGroup, appOf, envsOf, seeApp, environmentRow }) {
  const now = () => ts(clock())
  const next = (rows, key) => rows.reduce((m, r) => Math.max(m, r[key]), 0) + 1
  const yn = (b) => (b ? 'Y' : 'N')

  // The application for a change: seen (04 01) and owned (08 50)
  function ownApp(userID, appID) {
    const app = seeApp(userID, appID)
    if (!inGroup(userID, app.ownerGroup)) refuse('08', '50', `Only an owner of ${app.appCode} may do this`)
    return app
  }

  // A row of a child table, seen through its application; 04 01 for a key
  // that doesn't exist or can't be seen
  function seeRow(userID, rows, key, id, what) {
    const row = rows.find((r) => r[key] === int(id))
    if (!row) refuse('04', '01', `${what} not found`)
    try {
      seeApp(userID, row.appID)
    } catch {
      refuse('04', '01', `${what} not found`)
    }
    return row
  }
  const ownRow = (userID, rows, key, id, what) => {
    const row = seeRow(userID, rows, key, id, what)
    ownApp(userID, row.appID)
    return row
  }

  // ---- Environments (O1) ----------------------------------------------------
  function envFields(app, body, envID = 0) {
    const envCode = upper(body.envCode)
    const envName = text(body.envName)
    const envDescription = text(body.envDescription)
    const promoGate = upper(body.promoGate) || 'N'
    if (!envCode) refuse('08', '01', 'envCode is required')
    if (!ENV_CODE.test(envCode)) refuse('08', '02', 'envCode: A-Z and 0-9 only, at most 8')
    if (!envName) refuse('08', '01', 'envName is required')
    if (envName.length > 60) refuse('08', '02', 'envName: at most 60 characters')
    if (envDescription.length > 1000) refuse('08', '02', 'envDescription: at most 1000 characters')
    if (!['Y', 'N'].includes(promoGate)) refuse('08', '02', 'promoGate: Y or N')
    if (d.environments.some((e) => e.appID === app.appID && e.envCode === envCode && e.envID !== envID)) {
      refuse('08', '11', `${app.appCode} has an environment ${envCode} already`)
    }
    return { envCode, envName, envDescription, promoGate }
  }

  // ---- Versions (O4) --------------------------------------------------------
  const isUsed = (v) => d.deployments.some((x) => x.versionID === v.versionID)
  const versionRow = (v) => {
    const { versionID, appID, versionName, locType, location, versionDescription, versionStatus, createdBy, createdDate,
      updatedBy, updatedDate } = v
    return { versionID, appID, versionName, locType, location, versionDescription, versionStatus, isUsed: yn(isUsed(v)),
      createdBy, createdDate, updatedBy, updatedDate }
  }

  // The checks of LWDM405
  function versionFields(app, body, versionID = 0) {
    const versionName = upper(body.versionName)
    const locType = upper(body.locType)
    const location = locType === 'D' ? upper(body.location) : text(body.location)
    const versionDescription = text(body.versionDescription)
    if (!VERSION_NAME.test(versionName)) refuse('08', '01', 'versionName: A-Z 0-9 . _ - only, at most 30')
    if (!['D', 'U'].includes(locType)) refuse('08', '02', 'locType: D or U')
    if (locType === 'D' && !(location.length <= 44 && DSN_PREFIX.test(location))) {
      refuse('08', '03', 'location: a dataset prefix of at most 44 characters')
    }
    if (locType === 'U' && !(location.startsWith('/') && location.length <= 255)) {
      refuse('08', '03', 'location: a USS path starting with /')
    }
    if (versionDescription.length > 1000) refuse('08', '02', 'versionDescription: at most 1000 characters')
    if (d.versions.some((v) => v.appID === app.appID && v.versionName === versionName && v.versionID !== versionID)) {
      refuse('08', '11', `${app.appCode} has a version ${versionName} already`)
    }
    return { versionName, locType, location, versionDescription }
  }

  function unused(v, what) {
    if (isUsed(v)) refuse('08', '53', `${v.versionName} has been requested for a deployment: ${what}`)
  }

  // ---- Variables (O1, O3, O4) -----------------------------------------------
  const variableRow = (x) => ({ ...x })

  // The level of a variable: application, environment or version; the
  // environment or version must belong to the application (08 13)
  function level(app, envID, versionID) {
    if (envID && versionID) refuse('08', '02', 'A variable belongs to an environment or a version, not both')
    if (envID && !d.environments.some((e) => e.envID === envID && e.appID === app.appID)) {
      refuse('08', '13', 'Environment not found in this application')
    }
    if (versionID && !d.versions.some((v) => v.versionID === versionID && v.appID === app.appID)) {
      refuse('08', '13', 'Version not found in this application')
    }
    return { envID, versionID }
  }

  function variableFields(body) {
    const varName = upper(body.varName)
    const varValue = text(body.varValue)
    const varDescription = text(body.varDescription)
    if (!varName) refuse('08', '01', 'varName is required')
    if (!VAR_NAME.test(varName)) refuse('08', '02', 'varName: A-Z 0-9 _, starting with a letter, at most 16')
    if (varName.startsWith('LWD')) refuse('08', '02', 'varName: names starting with LWD are LWD’s own')
    if (varValue.length > 255) refuse('08', '02', 'varValue: at most 255 characters')
    if (varDescription.length > 255) refuse('08', '02', 'varDescription: at most 255 characters')
    return { varName, varValue, varDescription }
  }

  function uniqueName(row) {
    const taken = d.variables.some((x) => x.appID === row.appID && x.envID === row.envID && x.versionID === row.versionID &&
      x.varName === row.varName && x.varID !== row.varID)
    if (taken) refuse('08', '11', `${row.varName} is defined at this level already`)
  }

  return {
    // POST /environments (LWDM006 C): with the protected defaults; it can't
    // be deployed to until an administrator sets its controls
    newEnvironment: (userID, body) => run(() => {
      const app = ownApp(userID, body.appID)
      const fields = envFields(app, body)
      const envs = envsOf(app.appID)
      if (envs.length >= MAX_ENVIRONMENTS) refuse('08', '53', `${app.appCode} has ${MAX_ENVIRONMENTS} environments, the most there can be`)
      const sortOrder = int(body.sortOrder) || (envs.at(-1)?.sortOrder ?? 0) + 1
      const e = {
        envID: next(d.environments, 'envID'), appID: app.appID, ...fields, sortOrder,
        deployUser: '', approvalReq: 'Y', approvalCount: 1, approverGroup: '', deployerGroup: '', execNode: '',
        createdBy: userID, createdDate: now(), updatedBy: userID, updatedDate: now(),
      }
      d.environments.push(e)
      return ok(environmentRow(userID, e), 201)
    }),

    // PUT /environments/{envID} (LWDM006 U): never the controls
    updateEnvironment: (userID, envID, body) => run(() => {
      const e = ownRow(userID, d.environments, 'envID', envID, 'Environment')
      const app = appOf(e.appID)
      // 0 or none keeps the order, as LWDM006 does (it can't tell them apart)
      const sortOrder = int(body.sortOrder) || e.sortOrder
      Object.assign(e, envFields(app, body, e.envID), { sortOrder, updatedBy: userID, updatedDate: now() })
      return ok(environmentRow(userID, e))
    }),

    // DELETE /environments/{envID} (LWDM006 D): only without deployments;
    // its variables go with it
    deleteEnvironment: (userID, envID) => run(() => {
      const e = ownRow(userID, d.environments, 'envID', envID, 'Environment')
      const count = d.deployments.filter((x) => x.envID === e.envID).length
      if (count) refuse('08', '53', `${e.envCode} has ${count === 1 ? '1 deployment' : `${count} deployments`}: it can't be deleted`)
      d.environments = d.environments.filter((x) => x !== e)
      d.variables = d.variables.filter((x) => x.envID !== e.envID)
      return ok()
    }),

    // GET /versions/{versionID} (LWDM005 R)
    getVersion: (userID, versionID) => run(() => ok(versionRow(seeRow(userID, d.versions, 'versionID', versionID, 'Version')))),

    // POST /versions (LWDM405): by an owner or the CI pipeline
    newVersion: (userID, body) => run(() => {
      const app = ownApp(userID, body.appID)
      const v = {
        versionID: next(d.versions, 'versionID'), appID: app.appID, ...versionFields(app, body), versionStatus: 'A',
        createdBy: userID, createdDate: now(), updatedBy: userID, updatedDate: now(),
      }
      d.versions.push(v)
      return ok(versionRow(v), 201)
    }),

    // PUT /versions/{versionID} (LWDM005 U): only while never requested
    updateVersion: (userID, versionID, body) => run(() => {
      const v = ownRow(userID, d.versions, 'versionID', versionID, 'Version')
      unused(v, 'it can’t be changed any more')
      Object.assign(v, versionFields(appOf(v.appID), body, v.versionID), { updatedBy: userID, updatedDate: now() })
      return ok(versionRow(v))
    }),

    // DELETE /versions/{versionID} (LWDM005 D): only while never requested;
    // its variables go with it
    deleteVersion: (userID, versionID) => run(() => {
      const v = ownRow(userID, d.versions, 'versionID', versionID, 'Version')
      unused(v, 'retire it instead')
      d.versions = d.versions.filter((x) => x !== v)
      d.variables = d.variables.filter((x) => x.versionID !== v.versionID)
      return ok()
    }),

    // POST /versionRetirements/{versionID} (LWDM005 T): any time, once
    retireVersion: (userID, versionID) => run(() => {
      const v = ownRow(userID, d.versions, 'versionID', versionID, 'Version')
      if (v.versionStatus === 'R') refuse('08', '53', `${v.versionName} is retired already`)
      Object.assign(v, { versionStatus: 'R', updatedBy: userID, updatedDate: now() })
      return ok(versionRow(v))
    }),

    // GET /variables?appID=&envID=&versionID= (LWDM207): one level, by varID
    listVariables: (userID, query) => run(() => {
      const app = seeApp(userID, query.appID)
      const { envID, versionID } = level(app, int(query.envID), int(query.versionID))
      const since = int(query.varID_since)
      const rows = d.variables
        .filter((x) => x.appID === app.appID && x.envID === envID && x.versionID === versionID && x.varID > since)
        .sort((a, b) => a.varID - b.varID)
        .map(variableRow)
      return ok({ variables: page(rows) })
    }),

    // POST /variables (LWDM007 C)
    newVariable: (userID, body) => run(() => {
      const app = ownApp(userID, body.appID)
      const x = {
        varID: next(d.variables, 'varID'), appID: app.appID, ...level(app, int(body.envID), int(body.versionID)),
        ...variableFields(body), createdBy: userID, createdDate: now(), updatedBy: userID, updatedDate: now(),
      }
      uniqueName(x)
      d.variables.push(x)
      return ok(variableRow(x), 201)
    }),

    // PUT /variables/{varID} (LWDM007 U): name, value, description; the
    // level stays
    updateVariable: (userID, varID, body) => run(() => {
      const x = ownRow(userID, d.variables, 'varID', varID, 'Variable')
      const fields = variableFields(body)
      uniqueName({ ...x, ...fields })
      Object.assign(x, fields, { updatedBy: userID, updatedDate: now() })
      return ok(variableRow(x))
    }),

    // DELETE /variables/{varID} (LWDM007 D)
    deleteVariable: (userID, varID) => run(() => {
      const x = ownRow(userID, d.variables, 'varID', varID, 'Variable')
      d.variables = d.variables.filter((y) => y !== x)
      return ok()
    }),
  }
}
