# Regression Scripts

These scripts cover the flows that were the most fragile during recent PFMEA and PCP work.

Required env vars:

- `REGRESSION_EMAIL`
- `REGRESSION_PASSWORD`
- `PFMEA_REGRESSION_PROJECT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Additional env vars for invite / organization regression:

- `REGRESSION_ADMIN_EMAIL`
- `REGRESSION_ADMIN_PASSWORD`
- optional: `REGRESSION_TEST_EMAIL_DOMAIN`
  - default: `example.test`
  - used only to generate unique synthetic addresses for invite-flow tests

Optional extra project env:

- `PCP_REGRESSION_PROJECT_ID`
  If omitted, `regression:pcp:smoke` falls back to `PFMEA_REGRESSION_PROJECT_ID`.

Optional env vars:

- `REGRESSION_BASE_URL` default: `http://localhost:3000`
- `REGRESSION_PREFLIGHT_SKIP_URL=1` when only env shape should be checked and the app is not running yet
- `PLAYWRIGHT_PACKAGE_PATH` when Playwright is not installed locally and should be resolved from a custom path

Local env loading:

- browser regression scripts load `.env.local`
- they also load `.env.regression.local` if present
- both files are ignored by git
- use `scripts/regression/regression.env.example` as the safe template

Recommended usage:

- Run against a dedicated regression project, not production data.
- Start the app locally before browser regressions.
- PFMEA browser regressions discard any existing draft first, so each run starts from a clean draft.

Preflight:

- `npm run regression:preflight`
- checks required browser-regression env values
- warns when `REGRESSION_BASE_URL` is not reachable
- does not print secret values

Project access verification:

- `npm run regression:verify-project`
- signs in with `REGRESSION_EMAIL` / `REGRESSION_PASSWORD`
- verifies that `PFMEA_REGRESSION_PROJECT_ID` is visible for that user
- verifies that the project has an open or draft revision with PFMEA rows
- optionally checks `PCP_REGRESSION_PROJECT_ID` when it is set
- does not print passwords or API keys

Available scripts:

- `npm run regression:all`
- `npm run regression:preflight`
- `npm run regression:verify-project`
- `npm run regression:shared`
- `npm run regression:app-header`
- `npm run regression:error-utils`
- `npm run regression:pfmea-action-validation`
- `npm run regression:pfmea-continuation`
- `npm run regression:pfmea-date`
- `npm run regression:pfmea-display`
- `npm run regression:pfmea-hierarchy`
- `npm run regression:pfmea-operation`
- `npm run regression:pfmea-payload`
- `npm run regression:pfmea-pcp`
- `npm run regression:pfmea-revision`
- `npm run regression:pfmea-row-factory`
- `npm run regression:pfmea-row-normalization`
- `npm run regression:pfmea-row-match`
- `npm run regression:pfmea-row-order`
- `npm run regression:pfmea-risk`
- `npm run regression:pfmea-value`
- `npm run regression:risk-engine`
- `npm run regression:org:invite-flow`
- `npm run regression:org:viewer-flow`
- `npm run regression:pfmea:merge`
- `npm run regression:pfmea:order`
- `npm run regression:pfmea:save`
- `npm run regression:pcp:smoke`

## Invite / Organization flow

`npm run regression:org:invite-flow` covers:

1. global admin logs in
2. admin creates a new organization with a pending champion invitation
3. champion sets the first password from the secure invitation link
4. champion sends an engineer invitation
5. engineer sets the first password from the secure invitation link
6. script verifies that engineer does not get settings-level access

Important:

- this flow does **not** require a real mailbox
- the script uses unique synthetic emails like `rf360-champion-...@example.test`
- invitation links are copied from the UI, so we validate the product workflow without depending on email delivery

If you later want to validate real email delivery too, add a separate mailbox-backed pass. Keep that separate from core application regression.

## Demo seed guard

`scripts/seed/watlow-demo-data.mjs` uses a service role key and rewrites demo project data. It refuses to run unless:

- `ALLOW_DEMO_SEED=YES`
- `SUPABASE_URL`
- `SERVICE_ROLE_KEY`

Optional:

- `DEMO_SEED_ORG_NAME`, default: `WATLOW`

Run it only against a known demo/staging organization.

`npm run regression:org:viewer-flow` covers:

1. global admin creates a new organization
2. champion sets the first password from the secure invitation link
3. champion confirms that `CUSTOMER` is not exposed in the invitation role selector
4. champion sends a `VIEWER` invitation
5. viewer sets the first password from the secure invitation link
6. script verifies that viewer does not get settings-level access

Why `customer` is still guarded:

- current schema still grants broad org-level reads to regular members in several places
- enabling `customer` as a normal org member now would over-grant access
- the role should be enabled only together with a dedicated per-module access model

GitHub Actions:

- Workflow: `.github/workflows/regression.yml`
- `Build` job runs on every matching push / PR even without browser-regression secrets.
- `Browser Regression` runs only when these secrets are configured:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `REGRESSION_EMAIL`
  - `REGRESSION_PASSWORD`
  - `PFMEA_REGRESSION_PROJECT_ID`
  - optional: `PCP_REGRESSION_PROJECT_ID`
