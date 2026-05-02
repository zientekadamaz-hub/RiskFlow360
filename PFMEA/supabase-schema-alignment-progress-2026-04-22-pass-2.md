# Supabase Schema Alignment Progress - 2026-04-22 Pass 2

## Scope
- cleanup repo-level SQL bootstrap files
- remove legacy and dangerous setup patterns from `db/`
- keep runtime application behavior unchanged

## What Was Changed

### 1. Sanitized legacy bootstrap SQL files
Updated:
- `db/pfd_editing.sql`
- `db/pfmea_editing.sql`
- `db/pcp_editing.sql`
- `db/control_plan_rows_rls.sql`

Changes:
- kept structural DDL only:
  - tables
  - columns
  - indexes
  - `enable row level security`
  - trigger helper for `auto_generate_pcp()`
- removed insecure bootstrap logic:
  - permissive policies based on `auth.uid() is not null`
  - broad grants for `anon/authenticated`
  - hard-reset/open-all RLS setup
  - backfill from missing `process_module_revisions`
- added clear header comments pointing to the real hardening migrations:
  - `2026-04-22_supabase_critical_auth_hardening.sql`
  - `2026-04-22_supabase_session_history_hardening.sql`
  - `2026-04-22_supabase_invites_projects_hardening.sql`
  - `2026-04-22_supabase_anon_surface_reduction.sql`

Effect:
- repo no longer suggests that broad authenticated access is acceptable
- bootstrap scripts are now safer by default
- the current schema contract is documented in the right place

### 2. Deprecated `pfmea_row_backups.sql`
Updated:
- `db/pfmea_row_backups.sql`

Changes:
- replaced old table-creation script with a deprecation notice and no-op `DO` block
- made it explicit that `public.pfmea_row_backups` is no longer part of the active schema contract

Effect:
- new environments will not accidentally recreate a dead table
- repo now reflects the current app behavior after runtime cleanup

## Validation
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

Additional DB repo scan:
- no remaining legacy bootstrap matches for:
  - `auth.uid() is not null`
  - `using (true)`
  - `with check (true)`
  - `process_module_revisions`
  - `pfmea_row_backups_all_auth`
- remaining `grant ...` matches in `db/` are intentional and exist only in the current hardening migrations

## Assessment
This pass cleaned the repo-level SQL layer enough that:
- app runtime is aligned with live schema
- local SQL scripts no longer advertise dangerous or obsolete patterns

## Next Sensible Step
Now we are in a good place to start the first destructive cleanup migration in live Supabase:
1. remove dead views:
   - `org_invitations_list`
   - `org_license_usage`
   - `severity_effective`
2. then remove low-risk dead columns:
   - `access_requests.requested_seats`
   - `operations.description`
   - `operations.special_characteristic`

I would still leave these for a later decision:
- `projects.user_id`
- `projects.standard`
- `organization_invitations.expires_at`
- `projects.current_revision_id` together with `processes`
