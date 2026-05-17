# Supabase migration drift report

Generated: 2026-05-17T16:48:53.656Z
Baseline observed: 2026-05-17
Project ref: piewgtoldsnyynueztos

## Summary

- local migrations: 16
- applied in remote baseline: 4
- pending in remote baseline: 12

## Pending migrations

| Version | Migration | Severity | Why it matters |
|---|---|---|---|
| 20260502084500 | `20260502084500_live_security_remediation.sql` | High | RLS/policies |
| 20260502085500 | `20260502085500_function_search_path_remediation.sql` | Low | schema metadata only |
| 20260502090500 | `20260502090500_unindexed_foreign_keys_remediation.sql` | Medium | indexes |
| 20260502092000 | `20260502092000_rls_initplan_remediation.sql` | High | RLS/policies, policy replacements |
| 20260502093500 | `20260502093500_multiple_permissive_policies_remediation.sql` | High | RLS/policies, policy replacements |
| 20260502094500 | `20260502094500_drop_codex_test_tmp.sql` | Medium | drops objects |
| 20260502095000 | `20260502095000_function_lint_remediation.sql` | High | security definer, functions |
| 20260502100500 | `20260502100500_access_request_status_remediation.sql` | High | security definer, functions |
| 20260502101000 | `20260502101000_access_request_unique_active_index.sql` | Medium | indexes, constraints/unique indexes |
| 20260502101500 | `20260502101500_rpc_execute_scope_tightening.sql` | High | RPC permissions |
| 20260502113000 | `20260502113000_pfmea_save_timeout_indexes.sql` | Medium | indexes |
| 20260502193000 | `20260502193000_pfmea_publish_with_history_rpc.sql` | High | RPC permissions, security definer, functions |

## Recommended rollout

1. Do not run `npx supabase db push` against the main linked project before backup/staging validation.
2. Create a Supabase backup or dashboard snapshot of the current project.
3. Apply pending migrations to a regression/staging project first.
4. Run `npm run regression:preflight`, `npm run regression:verify-project`, `npm run regression:all`.
5. Run `npx supabase db lint --linked --schema public --fail-on none` after `SUPABASE_DB_PASSWORD` is set locally.
6. Deploy to the main project only after staging is green.

## Notes

- This report uses the stored remote baseline and does not connect to Supabase.
- Refresh `supabase/remote-migration-baseline.json` only after a successful `npx supabase migration list` check.
- Never commit database passwords, access tokens or service role keys.

