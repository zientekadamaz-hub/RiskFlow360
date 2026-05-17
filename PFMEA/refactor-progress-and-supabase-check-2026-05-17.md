# Refactor progress and Supabase check

Date: 2026-05-17

## Scope completed in this pass

### PFD

- Extracted PFD session, project data, canvas data, save flow, edit session actions and flow view model into `src/features/pfd`.
- Kept node/edge mutation behavior inside the page where it is still tightly coupled and regression-prone.
- Validation after each step: `typecheck`, `lint`, `regression:shared`, `build`.

### PCP

- Extracted PCP page model and visible column hook into `src/features/pcp`.
- Added smoke coverage for PCP page model and visible column behavior.
- Left the core table/edit flow unchanged.

### Task Management

- Extracted Task page model, table controller, table cells, table header and Supabase action controller into `src/features/tasks`.
- `app/task-management/page.tsx` is now a screen coordinator and no longer imports Supabase or task service calls directly.
- Added smoke coverage for:
  - task page model,
  - task table controller,
  - task table cells,
  - task table header,
  - task actions controller.

### Reports

- Extracted shared `ReportFilterSelect` for RPN Matrix and Progress Chart.
- Kept existing report behavior and calculations unchanged.
- Added smoke coverage to prevent local filter select duplication from returning.

## Supabase hygiene completed

- Removed tracked `supabase/.temp/*` files from git while keeping the local files on disk.
- `.gitignore` already ignores `/supabase/.temp/`, so future CLI temp files should stay local.
- This avoids committing local Supabase project state such as project ref, pooler URL and service version cache.

## Supabase static review

Reviewed local migrations in `supabase/migrations`.

Observed:

- Security definer functions in migrations use explicit `search_path`.
- RPC execute grants are scoped in recent migrations.
- PFMEA save timeout indexes are non-destructive `create index if not exists`.
- PFMEA publish/history RPC is a non-destructive wrapper around the existing publish flow.
- The only explicit `drop table` is `public.codex_test_tmp`, documented as cleanup of a test object.
- RLS remediation migrations intentionally drop/recreate policies; do not re-run against production without current backup and live lint.

## Live Supabase check status

Attempted:

```powershell
npx supabase --version
npx supabase migration list --linked
```

Result:

- Supabase CLI available: `2.98.0`.
- CLI reports newer version available: `2.98.2`.
- `migration list --linked` is blocked because no access token is available in the shell session.

Important:

- I did not paste or reuse manually shared tokens in shell commands, to avoid persisting secrets in command history or logs.
- To complete live checks, run `supabase login` locally or set `SUPABASE_ACCESS_TOKEN` securely in the shell/session.

## Latest validation state

For the report refactor stage:

- `npm run regression:report-filter-select` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run regression:shared` passed.
- `npm run build` passed.

## Remaining recommended order

1. Push current commits to GitHub Desktop.
2. Run live Supabase checks after secure login:
   - `npx supabase migration list --linked`
   - `npx supabase db lint --linked`
3. Review Settings pages for remaining page-level duplication.
4. Prepare deployment readiness pass:
   - env variables,
   - domain `riskflow360.com`,
   - Supabase auth redirect URLs,
   - production backup,
   - manual smoke checklist.
5. Only after live Supabase checks and manual smoke tests, move toward hosting/deployment.
