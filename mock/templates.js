// Job templates in the mock backend (lwdeploy/docs/10-iteration-6.md, 6b):
// templates (LWDM208, LWDM008), revisions (LWDM209), JCL (LWDM310, LWDM410)
// with the checks of the decision "Template JCL", and filling in the
// variables when a deployment is requested (LWDM411).
import { ts } from './clock.js'
import { int, ok, page, refuse, run, text } from './util.js'

export const MAX_TEMPLATES = 20
export const MAX_LINES = 300
export const BUILT_INS = ['LWDAPP', 'LWDENV', 'LWDVER', 'LWDLOC']
const VAR_RE = /\$\{([A-Z][A-Z0-9_]*)\}/g
const JES2 = /^\/\*(JOBPARM|ROUTE|XEQ|OUTPUT|PRIORITY|NETACCT|NOTIFY|SETUP|SIGNON|XMIT)\b/
const JES3 = /^\/\/\*(MAIN|NET|NETACCT|ROUTE|FORMAT|PROCESS|ENDPROCESS|DATASET|ENDDATASET|PAUSE|OPERATOR)\b/

// The checks of LWDM410 on the lines of a save: the first refusal (08 56,
// naming the line), else the warnings. defined: the variable names defined
// at some level of the application.
export function checkJcl(lines, defined) {
  if (lines.length === 0 || lines.every((l) => !l.trim())) return { refusal: 'The JCL is empty' }
  if (lines.length > MAX_LINES) return { refusal: `${lines.length} lines: at most ${MAX_LINES}` }
  for (const [i, line] of lines.entries()) {
    const at = `Line ${i + 1}`
    if (line.length > 80) return { refusal: `${at}: longer than 80 characters` }
    if (/^\/\/[^*\s]*\s+JOB(\s|$)/.test(line)) return { refusal: `${at}: a JOB statement; LWD writes it` }
    if (JES2.test(line)) return { refusal: `${at}: a JES2 statement` }
    if (JES3.test(line)) return { refusal: `${at}: a JES3 statement` }
    if (/^\/\/[^*]/.test(line) && /(^|[\s,])(USER|PASSWORD)=/.test(line)) return { refusal: `${at}: USER= or PASSWORD=` }
  }
  const warnings = []
  for (const [i, line] of lines.entries()) {
    for (const [, name] of line.matchAll(VAR_RE)) {
      if (!BUILT_INS.includes(name) && !defined.has(name)) warnings.push(`Line ${i + 1}: \${${name}} is defined at no level yet`)
    }
    if (/^\/\/[^*]/.test(line) && line.length > 71) warnings.push(`Line ${i + 1}: the statement passes column 71`)
  }
  return { warnings }
}

// The lines of a template revision with the variables filled in: version
// over environment over application, and the built-ins. missing: the first
// name without a value (08 57).
export function fillIn(lines, values) {
  let missing = ''
  const out = lines.map((line) => line.replace(VAR_RE, (whole, name) => {
    if (name in values) return values[name]
    missing ||= name
    return whole
  }))
  return { lines: out, missing }
}

