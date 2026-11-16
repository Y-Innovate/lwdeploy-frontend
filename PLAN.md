# PLAN.md: LWD web UI build plan

The screens of `lwdeploy/docs/09-iteration-5.md`, in steps F1 to F6.

## Decisions

Agreed 2026-11-15:
- **Own repo** `lwdeploy-frontend`, built the way ctflww-frontend is. The build
  output is committed in the backend repo, under `lwdeploy/LWWAdmin/`.
- **Paths:** `/lwdeploy/`, API `/lwdeploy/API/v1` (not `/lwd`, changed
  2026-11-15).
- **Scope:** members, deployers and approvers. Owner and admin screens come
  with their API in iteration 6, in a plan of their own.
- **Sign-in:** LWW sessions. RACF userid and passphrase on the React page
  `/lwdeploy/login`, or LWW's Entra redirect, for everyone. Sign-out through
  LWW's `logout.html` (pre-exec `LWWADPLO`).
- **Routes without IDs in the path**, as for CTF: LWW has no SPA fallback, so
  there is a folder per route, and IDs go in the query string.
- **Copied, not shared,** from ctflww-frontend: the API client, the session,
  the LWW pages, the build scripts, the styles.

## Routes and LWW folders

| Route | Screen | Use cases |
|---|---|---|
| `/lwdeploy/` | Start page: my applications, approvals waiting, my requests | U1, M1, AP1 |
| `/lwdeploy/login` | Sign-in form, Entra button | U1 |
| `/lwdeploy/app?appID=` | Application: environments, versions, deployments | M1, M2, M3 |
| `/lwdeploy/deploy?appID=&envID=` | Request a deployment | D1 |
| `/lwdeploy/deployment?deplID=` | Deployment: status, jobs, approvals, history, actions | M3, D2-D4, AP2 |
| `/lwdeploy/jcl?deplID=&jobNo=` | Frozen JCL of a job | M3, AP2 |
| `/lwdeploy/run?deplID=&jobNo=&runID=` | Runs, steps, spool files | M3, M4 |
| `/lwdeploy/output?runID=&fileNo=` (+ `deplID`, `jobNo` for the way back) | One spool file | M4 |
| `/lwdeploy/approvals` | Approvals waiting for me | AP1 |

Each route except `/lwdeploy/` is a folder in `public/` with a `.name` file:
`defaultWebpageId` `LD000001` (index.html), and for every route but `login`
`defaultTran` `LWDU` and `loginRedirectWebpageId` `LD000003`
(`redirect_to_login.html`). `login` runs under LWD's public `LWDP`, as do
`index.html` and `assets/`, because they must load before sign-in and the
CICS default userid has no access to `LWDU`. LWW's own sign-in pages stay on
`LWBL`. The root folder
itself is made by `uploadLWW.py`, under `LWDU`, with index.html as its
default page and `redirect_to_login.html` as its login redirect (changed
2026-11-15: it was `LWBL` without a login redirect). To check on t01: that
the redirect isn't passed down to `login` and `assets/`.

LWW pages in `public/`, plain HTML with fixed IDs:

| File | ID | Pre-exec | What it does |
|---|---|---|---|
| `index.html` (the build) | `LD000001` | | The app |
| `process_login.html` | `LD000002` | `LWWADPLI` | RACF sign-in, then back to the requested page |
| `redirect_to_login.html` | `LD000003` | `LWWADPLR` (inline) | Login redirect of the route folders, to `/lwdeploy/login` |
| `redirect_to_sso_login.html` | `LD000004` | `LWWADPL1` | Entra redirect |
| `auth` | `LD000005` | `LWWADPL2` | Entra callback, then back to the requested page |
| `logout.html` | `LD000006` | `LWWADPLO` | Ends the session |

## F1: foundation
- [x] 1. Scaffold from ctflww-frontend: Vite, React, Tailwind, ESLint, Vitest;
      `/lwdeploy` base, port 5175, build into `../lwdeploy/LWWAdmin`
      (`LWD_LWW_DIR` to override)
- [x] 2. API client (LWD reason codes), `GET /me`, session context
- [x] 3. Sign-in page (RACF form and Entra), session guard on every other
      route, return to the requested page
