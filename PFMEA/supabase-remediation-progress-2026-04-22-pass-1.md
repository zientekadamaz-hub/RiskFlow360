# Supabase Remediation Progress - 2026-04-22 - Pass 1

## Scope
First live remediation pass focused on confirmed `CRITICAL` / highest `HIGH` findings from the direct Supabase audit.

## Changes Applied To Live Supabase

### 1. `control_plan_rows` locked down
- Removed open CRUD policies:
  - `control_plan_rows_select_all`
  - `control_plan_rows_insert_all`
  - `control_plan_rows_update_all`
  - `control_plan_rows_delete_all`
- Revoked all table privileges from `anon`
- Replaced broad access with scoped policies:
  - `control_plan_rows_select_member`
  - `control_plan_rows_insert_editor`
  - `control_plan_rows_update_editor`
  - `control_plan_rows_delete_editor`

### 2. `risk_matrix_cells` broad update path removed
- Dropped the overlapping permissive policy:
  - `update risk matrix`
- Remaining policies are now only the organization-scoped ones

### 3. Critical RPC functions hardened
- Replaced `ensure_process_draft(...)`
- Replaced `publish_process_module_revision(...)`

New behavior:
- both functions now derive acting user from `auth.uid()`
- both reject unauthenticated calls
- both enforce authorization before mutating data
- both allow:
  - `global admin`
  - organization role `admin`
  - organization role `champion`
  - organization role `engineer`
- both stop trusting caller-supplied `p_user_id`

### 4. Public function exposure reduced
Removed `PUBLIC` / `anon` execute from:
- `get_my_header()`
- `accept_invitation()`
- `accept_invitation(uuid)`
- `create_org_invitation(uuid, text, app_role)`
- `set_invitation_status(uuid, text)`
- `set_invitation_status(uuid, text, text)`
- `ensure_process_draft(uuid, uuid)`
- `publish_process_module_revision(uuid, text, text, uuid)`
- `is_org_admin_or_champion_v2(uuid)`

Kept `authenticated` and `service_role` so current app flows continue to work.

## Files Saved In Repo
- SQL checkpoint: [2026-04-22_supabase_critical_auth_hardening.sql](</c:/Users/zieada/pfmea-app/db/2026-04-22_supabase_critical_auth_hardening.sql>)

## Validation

### Live DB validation
Confirmed after change:
- `control_plan_rows` has only authenticated scoped policies
- `control_plan_rows` no longer has `anon` table privileges
- critical functions no longer expose `EXECUTE` to `PUBLIC` / `anon`
- `risk_matrix_cells` no longer contains the broad `update risk matrix` policy

### App validation
- `npm run typecheck` passed
- `npm run build` passed

## Risk Reduction

### Resolved
- `CRITICAL`: anonymous/public CRUD access to `control_plan_rows`
- `HIGH`: overlapping fully open update path in `risk_matrix_cells`
- `CRITICAL`: privileged draft/publish RPC path trusting caller-supplied `p_user_id`
- `CRITICAL/HIGH`: `PUBLIC` / `anon` execute exposure on critical functions

### Still Open
- broad `auth.uid() IS NOT NULL` policies on:
  - `pfd_drafts`
  - `pfd_edit_sessions`
  - `pfd_session_events`
  - `pfd_change_history`
  - `pfmea_edit_sessions`
  - `pfmea_change_history`
  - `pcp_edit_sessions`
  - `pcp_change_history`
- invitation/admin helper functions still disable RLS internally
- broader least-privilege cleanup for table/function grants is still pending

## Recommended Next Pass
1. Replace broad authenticated policies in draft/session/history tables with project/org-scoped policies
2. Review invitation/admin helper functions that call `set_config('row_security', 'off', true)`
3. Align `projects` delete semantics so DB matches agreed role model (`engineer` should not delete projects)