export function createTemplates({ d, clock, inGroup, appOf, seeApp }) {
  const now = () => ts(clock())
  const next = (rows, key) => rows.reduce((m, r) => Math.max(m, r[key]), 0) + 1
  const active = (appID) => d.templates.filter((tp) => tp.appID === appID && tp.templateStatus === 'A')
    .sort((a, b) => a.sortOrder - b.sortOrder || a.templateID - b.templateID)

  function ownApp(userID, appID) {
    const app = seeApp(userID, appID)
    if (!inGroup(userID, app.ownerGroup)) refuse('08', '50', `Only an owner of ${app.appCode} may do this`)
    return app
  }
  // Deleted templates stay readable, so frozen JCL can be traced to them
  function seeTemplate(userID, templateID) {
    const tp = d.templates.find((x) => x.templateID === int(templateID))
    if (!tp) refuse('04', '01', 'Template not found')
    try {
      seeApp(userID, tp.appID)
    } catch {
      refuse('04', '01', 'Template not found')
    }
    return tp
  }
  function ownTemplate(userID, templateID) {
    const tp = seeTemplate(userID, templateID)
    ownApp(userID, tp.appID)
    if (tp.templateStatus !== 'A') refuse('08', '53', `${tp.templateName} is deleted`)
    return tp
  }

  const templateRow = (tp) => {
    const { templateID, appID, templateName, sortOrder, maxRC, currentRev, templateStatus, createdBy, createdDate, updatedBy, updatedDate } = tp
    return { templateID, appID, templateName, sortOrder, maxRC, currentRev, templateStatus, createdBy, createdDate, updatedBy, updatedDate }
  }

  function fields(body, tp) {
    const templateName = text(body.templateName)
    const maxRC = body.maxRC === undefined || body.maxRC === '' ? (tp?.maxRC ?? 0) : Number(body.maxRC)
    if (!templateName) refuse('08', '01', 'templateName is required')
    if (templateName.length > 60) refuse('08', '02', 'templateName: at most 60 characters')
    if (!Number.isInteger(maxRC) || maxRC < 0 || maxRC > 4095) refuse('08', '02', 'maxRC: 0 to 4095')
    return { templateName, maxRC }
  }

  // The names defined at any level of the application, for the warnings
  const definedIn = (appID) => new Set(d.variables.filter((x) => x.appID === appID).map((x) => x.varName))

  const revOf = (tp, revision) => d.templateRevs.find((r) => r.templateID === tp.templateID && r.revision === revision)
  const one = (v) => (Array.isArray(v) ? v[0] : v)

  return {
    // GET /templates?appID= (LWDM208): the active ones in order, at most 20
    listTemplates: (userID, query) => run(() => {
      const app = seeApp(userID, query.appID)
      const rows = active(app.appID).map(({ templateID, templateName, sortOrder, maxRC, currentRev, updatedBy, updatedDate }) =>
        ({ templateID, templateName, sortOrder, maxRC, currentRev, updatedBy, updatedDate }))
      return ok({ templates: rows })
    }),

    // GET /templates/{templateID} (LWDM008 R)
    getTemplate: (userID, templateID) => run(() => ok(templateRow(seeTemplate(userID, templateID)))),

    // POST /templates (LWDM008 C): without JCL, revision 0; at the end
    newTemplate: (userID, body) => run(() => {
      const app = ownApp(userID, body.appID)
      const list = active(app.appID)
      if (list.length >= MAX_TEMPLATES) refuse('08', '53', `${app.appCode} has ${MAX_TEMPLATES} templates, the most there can be`)
      const tp = {
        templateID: next(d.templates, 'templateID'), appID: app.appID, ...fields(body),
        sortOrder: int(body.sortOrder) || (list.at(-1)?.sortOrder ?? 0) + 1, templateStatus: 'A', currentRev: 0,
        createdBy: userID, createdDate: now(), updatedBy: userID, updatedDate: now(),
      }
      d.templates.push(tp)
      return ok(templateRow(tp), 201)
    }),

    // PUT /templates/{templateID} (LWDM008 U): name, order, highest RC
    updateTemplate: (userID, templateID, body) => run(() => {
      const tp = ownTemplate(userID, templateID)
      // 0 or none keeps the order, as LWDM008 does
      const sortOrder = int(body.sortOrder) || tp.sortOrder
      Object.assign(tp, fields(body, tp), { sortOrder, updatedBy: userID, updatedDate: now() })
      return ok(templateRow(tp))
    }),

    // DELETE /templates/{templateID} (LWDM008 D): status D; the revisions stay
    deleteTemplate: (userID, templateID) => run(() => {
      const tp = ownTemplate(userID, templateID)
      Object.assign(tp, { templateStatus: 'D', updatedBy: userID, updatedDate: now() })
      return ok()
    }),

    // GET /templateRevisions?templateID= (LWDM209): newest first
    listTemplateRevisions: (userID, query) => run(() => {
      const tp = seeTemplate(userID, query.templateID)
      const since = int(query.revision_since)
      const rows = d.templateRevs.filter((r) => r.templateID === tp.templateID && (!since || r.revision < since))
        .sort((a, b) => b.revision - a.revision)
        .map(({ revision, changeNote, lines, createdBy, createdDate }) => ({ revision, changeNote, lineCount: lines.length, createdBy, createdDate }))
      return ok({ revisions: page(rows) })
    }),

    // GET /templateJcl/{templateID}?revision= (LWDM310): 0 is the current
    // one; base64 of the lines joined by LF
    getTemplateJcl: (userID, templateID, query) => run(() => {
      const tp = seeTemplate(userID, templateID)
      const revision = int(query.revision) || tp.currentRev
      if (revision === 0) return ok({ templateID: tp.templateID, revision: 0, lineCount: 0, jcl: '' })
      const r = revOf(tp, revision)
      if (!r) refuse('04', '01', `Revision ${revision} not found`)
      return ok({ templateID: tp.templateID, revision, lineCount: r.lines.length, jcl: Buffer.from(r.lines.join('\n'), 'utf8').toString('base64') })
    }),

    // POST /templateJcl/{templateID} (LWDM410): multipart fields jcl
    // (base64 of UTF-8) and changeNote; a new revision, which becomes current
    newTemplateJcl: (userID, templateID, body) => run(() => {
      const tp = ownTemplate(userID, templateID)
      const encoded = text(one(body.jcl))
      const changeNote = text(one(body.changeNote))
      if (!encoded) refuse('08', '58', 'Form field jcl is missing')
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4) refuse('08', '58', 'jcl is not valid base64')
      const bytes = Buffer.from(encoded, 'base64')
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      if (decoded.includes('�')) refuse('08', '58', 'jcl is not valid UTF-8')
      if (changeNote.length > 255) refuse('08', '02', 'changeNote: at most 255 characters')
      // CR dropped, split at LF; a last LF makes no extra line
      const lines = decoded.replaceAll('\r', '').split('\n')
      if (lines.length > 1 && lines.at(-1) === '') lines.pop()
      const { refusal, warnings } = checkJcl(lines, definedIn(tp.appID))
      if (refusal) refuse('08', '56', refusal)
      const revision = Math.max(0, ...d.templateRevs.filter((r) => r.templateID === tp.templateID).map((r) => r.revision)) + 1
      d.templateRevs.push({ templateID: tp.templateID, revision, changeNote, lines, createdBy: userID, createdDate: now() })
      Object.assign(tp, { currentRev: revision, updatedBy: userID, updatedDate: now() })
      return ok({ templateID: tp.templateID, revision, lineCount: lines.length, warningCount: warnings.length, infoMessage: warnings[0] ?? '' }, 201)
    }),

    // For LWDM411: the JCL of a template's current revision for a
    // deployment, with the variables filled in; refuses 08 57 for the first
    // variable without a value
    frozenFor(tp, env, version) {
      const r = revOf(tp, tp.currentRev)
      const app = appOf(tp.appID)
      const values = { LWDAPP: app.appCode, LWDENV: env.envCode, LWDVER: version.versionName, LWDLOC: version.location }
      for (const level of [(x) => !x.envID && !x.versionID, (x) => x.envID === env.envID, (x) => x.versionID === version.versionID]) {
        for (const x of d.variables.filter((v) => v.appID === app.appID && level(v))) values[x.varName] = x.varValue
      }
      const { lines, missing } = fillIn(r.lines, values)
      if (missing) refuse('08', '57', `Variable ${missing} has no value in ${env.envCode} for ${version.versionName}`)
      return lines.join('\n')
    },
  }
}
