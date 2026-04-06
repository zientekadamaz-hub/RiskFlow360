# Regression Scripts

These scripts cover the flows that were the most fragile during recent PFMEA and PCP work.

Required env vars:

- `REGRESSION_EMAIL`
- `REGRESSION_PASSWORD`
- `PFMEA_REGRESSION_PROJECT_ID`

Optional extra project env:

- `PCP_REGRESSION_PROJECT_ID`
  If omitted, `regression:pcp:smoke` falls back to `PFMEA_REGRESSION_PROJECT_ID`.

Optional env vars:

- `REGRESSION_BASE_URL` default: `http://localhost:3000`
- `PLAYWRIGHT_PACKAGE_PATH` when Playwright is not installed locally and should be resolved from a custom path

Recommended usage:

- Run against a dedicated regression project, not production data.
- Start the app locally before browser regressions.
- PFMEA browser regressions discard any existing draft first, so each run starts from a clean draft.

Available scripts:

- `npm run regression:all`
- `npm run regression:pfmea:merge`
- `npm run regression:pfmea:order`
- `npm run regression:pfmea:save`
- `npm run regression:pcp:smoke`

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
