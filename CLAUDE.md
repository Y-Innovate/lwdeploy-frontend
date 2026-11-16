# CLAUDE.md

## This app
- Web UI of LWD (lwdeploy), a z/OS deployment front end: applications,
  environments, versions, deployments with approval, job output.
- Base path `/lwdeploy` (the app never runs in `/`), API path
  `/lwdeploy/API/v1`.
- Backend: CICS/COBOL/DB2 REST API behind the LWW gateway, repo `lwdeploy`.
  Its actors, use cases, data model and API guide are in
  `lwdeploy/docs/01..04`; the iteration this UI belongs to is
  `lwdeploy/docs/09-iteration-5.md` (screens and the API calls behind them).
  The spec `lwdeploy/openapi/lwd_1.0.0.yaml` is copied into `openapi/lwd.yaml`.
  Contract changes start in the backend repo.
- Hosted by LWW itself, not by a BFF: the build goes into `lwdeploy/LWWAdmin/`
  and is uploaded with `lwdeploy/python/uploadLWW.py`.
- Audiences in this iteration: members, deployers and approvers (use cases
  M1-M4, D1-D4, AP1-AP2). Owner and admin screens come later (iteration 6).
  Everyone signs in with RACF userid + passphrase or with Entra; both give a
  RACF userid. The backend decides who may do what; the UI only hides what
  can't be used, from the `is*`/`can*` flags.
- Build plans: PLAN.md (iteration 5), PLAN-ADMIN.md (iteration 6).

## Stack rules
@docs/stack-react-lww.md
