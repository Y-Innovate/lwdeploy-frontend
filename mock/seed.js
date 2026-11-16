// Seed data for the mocks, relative to `now`, modelled on t01's DEMO
// application (lwdeploy/docs/05-iteration-1.md) so the screens can be tried
// without CICS. Tables as in lwdeploy/docs/03-data-model.md, with the field
// names of the API.
//
// Applications:
//   1 DEMO  DEV -> TST (gate) -> PRD (gate, 2 approvers of LWDAPR, deployers
//           of LWDDPL); versions V0.9.0 (retired), V1.0.0, V1.0.1-BAD;
//           two jobs. V0.9.0 went through all three (PRD approved by APR0001
//           and DEV0002), V1.0.0 is in DEV and TST and waits for approval in
//           PRD, V1.0.1-BAD failed in DEV, which it still holds
//   2 PAYR  one environment, no deployments
//   3 HRAP  nobody in the seed is in its groups but its owner
// Dev users (any passphrase that doesn't start with "wrong"):
//   DEV0001  member of DEMO and PAYR, deployer in PRD; requested the PRD one
//   DEV0002  member of DEMO and approver in PRD: can approve DEV0001's request
//   APR0001  only approver in PRD (sees DEMO through its approvals)
//   OWN0001  owner of DEMO and HRAP
//   NOROLE1  no role anywhere
//   ADMIN01  administrator (the Entra sign-in in dev), no group
// Variables: TARGETLIB and CICSHLQ for DEMO, TARGETLIB again for PRD,
// CHGNR for V1.0.0.
// Allowlists (REFTABLES): the groups above and LWDNEW, which no application
// uses yet; deploy userids LWDDEPL (every environment) and LWDDEPP (unused)
import { at } from './clock.js'

export const DEPLOY_USER = 'LWDDEPL'