- [x] 4. Top bar: applications, approvals with the number waiting, userid,
      administrator mark, sign-out
- [x] 5. LWW pages and route folders in `public/`
- [x] 6. Mock backend: seed modelled on t01's DEMO, LWW's sign-in and
      sign-out, `GET /me`
- [x] 7. Code translations (`src/lib/codes.js`)
- [x] 8. Lint and tests pass

## F2: start page and application
- [x] Mock: `GET /applications`, `GET /applications/{appID}`,
      `GET /environments`, `GET /versions`, `GET /deployments` (the rules of
      09-iteration-5.md); seed with a PRD deployment approved by two users
- [x] Paged lists (`usePagedList`, `LoadMore`) from ctflww-frontend, and
      `useLoad` for single loads
- [x] Start page: application cards with roles, approvals waiting, my
      requests, the text for a user without roles
- [x] Application page (`?appID=&tab=`): environments (inventory,
      half-deployed warning, approval and gate, the deployment holding it,
      Deploy), versions (show retired), deployments with filters on
      environment, version, status and "only mine"

## F3: deploying
- [x] Mock (`mock/deployments.js`): `POST /deployments`,
      `GET /deployments/{deplID}`, `GET /deploymentJobs`,
      `GET /deploymentEvents`, the three actions, with the checks of LWDM411,
      LWDM311 and LWDM511; a stand-in for the submit task and the jobs that
      moves deployments along the clock (a job takes 8 s; job 2 of a version
      with BAD in its name ends with RC 8)
- [x] Request page (D1): only environments with `canDeploy`, active
      versions, notes on approval, gate and a held environment, start now or
      not before a time; the refusals 08 54, 08 57, 08 59, 08 50
- [x] Deployment page: summary with a sentence on where it stands, jobs with
      the latest run and links to JCL and output, history; polling every 5 s
      (Q, U) or 30 s (W), none once final; cancel, retry, continue (D2-D4)
      with a confirmation form and the backend's refusal

## F4: approvals
- [x] Mock: `GET /approvalRequests`, `GET /approvals`, `POST /approvals`
      (checks of LWDM418: group, not own, once, W; a rejection needs a
      comment; the N-th approval queues it), `GET /deploymentJcl/{deplID}`
      (base64); the frozen JCL in the seed without JOB statement or result
      step, as LWDM411 stores it
- [x] Approvals page (AP1): what waits, oldest first, links to the
      deployment; no deciding from the list
- [x] Approval on the deployment page (AP2): N of M, the decisions with
      comments, links to each job's JCL; approve after ticking "I read the
      JCL of every job", reject with a reason; the top bar count follows
- [x] JCL page: line numbers, whitespace kept, tabs per job

## F5: runs and output
- [x] Mock (`mock/output.js`): `GET /jobRuns` (newest first), `GET /jobSteps`,
      `GET /spoolFiles`, `GET /spoolText/{runID}` (base64, at most 300 lines
      and 24000 bytes per part, as LWDM317); steps and spool files made up
      from the run, the result steps under their IF tests; output collected
      10 s after a job ends
- [x] Runs page: the runs of a job, newest first, so a failed run stays
      readable after a retry; steps with RC, abend or "Not run"; spool files;
      what it means when output is not collected yet (polls), not found or
      purged
- [x] Output page: one spool file with line numbers, "Next lines" through
      long files, tabs per spool file; `deplID` and `jobNo` in the query for
      the link back to the run

## F6: on t01
- [x] Backend `LWDM211` (`GET /deployments`) and `LWDM304`
      (`GET /applications/{appID}`), from `genlww.py`; `testIteration5.py`
- [x] Mock aligned with the backend: `startAfter` is never empty (the
      request time for "as soon as possible"), administrators may open any
      application, `deplStatus_filter` checked (08 03)
- [x] Build into `lwdeploy/LWWAdmin`
- [x] Build and deploy the modules, `processYAML.py`, `uploadLWW.py` on t01
- [x] Trying it, as `lwdeploy/docs/09-iteration-5.md` describes (2026-11-15)
