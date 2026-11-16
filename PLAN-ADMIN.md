# PLAN-ADMIN.md: owner and administrator screens

The screens of `lwdeploy/docs/10-iteration-6.md`, in steps F7 to F11, after
PLAN.md's F1 to F6, and the profile of `lwdeploy/docs/11-iteration-7.md` in
F12. Every new operation goes into the mock first, with the
checks and reason codes of the iteration doc; the screens are built and
tested against it, and the backend follows.

## Decisions

Agreed 2026-11-15, in addition to PLAN.md's:
- **Admin section** under `/lwdeploy/admin`, in a lazy chunk of its own
  (`src/pages/admin/AdminApp.jsx`), as ctflww-frontend does it. "Admin" in
  the top bar for administrators (`GET /me` `isAdmin`); anyone else who opens
  an admin page is told it is for administrators, and no admin path is
  called. The backend's administrator check is what protects the data.
- **Admin route folders** under `admin/` on LWW, run under `LWDU` with the
  login redirect, as the other routes. Not `LWDA`: the page is only
  `index.html`; the admin API paths are under `LWDA`.
- **Environment controls are read with `GET /environments/{envID}`**
  (`LWDM006` R), one call per environment: `GET /environments` has no
  controls. That path moves from 6b to 6a.
- **Group and userid fields** are choices from the allowlists. A value no
  longer in the allowlist stays selectable, marked, so saving a form never
  changes it unasked.
- **Approval off stores N as 0**, as the contract's `approvalCount` says
  ("0 = none"); the approver group may stay.
- **Mark stuck** sits on the runs page, under the list, for the chosen run
  when it is S and the user is an administrator. It is in the main chunk,
  not the admin one: it belongs to a page everyone uses.
- **The output of a run marked stuck is still collected:** the job did end
  in JES. The mock collects F runs as it does E runs.
- **To try mark stuck in the mock:** a request note with the word "hang"
  makes its jobs never report, as when the result step can't reach LWW.
- **Settings in the UI:** the editable ones with their ranges and a Save per
  setting; the others read-only, with what they are and that `DDL/SETTINGS`
  puts every setting back to the values of `envs/<env>.yaml`.
- **Owner features on the application page** show where `isOwner` is Y.
  An administrator who isn't in the owner group sees none, as the backend
  refuses them (08 50).
- **Variables are readable by every member:** the Variables tab and the
  "Variables" of each environment and version are there for everyone; only
  owners get add, edit and delete. Every value field repeats that members
  can read it, so it must never hold a password.
- **Reordering environments** swaps the `sortOrder` of two neighbours with two
  `PUT /environments/{envID}`. There is no reorder path; if the second update
  fails, the two have the same order until the next move, which the UI
  handles.
- **`sortOrder` 0 in a PUT keeps the order**, as the backend can't tell 0
  from a field that wasn't sent (`LWDM006`, `LWDM008`). The mock does the
  same, and moving never sends 0.
- **Editing an environment** reads it first with `GET /environments/{envID}`:
  the list has no description, and `PUT` replaces every field.
- **Templates are readable by every member**, as the variables are: the
  Templates tab and the template page show the JCL to everyone; owners get
  the editor and add, rename, reorder and delete.
- **Template JCL is sent as multipart** (`apiRequest` option `form`), with
  `jcl` as base64 of UTF-8 and `changeNote`, as 04-api.md describes.
- **The editor** is a textarea with line numbers, an 80-column ruler and
  guides at columns 71 and 80. It counts lines, lines over 80 and statements
  past column 71 while typing; the backend checks again on save. A refusal
  keeps the text in the editor.
- **`/template?templateID=&revision=`** shows an older revision read-only;
  the frozen JCL page links to the revision it was frozen from.
- **Comparing:** two revisions chosen from the list, side by side, with a
  longest-common-subsequence line diff (`src/lib/diff.js`); removed lines
  are paired with the added lines after them.
