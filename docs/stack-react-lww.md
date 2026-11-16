# Stack rules: React SPA hosted on LWW

No server of its own (no BFF, Docker, OpenShift or Redis): the built app is
served by the LWW gateway in CICS, next to the API it calls.

## Stack
- React (functional components and hooks only, no UI libraries), React Router,
  Vite, Tailwind CSS (no other CSS frameworks). Tabler icons via CDN.
- vite-plugin-mock-dev-server: mocks of the backend API, so the UI runs locally
  without a backend (`npm run dev`).
- Vitest + Testing Library, ESLint.
- No server of our own. `npm run build` writes into the backend repo's
  `LWWAdmin/` folder, and `python/uploadLWW.py` there puts it on LWW.

## Authentication: LWW sessions
- LWW holds the session; the browser only gets LWW's session cookie. API calls
  are same-origin (`credentials: 'same-origin'`), with no token in the app.
- Users sign in on the React page `/lwdeploy/login`: a plain HTML form that
  posts userid and passphrase to the LWW page `process_login.html` (pre-exec
  `LWWADPLI`), or the "Sign in with Entra" button there, which starts LWW's
  Entra redirect (`redirect_to_sso_login.html`, `auth` with `LWWADPL1` and
  `LWWADPL2`). Both are for every user and lead to the same RACF userid. Those
  LWW pages are plain HTML files in `public/`, not React; PLAN.md lists them.
- Who is signed in comes from `GET /me`: `userID`, `isAdmin` (Y/N) and
  `approvalsWaiting`, or a 404 without the backend's envelope (or 401) when
  there is no session. That call doesn't send the user to sign-in
  (`signInOn401: false`); every other one without a session does.
- What a user may do per application or environment comes from the `is*` and
  `can*` flags in the responses (`isOwner`, `canDeploy`, `canApprove`,
  `canCancel`, `canRetry`), never from the UI's own reasoning.
- Passphrases are never stored in the browser (no localStorage, no
  sessionStorage) or logged.

## Hosting on LWW
- Base path `/lwdeploy/`, API `/lwdeploy/API/v1`. LWW has no SPA fallback: a deep link
  only works if LWW has a file or a folder (with index.html as its default page)
  at that path. See PLAN.md for how routes are mapped.
- A file or folder on LWW can have a hidden `.name` metadata file next to it.
  Those of the app are in `public/`; those of the API placeholders in the
  backend repo's `LWWAdmin/`. Fixed file IDs (`LD0000nn`) only where another
  file refers to them (default page, login redirect).
- The LWW Admin API spec is far from complete: take the `.name` fields from
  files that are known to work (the existing ones in `public/`), and say when a
  field is a guess.

## Conventions
- Small components (under ~150 lines); split when they grow.
- No new dependencies without asking first.
- Every API module and hook has a unit test; pages get a test for their main
  flow and their error cases.
- LWW returns an empty text field as `null` and GRAPHIC columns blank-padded:
  the API client trims strings, and the UI treats `null` and `""` alike.
- Single-character codes (`Y`/`N`, statuses, results) are translated to words in
  one place (`src/lib/codes.js`), never shown raw.

## Workflow
- Work in small steps; after each step run lint and tests. Update PLAN.md
  checkboxes.
- If the spec is unclear, ask rather than guess.
- LWW, CICS and Entra aren't reachable from the dev box: say what could not be
  tested. Ask before running anything against real hosts.
- When the API contract changes, `openapi/` and the mocks must follow the
  backend repo (`lwdeploy/openapi/lwd_1.0.0.yaml`).
- The user commits; don't commit.
