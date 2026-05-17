# Regression environment setup

Date: 2026-05-17

## Goal

Create a separate Supabase-backed environment for browser regression tests.

Plain language:

- We should not run mutating browser tests on the working/live database.
- PFMEA tests can discard drafts, add rows and save revisions.
- PCP tests can edit generated control-plan rows.
- Those actions are correct for regression, but risky on real data.

## Current repository support

Already available:

- GitHub Actions workflow: `.github/workflows/regression.yml`
- Static quality gate:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run regression:shared`
  - `npm run build`
- Browser regression suite:
  - `npm run regression:all`
  - `npm run regression:pfmea:merge`
  - `npm run regression:pfmea:order`
  - `npm run regression:pfmea:save`
  - `npm run regression:pcp:smoke`
  - `npm run regression:pcp:save`
- Local preflight:
  - `npm run regression:preflight`

## Required Supabase setup

1. Create a separate Supabase project for regression.

Recommended name:

```text
RiskFlow360 Regression
```

2. Apply the same migrations as the main project.

Recommended check:

```powershell
npx supabase migration list --linked
```

3. Seed or create a small regression organization.

Minimum data:

- one active organization
- one regression user
- one open project with PFD/PFMEA/PCP data
- one project id suitable for PFMEA browser tests
- optionally one separate project id suitable for PCP tests

4. Create a regression user.

Recommended role:

- internal/admin/champion enough to edit PFMEA and PCP

Avoid:

- using your personal production user
- using a real customer user

## Required local env

Create a local file named:

```text
.env.regression.local
```

Do not commit it. It is ignored by git.

Template:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-regression-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-regression-anon-key

REGRESSION_EMAIL=regression-user@example.com
REGRESSION_PASSWORD=your-regression-password
PFMEA_REGRESSION_PROJECT_ID=00000000-0000-0000-0000-000000000000
PCP_REGRESSION_PROJECT_ID=00000000-0000-0000-0000-000000000000

REGRESSION_BASE_URL=http://localhost:3000
REGRESSION_BROWSER_ATTEMPTS=3
```

Optional organization/invitation regression:

```dotenv
REGRESSION_ADMIN_EMAIL=regression-admin@example.com
REGRESSION_ADMIN_PASSWORD=your-regression-admin-password
REGRESSION_TEST_EMAIL_DOMAIN=example.test
```

## Local validation flow

1. Start the app:

```powershell
npm run dev
```

2. In a second PowerShell window, check env:

```powershell
npm run regression:preflight
```

3. Run the browser suite:

```powershell
npm run regression:all
```

If the app is not running and you only want to check env values:

```powershell
$env:REGRESSION_PREFLIGHT_SKIP_URL='1'
npm run regression:preflight
```

## Required GitHub secrets

Set these in:

```text
GitHub repository -> Settings -> Secrets and variables -> Actions -> New repository secret
```

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `REGRESSION_EMAIL`
- `REGRESSION_PASSWORD`
- `PFMEA_REGRESSION_PROJECT_ID`

Optional:

- `PCP_REGRESSION_PROJECT_ID`

Organization/invitation regression, if enabled later:

- `REGRESSION_ADMIN_EMAIL`
- `REGRESSION_ADMIN_PASSWORD`
- `REGRESSION_TEST_EMAIL_DOMAIN`

## GitHub Actions behavior

- Build job always runs on relevant pushes and pull requests.
- Browser Regression job runs only when required secrets are present.
- If secrets are missing, GitHub will show warnings, but the normal build job can still stay green.

## Safety rules

- Do not point regression secrets at the main working database.
- Do not use a customer account for `REGRESSION_EMAIL`.
- Do not run demo seed scripts without verifying the target Supabase project.
- Do not store service role keys in `.env.regression.local` unless a specific script requires them.
- Keep regression data small and disposable.

## Next step

Create the regression Supabase project and one editable PFMEA project, then add the GitHub secrets listed above.