- **New deployments in the mock** freeze the current revision of each
  template with the variables filled in (version over environment over
  application, and the built-ins), and refuse 08 57 for the first variable
  without a value, as LWDM411 does; a template without JCL is 08 59. The
  seed deployments keep their JCL.
- **Removing an allowlist entry** asks no confirmation: it is added again as
  easily, and an entry in use is refused with where it is used.

## Routes and LWW folders

| Route | Screen | Use cases |
|---|---|---|
| `/lwdeploy/admin` | Applications: all of them, with their groups; create | A1 |
| `/lwdeploy/admin/app?appID=` | One application: details, edit, delete; its environments with their controls | A1, A2 |
| `/lwdeploy/admin/deployments` | Deployments of every application, filters on application, status and requester | A4 |
| `/lwdeploy/admin/lists` | Allowlists: RACF groups and deploy userids; add, describe, remove | A3 |
| `/lwdeploy/admin/settings` | Settings: the editable ones as a form, the others read-only | A5 |
| `/lwdeploy/profile` | Profile: the address LWD mails to (read-only), the three notification settings (F12) | U2 |
| `/lwdeploy/template?templateID=&revision=` | One template: the current JCL (editor for owners), an older revision, the revisions, compare | O2 |

Folders: `public/.admin`, and `app`, `deployments`, `lists` and `settings`
under `public/admin/` (each a `.name` file and a folder), each
`defaultWebpageId` `LD000001`, `loginRedirectWebpageId` `LD000003`,
`defaultTran` `LWDU`.

## F7: applications and environment controls (6a)
- [x] Mock (`mock/admin.js`): the administrator check (08 50);
      `GET /admin/applications` (every application, by appID),
      `GET`, `POST`, `PUT`, `DELETE /admin/applications/{appID}` with the
      checks of LWDM004 (code A-Z 0-9 at most 8 and unique, 08 11; groups from
      `RACFGRP`, 08 02; delete with deployments 08 53, without them with its
      environments, versions, variables and templates);
      `PUT /admin/environmentControls/{envID}` with those of LWDM006 K
      (`deployUser` from `DEPLUSER`, groups from `RACFGRP`, approval needs a
      group and N of at least 1, `execNode` a JES2 node name; deployments
      already requested keep their copy); `GET /admin/refTables` for the
      choices; `GET /environments/{envID}`
- [x] Seed: allowlists with the groups of the seed, `LWDNEW` and a second
      deploy userid
- [x] Admin section: lazy chunk, `AdminRoute`, navigation, "Admin" in the top
      bar, route folders
- [x] Applications page: the list, "New application" with code, name,
      description and the two groups; opens the new application
- [x] Application page: details, edit, delete with confirmation and the
      backend's refusal; the environments in order with deploy userid,
      approval, deployers and execution node; "Edit controls" with the A2
      warning about the size of the approver group
- [x] Lint and tests pass