export function buildSeed(now = new Date()) {
  const t = (offset) => at(now, offset)

  const users = ['DEV0001', 'DEV0002', 'APR0001', 'OWN0001', 'NOROLE1', 'ADMIN01'].map((userID) => ({
    userID,
    email: userID === 'NOROLE1' ? '' : `${userID.toLowerCase()}@example.com`,
    notifyApprove: 'Y',
    notifyOwn: 'Y',
    notifyApp: 'N',
  }))

  // RACF groups a user is connected to (the FACILITY checks of 04-api.md)
  const connects = {
    DEV0001: ['LWDDEMO', 'LWDPAYR', 'LWDDPL'],
    DEV0002: ['LWDDEMO', 'LWDAPR'],
    APR0001: ['LWDAPR'],
    OWN0001: ['LWDDEMO', 'LWDOWN'],
    NOROLE1: [],
    ADMIN01: [],
  }

  const audit = (days) => ({ createdBy: 'ADMIN01', createdDate: t({ days }), updatedBy: 'ADMIN01', updatedDate: t({ days }) })

  const applications = [
    { appID: 1, appCode: 'DEMO', appName: 'Demo application', appDescription: 'The application of the iteration tests.', accessGroup: 'LWDDEMO', ownerGroup: 'LWDOWN', ...audit(-60) },
    { appID: 2, appCode: 'PAYR', appName: 'Payroll batch', appDescription: '', accessGroup: 'LWDPAYR', ownerGroup: 'LWDOWN', ...audit(-30) },
    { appID: 3, appCode: 'HRAP', appName: 'HR application', appDescription: '', accessGroup: 'LWDHR', ownerGroup: 'LWDOWN', ...audit(-20) },
  ]

  const env = (envID, appID, envCode, envName, sortOrder, more = {}) => ({
    envID, appID, envCode, envName, sortOrder, envDescription: '',
    promoGate: 'N', approvalReq: 'N', approvalCount: 0, approverGroup: '', deployerGroup: '',
    deployUser: DEPLOY_USER, execNode: '', ...audit(-60), ...more,
  })
  const environments = [
    env(1, 1, 'DEV', 'Development', 1),
    env(2, 1, 'TST', 'Test', 2, { promoGate: 'Y' }),
    env(3, 1, 'PRD', 'Production', 3, { promoGate: 'Y', approvalReq: 'Y', approvalCount: 2, approverGroup: 'LWDAPR', deployerGroup: 'LWDDPL' }),
    env(4, 2, 'DEV', 'Development', 1),
    env(5, 3, 'DEV', 'Development', 1),
  ]

  const version = (versionID, appID, versionName, days, more = {}) => ({
    versionID, appID, versionName, locType: 'D', location: `LWD.DEMO.${versionName.replaceAll('.', '').replace('-', '')}`,
    versionDescription: '', versionStatus: 'A', createdBy: 'OWN0001', createdDate: t({ days }),
    updatedBy: 'OWN0001', updatedDate: t({ days }), ...more,
  })
  const versions = [
    version(1, 1, 'V0.9.0', -40, { versionStatus: 'R' }),
    version(2, 1, 'V1.0.0', -10, { versionDescription: 'First release.' }),
    version(3, 1, 'V1.0.1-BAD', -2, { versionDescription: 'Job 2 ends with RC 8, above its highest RC.' }),
  ]

  const templates = [
    { templateID: 1, appID: 1, sortOrder: 1, templateName: 'Copy load modules', maxRC: 4, templateStatus: 'A', currentRev: 3, ...audit(-41), createdBy: 'OWN0001', updatedBy: 'OWN0001' },
    { templateID: 2, appID: 1, sortOrder: 2, templateName: 'Refresh CICS', maxRC: 4, templateStatus: 'A', currentRev: 2, ...audit(-42), createdBy: 'OWN0001', updatedBy: 'OWN0001' },
  ]

  // TEMPLATEREVS with their lines: the history of each template, the last
  // one current. Lines hold variables, filled in when a deployment is
  // requested (the seed deployments keep the JCL frozen by frozenJcl).
  const templateRevs = []
  const rev = (templateID, revision, days, changeNote, lines, by = 'OWN0001') =>
    templateRevs.push({ templateID, revision, changeNote, lines, createdBy: by, createdDate: t({ days }) })
  const copy = (out) => [
    '//* Copy the load modules of ${LWDVER}',
    '//COPY     EXEC PGM=IEBCOPY',
    '//SYSPRINT DD SYSOUT=*',
    '//IN       DD DISP=SHR,DSN=${LWDLOC}.LOAD',
    `//OUT      DD DISP=SHR,DSN=${out}`,
    '//SYSIN    DD *',
    '  COPY INDD=IN,OUTDD=OUT',
    '/*',
  ]
  rev(1, 1, -60, 'First version', copy('LWD.DEMO.LOAD'))
  rev(1, 2, -45, 'Target library from a variable', copy('${TARGETLIB}'))
  rev(1, 3, -41, 'Replace members', copy('${TARGETLIB}').map((l) => l.replace('COPY INDD=IN,OUTDD=OUT', 'COPY INDD=((IN,R)),OUTDD=OUT')))
  const refresh = (lib) => [
    '//* Refresh the CICS definitions of ${LWDAPP} in ${LWDENV}',
    "//REFRESH  EXEC PGM=DFHCSDUP,PARM='CSD(READONLY)'",
    `//STEPLIB  DD DISP=SHR,DSN=${lib}`,
    '//SYSPRINT DD SYSOUT=*',
    '//SYSIN    DD *',
    '  LIST GROUP(${LWDAPP})',
    '/*',
  ]
  rev(2, 1, -60, 'First version', refresh('CICS63.SDFHLOAD'))
  rev(2, 2, -42, 'CICS from a variable', refresh('${CICSHLQ}.SDFHLOAD'))

  // Deployments, newest last. Jobs per deployment: DEPLJOBS with the frozen
  // JCL; runs: JOBRUNS
  const deployments = []
  const deplJobs = []
  const jobRuns = []
  const events = []
  const approvals = []
  let runID = 100

  function deployment(deplID, envID, versionID, deplStatus, days, { by = 'DEV0001', note = '', results = [], approvers = [] } = {}) {
    const e = environments.find((x) => x.envID === envID)
    const requested = t({ days })
    const started = results.length ? t({ days, minutes: 20 }) : ''
    const final = ['S', 'F', 'C', 'J', 'E'].includes(deplStatus)
    deployments.push({
      deplID, appID: e.appID, envID, versionID, deplStatus, startAfter: requested, requestNote: note,
      deployUser: e.deployUser, approverGroup: e.approverGroup, approvalCount: e.approvalCount, approvedCount: 0,
      startedDate: started, endedDate: final ? t({ days, minutes: 25 }) : '',
      createdBy: by, createdDate: requested, updatedBy: by, updatedDate: requested,
    })
    events.push({ deplID, eventNo: 1, eventType: 'R', jobNo: 0, commentText: note, createdBy: by, createdDate: requested })
    approvers.forEach((userID, i) => {
      const when = t({ days, minutes: 10 + i })
      approvals.push({ deplID, userID, decision: 'A', commentText: i === 0 ? 'JCL checked' : '', createdDate: when })
      events.push({ deplID, eventNo: events.filter((x) => x.deplID === deplID).length + 1, eventType: 'A', jobNo: 0,
        commentText: '', createdBy: userID, createdDate: when })
    })
    deployments.at(-1).approvedCount = approvers.length
    templates.filter((x) => x.appID === e.appID).forEach((tp, i) => {
      const jobNo = i + 1
      const result = results[i] ?? ''
      const jobStatus = result === 'O' ? 'D' : result ? 'F' : deplStatus === 'F' || deplStatus === 'C' ? 'K' : 'W'
      let lastRunID = 0
      if (result) {
        lastRunID = ++runID
        jobRuns.push({
          runID: lastRunID, deplID, jobNo, jobName: `LWD${String(lastRunID).padStart(5, '0')}`,
          runStatus: 'E', jobResult: result, jesJobID: `JOB${String(4000 + lastRunID).padStart(5, '0')}`,
          submittedDate: t({ days, minutes: 21 + i * 2 }), endedDate: t({ days, minutes: 22 + i * 2 }),
          jobRC: result === 'O' ? 0 : 8, abendCode: '', jobMessage: '', outputStatus: 'C',
        })
      }
      deplJobs.push({
        deplID, jobNo, jobTitle: tp.templateName, templateID: tp.templateID, templateRev: tp.currentRev,
        maxRC: tp.maxRC, jobStatus, lastRunID, skipReason: '', jcl: frozenJcl(tp, versions.find((v) => v.versionID === versionID)),
      })
    })
    if (final) {
      const eventNo = events.filter((x) => x.deplID === deplID).length
      events.push({ deplID, eventNo: eventNo + 1, eventType: 'U', jobNo: 0, commentText: '', createdBy: 'LWDSCHD', createdDate: started })
      const failedJob = deplStatus === 'F' ? results.findIndex((r) => r !== 'O') + 1 : 0
      events.push({ deplID, eventNo: eventNo + 2, eventType: deplStatus, jobNo: failedJob, commentText: '', createdBy: 'LWDSCHD', createdDate: t({ days, minutes: 25 }) })
    }
  }

  deployment(1, 1, 1, 'S', -40, { results: ['O', 'O'] })
  deployment(2, 2, 1, 'S', -39, { results: ['O', 'O'] })
  deployment(3, 3, 1, 'S', -38, { results: ['O', 'O'], note: 'Pilot', approvers: ['APR0001', 'DEV0002'] })
  deployment(4, 1, 2, 'S', -9, { results: ['O', 'O'], note: 'First release' })
  deployment(5, 2, 2, 'S', -8, { results: ['O', 'O'] })
  deployment(6, 1, 3, 'F', -2, { results: ['O', 'H'], note: 'Try the RC 8 job' })
  deployment(7, 3, 2, 'W', -1, { note: 'Release to production' })

  // VARIABLES: application level (no envID, no versionID), PRD overrides
  // TARGETLIB, V1.0.0 has a change number
  const variable = (varID, envID, versionID, varName, varValue, varDescription = '') =>
    ({ varID, appID: 1, envID, versionID, varName, varValue, varDescription, ...audit(-50) })
  const variables = [
    variable(1, 0, 0, 'TARGETLIB', 'LWD.DEMO.LOAD', 'Load library the modules are copied to'),
    variable(2, 0, 0, 'CICSHLQ', 'CICS63', 'High-level qualifier of CICS'),
    variable(3, 3, 0, 'TARGETLIB', 'LWD.DEMO.PRD.LOAD', 'Production load library'),
    variable(4, 0, 2, 'CHGNR', 'CHG0012345', 'Change number of the release'),
  ]

  const ref = (tableID, tabKey, tabValue) => ({ tableID, tabKey, tabValue, ...audit(-60) })
  const refTables = [
    ref('RACFGRP', 'LWDDEMO', 'Demo: members'),
    ref('RACFGRP', 'LWDOWN', 'Owners of the demo applications'),
    ref('RACFGRP', 'LWDAPR', 'Demo: PRD approvers'),
    ref('RACFGRP', 'LWDDPL', 'Demo: PRD deployers'),
    ref('RACFGRP', 'LWDPAYR', 'Payroll: members'),
    ref('RACFGRP', 'LWDHR', 'HR: members'),
    ref('RACFGRP', 'LWDNEW', 'New team, no application yet'),
    ref('DEPLUSER', DEPLOY_USER, 'Deploy userid of the demo applications'),
    ref('DEPLUSER', 'LWDDEPP', 'Production deploy userid'),
    // SETTINGS as DDL/SETTINGS makes them from envs/<env>.yaml (made-up
    // values where t01's are host names or Entra IDs); LASTTICK from the
    // scheduler
    ...Object.entries({
      ADMINRES: 'LWD.T01.ADMIN', GRPPRFX: 'LWD.T01.GRP', GRPMINS: '15', JOBPRFX: 'LT', JOBCLASS: 'A', MSGCLASS: 'X',
      EXECLIB: 'LWD.T01.EXEC', LWDURL: 'https://lww.example.com', LWDPORT: '8081',
      LWDPATH: '/lwdeploy/API/v1', LWDRING: '*AUTH*/*', TENANT: '00000000-0000-0000-0000-000000000000',
      APISCOPE: '00000000-0000-0000-0000-000000000001/.default', JAVAHOME: '/usr/lpp/java/J21.0_64',
      JWTJARS: '/var/lwd/t01/jwt', SUBMUSR: 'LWDSUBM', SUBMTXN: 'LWDS',
      SCHEDUSR: 'LWDSCHD', APPRHRS: '72', JOBMINS: '120', OUTDAYS: '90', OUTLINES: '50000',
      MAILFROM: 'lwd@example.com', MAILURL: 'https://lww.example.com/lwdeploy', MAILWRTR: 'CSSMTP', MAILCLS: 'A',
      MAILMAX: '50', LASTTICK: t({ minutes: -1 }),
    }).map(([key, value]) => ({ ...ref('SETTINGS', key, value), createdBy: 'SEED', updatedBy: key === 'LASTTICK' ? 'LWDSCHD' : 'SEED' })),
  ]

  return { users, connects, admins: ['ADMIN01'], applications, environments, versions, templates,
    deployments, deplJobs, jobRuns, events, approvals, refTables, variables, templateRevs }
}

// The frozen JCL of a job, as LWDM411 stores it: the template's steps with
// the variables filled in. The JOB statement and the result step are added
// at submission (LWDM920), so they aren't in it.
export function frozenJcl(template, version) {
  const step = template.sortOrder === 1
    ? [
        `//COPY     EXEC PGM=IEBCOPY`,
        `//SYSPRINT DD SYSOUT=*`,
        `//IN       DD DISP=SHR,DSN=${version.location}.LOAD`,
        `//OUT      DD DISP=SHR,DSN=LWD.DEMO.LOAD`,
        `//SYSIN    DD *`,
        `  COPY INDD=IN,OUTDD=OUT`,
        `/*`,
      ]
    : [
        `//REFRESH  EXEC PGM=DFHCSDUP,PARM='CSD(READONLY)'`,
        `//STEPLIB  DD DISP=SHR,DSN=CICS63.SDFHLOAD`,
        `//SYSPRINT DD SYSOUT=*`,
        `//SYSIN    DD *`,
        `  LIST GROUP(DEMO)`,
        `/*`,
      ]
  return [`//* ${template.templateName}, revision ${template.currentRev}, ${version.versionName}`, ...step].join('\n')
}
