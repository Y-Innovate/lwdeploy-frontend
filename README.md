# lwdeploy-frontend

Web UI of LWD, the Y-Innovate z/OS deployment front end: React + Vite, hosted
by the LWW gateway in CICS under `/lwdeploy/`, next to the API of the
`lwdeploy` backend. See PLAN.md and PLAN-ADMIN.md for the build plans, and
`lwdeploy/docs/09-iteration-5.md` and `10-iteration-6.md` for the screens.

## Run locally

```
npm install
npm run dev        # http://localhost:5175/lwdeploy/, API answered by mock/
npm test
npm run lint
```

## Mocks

In dev, `mock/` answers the API and imitates LWW's sign-in, with an in-memory
database seeded relative to the moment Vite starts (`mock/seed.js`), modelled
on t01's DEMO application. Restart Vite to reset it.

| Userid | Who |
|---|---|
| `DEV0001` | Member of DEMO and PAYR, deployer in PRD; requested the deployment waiting in PRD |
| `DEV0002` | Member of DEMO and approver in PRD |
| `APR0001` | Only approver in PRD |
| `OWN0001` | Owner of DEMO and HRAP |
| `NOROLE1` | No role anywhere |

Any passphrase works, except one that starts with `wrong`. "Sign in with
Entra" signs you in as administrator `ADMIN01`. "Sign out" ends the mock
session, to switch users.

Deployments run in the mock too (`mock/deployments.js`): a job takes 8
seconds, and job 2 of `V1.0.1-BAD` ends with RC 8, above its highest RC, so
retry, continue and cancel can be tried. DEV starts held by the failed
deployment 6: cancel or continue it before deploying to DEV again.
Deployment 7, V1.0.0 to PRD, waits for two approvals: sign in as `APR0001`
and as `DEV0002` to approve it, and it starts.

As `ADMIN01`, "Admin" in the top bar opens the administrators' pages
(`mock/admin.js`). The allowlists hold the groups of the seed, plus `LWDNEW`
for a new application, and the deploy userids `LWDDEPL` and `LWDDEPP`. PAYR
and HRAP were never deployed, so they can be deleted; DEMO can't. A request
note with the word "hang" makes its jobs never report, so an administrator
can try "Mark stuck" on the runs page.

The userid in the top bar opens the profile: the address (`NOROLE1` has
none) and the notification settings, saved with `PUT /me`.

As `OWN0001`, owner of DEMO and HRAP, the application page offers the owner
features: environments, versions and variables. DEMO has variables at all
three levels; V1.0.1-BAD and the versions you register can be changed until
they are deployed. The Templates tab leads to each template's JCL: owners
edit it, save it as a new revision and compare revisions. New deployments
use the current revisions with the variables filled in, so a `${NAME}` that
has no value is refused when requesting.

## Deploy

`npm run build` writes `index.html`, `assets/` and the contents of `public/`
into `../lwdeploy/LWWAdmin/` (or `LWD_LWW_DIR`), after removing the previous
build there; the API placeholders stay. Then, in the backend repo,
`python python/uploadLWW.py`.