## F8: allowlists, settings, deployments, mark stuck (6a)
- [x] Mock: `POST /admin/refTables` (RACFGRP and DEPLUSER only; keys in
      RACF form, 08 02; once, 08 11; settings 08 50),
      `PUT /admin/refTables/{tableID}?tabKey=` (descriptions; the editable
      settings within their ranges, 08 02; the others 08 50),
      `DELETE /admin/refTables/{tableID}?tabKey=` (08 53 naming where it is
      used; settings 08 50); seed with the settings of `DDL/SETTINGS`;
      `GET /admin/deployments` (every application, `appID_filter`, status
      and requester filters); `POST /admin/stuckRuns/{runID}` (only an S
      run, 08 53 otherwise: run F with result T and message "Marked stuck by
      <userid>", job and deployment F, event F)
- [x] Deployments page with the application column and filters
- [x] Allowlists page: both lists, add, edit the description, remove, the
      refusal for an entry in use
- [x] Settings page
- [x] "Mark stuck" on the runs page, with confirmation and when to use it
- [x] Lint and tests pass

## F9: owner features on the application page (6b)
- [x] Mock (`mock/owner.js`): owners only (08 50, administrators included);
      `POST /environments` (code unique per application, 08 11; at most 20,
      08 53; at the end, with approval on, N 1, no approver group, no deploy
      userid), `PUT` (never the controls), `DELETE` (08 53 with deployments;
      takes its variables); `GET /versions/{versionID}`, `POST /versions`
      (checks of LWDM405: name 08 01, type 08 02, location 08 03, unique
      08 11), `PUT` and `DELETE` only while never requested (08 53),
      `POST /versionRetirements/{versionID}` (once); `GET /variables` one
      level (08 02 for both levels, 08 13 for another application's),
      `POST`, `PUT`, `DELETE /variables` (name rules, not LWD..., once per
      level 08 11)
- [x] Seed: application variables of DEMO, one of PRD, one of V1.0.0
- [x] `VariableList`, one component for the three levels, with the warning
      about secrets at every value field
- [x] Environments tab: add, edit, move up and down, delete with the
      backend's refusal; variables per environment
- [x] Versions tab: register, edit and delete while never requested, retire;
      variables per version
- [x] Variables tab: the application's variables, and how the levels and the
      built-ins work
- [x] Lint and tests pass

## F10: templates (6b)
- [x] Mock (`mock/templates.js`): `GET /templates` (active, in order),
      `GET`, `POST` (no JCL, revision 0; at most 20 active, 08 53), `PUT`
      (name, order, highest RC 0-4095), `DELETE` (status D; still readable)
      `/templates/{templateID}`; `GET /templateRevisions` (newest first);
      `GET /templateJcl/{templateID}` (0 the current one);
      `POST /templateJcl/{templateID}` multipart with the checks of LWDM410
      (08 58 for a missing or bad field; 08 56 naming the first line: JOB,
      `USER=`/`PASSWORD=`, JES2, JES3, over 80 characters, over 300 lines,
      empty; warnings for undefined variables and statements past column 71);
      deployments fill in the variables (08 57) and refuse a template without
      JCL (08 59)
- [x] Seed: the revisions of both DEMO templates, with variables
- [x] Templates tab: the templates in order with highest RC and revision,
      the note when one has no JCL; for owners add (then the template page),
      edit, move up and down, delete
- [x] Template page: current JCL, editor with ruler and counts, save with a
      change note, the result with the first warning, the refusal; revisions
      with links; an older revision read-only; compare two side by side
- [x] Link from the frozen JCL to its template revision
- [x] Route folder `template`
- [x] Lint and tests pass; multipart checked against the Vite mock

## F11: on t01
- [x] Backend of 6a and 6b, from `genlww.py`; `testIteration6a.py`,
      `testIteration6.py` on t01 (2026-11-15)
- [x] Build into `lwdeploy/LWWAdmin`, with the route folders `admin/...` and
      `template`
- [x] `uploadLWW.py`, then try the screens on t01 as an administrator and as
      an owner (2026-11-16)

## F12: profile (iteration 7)
- [x] Mock: `PUT /me` with the checks of LWDM002: the three settings of the
      own row, each Y or N (08 02, also when one is missing); the address is
      never changed
- [x] Profile page: the address with where it comes from (RACF `WAEMAIL`,
      copied daily), or that LWD has none and can't mail; "Mail me when" with
      the three settings and Save; the session reloads afterwards
- [x] The userid in the top bar opens it (an icon on narrow screens); route
      folder `profile`
- [x] Lint and tests pass
- [x] Build into `lwdeploy/LWWAdmin`, together with the backend of
      iteration 7 (`LWDM002` gives `PUT /me` its LWW steps)
- [x] `uploadLWW.py` and trying the profile on t01 (2026-11-16)

