# Supabase migration rollout

Date: 2026-05-17

## Scope

Pending Supabase migrations were applied to the linked test database:

- project ref: `piewgtoldsnyynueztos`
- project name: `zientekadamaz-hub's Project`

The user confirmed that current database data is test data and has no business value, so a full data backup was not required for this rollout.

## Applied migrations

The following migrations were pushed successfully:

- `20260502084500_live_security_remediation.sql`
- `20260502085500_function_search_path_remediation.sql`
- `20260502090500_unindexed_foreign_keys_remediation.sql`
- `20260502092000_rls_initplan_remediation.sql`
- `20260502093500_multiple_permissive_policies_remediation.sql`
- `20260502094500_drop_codex_test_tmp.sql`
- `20260502095000_function_lint_remediation.sql`
- `20260502100500_access_request_status_remediation.sql`
- `20260502101000_access_request_unique_active_index.sql`
- `20260502101500_rpc_execute_scope_tightening.sql`
- `20260502113000_pfmea_save_timeout_indexes.sql`
- `20260502193000_pfmea_publish_with_history_rpc.sql`

## Remote migration status

After rollout:

- local migrations: 16
- remote migrations: 16
- migration drift: 0

The stored baseline was updated in:

```text
supabase/remote-migration-baseline.json
```

The drift report was regenerated in:

```text
PFMEA/supabase-migration-drift-2026-05-17.md
```

## Database lint

Command:

```powershell
npx supabase db lint --linked --schema public --fail-on none
```

Result:

```text
No schema errors found
```

## Application validation

Passed after migration:

- `npm run typecheck`
- `npm run lint`
- `npm run regression:shared`
- `npm run build`

Not run:

- `npm run regression:verify-project`

Reason:

- local regression browser credentials are not configured yet
- missing env: `REGRESSION_EMAIL`

## Notices during migration

Supabase reported several `already exists, skipping` notices for indexes/policies/test table cleanup.

Interpretation:

- migrations were idempotent
- no blocking migration error occurred
- no destructive data operation was reported against business tables

## Remaining work

1. Configure `.env.regression.local`.
2. Run:

```powershell
npm run regression:preflight
npm run regression:verify-project
npm run regression:all
```

3. Manually smoke test:

- login/logout
- Projects summary counts
- PFMEA edit/save
- PFD open/save
- PCP open/save
- RPN Matrix
- Progress Chart
- Organizations / invitations
- Customer Access

4. Add GitHub Actions secrets for browser regression if we want CI to run the full browser suite.
