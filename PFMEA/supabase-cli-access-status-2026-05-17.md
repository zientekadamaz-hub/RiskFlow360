# Supabase CLI access status

Date: 2026-05-17

## Summary

Supabase CLI is now authenticated locally and can see the linked RiskFlow 360 project.

No database changes were applied during this check.

## Confirmed project

Linked project:

- project ref: `piewgtoldsnyynueztos`
- name: `zientekadamaz-hub's Project`
- region: `North EU (Stockholm)`

## Migration drift

`npx supabase migration list` shows that local migrations are ahead of the remote database.

Remote currently has these migrations applied:

- `20260426211900_member_directory_champion_guard`
- `20260426213000_set_watlow_license_10_seats`
- `20260426214500_ensure_watlow_license_10_seats`
- `20260428223000_invitation_token_expiry_hardening`

Local migrations not applied remotely yet:

- `20260502084500_live_security_remediation`
- `20260502085500_function_search_path_remediation`
- `20260502090500_unindexed_foreign_keys_remediation`
- `20260502092000_rls_initplan_remediation`
- `20260502093500_multiple_permissive_policies_remediation`
- `20260502094500_drop_codex_test_tmp`
- `20260502095000_function_lint_remediation`
- `20260502100500_access_request_status_remediation`
- `20260502101000_access_request_unique_active_index`
- `20260502101500_rpc_execute_scope_tightening`
- `20260502113000_pfmea_save_timeout_indexes`
- `20260502193000_pfmea_publish_with_history_rpc`

Plain language:

- the codebase expects several Supabase improvements that are not yet deployed to the remote database
- some are performance-related, including PFMEA save timeout indexes
- some are security/RLS/RPC changes
- they should not be pushed directly to the live database without backup and validation

## DB lint status

Command attempted:

```powershell
npx supabase db lint --linked --schema public --fail-on none
```

Result:

- failed before lint results were produced
- Supabase pooler returned temporary connection blocking after repeated authentication failures
- CLI requested `SUPABASE_DB_PASSWORD`

Important:

- do not keep retrying immediately
- wait for the temporary pooler block to clear
- set the database password only as a local environment variable
- do not commit it and do not paste it into reports

Recommended command, when ready:

```powershell
$env:SUPABASE_DB_PASSWORD='<database-password>'
npx supabase db lint --linked --schema public --fail-on none
```

## Risk assessment

High priority:

- migration drift must be resolved before production release
- remote database may be missing PFMEA save performance indexes
- remote database may be missing RLS and RPC hardening migrations

Medium priority:

- DB lint cannot currently run until database password access is configured
- lack of separate regression Supabase project means browser regression should not target the current live/working database

## Safe next order

1. Wait for Supabase pooler temporary block to clear.
2. Prepare a backup/snapshot of the current Supabase project.
3. Create or choose a separate regression/staging Supabase project.
4. Apply pending migrations to staging/regression first.
5. Run:

```powershell
npm run regression:preflight
npm run regression:verify-project
npm run regression:all
npx supabase db lint --linked --schema public --fail-on none
```

6. Only after staging is green, plan deployment of pending migrations to the main project.

## Current stop rule

Do not run:

```powershell
npx supabase db push
```

against the linked main project until a backup/staging validation exists.
