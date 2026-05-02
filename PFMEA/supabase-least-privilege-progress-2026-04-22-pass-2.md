# Supabase Least-Privilege Progress - 2026-04-22 Pass 2

## Scope
- table-by-table CRUD reduction for `authenticated`
- remove `EXECUTE` from trigger-only and unused helper functions
- keep current app flows intact

## What Was Changed

Migration file:
- [2026-04-22_supabase_least_privilege_pass_2.sql](</c:/Users/zieada/pfmea-app/db/2026-04-22_supabase_least_privilege_pass_2.sql>)

### 1. Reduced table privileges for `authenticated`

#### Read-only now
- `organization_license` -> `SELECT`
- `organization_members` -> `SELECT`
- `profiles` -> `SELECT`
- `severity_defaults` -> `SELECT`
- `occurrence_defaults` -> `SELECT`
- `detection_defaults` -> `SELECT`

#### No direct client access now
- `process_revisions` -> no remaining table privileges for `authenticated`

#### Partial CRUD now
- `operations` -> `INSERT, SELECT, UPDATE`
- `organization_invitations` -> `DELETE, SELECT, UPDATE`
- `pfd_change_history` -> `INSERT, SELECT`
- `pfmea_change_history` -> `INSERT, SELECT`
- `pcp_change_history` -> `INSERT, SELECT`
- `pfd_diagrams` -> `INSERT, SELECT, UPDATE`
- `pfd_session_events` -> `INSERT, SELECT, UPDATE`

### 2. Removed `EXECUTE` from trigger-only and unused helper functions
Revoked from `authenticated`:
- `calculate_rpn()`
- `pfmea_calc_scores()`
- `set_detection_override_audit()`
- `set_occurrence_override_audit()`
- `set_severity_override_audit()`
- `can_edit()`
- `can_read()`
- `current_profile_role()`
- `has_org_role(uuid, text[])`
- `is_admin()`
- `is_org_member(uuid)`
- `is_owner_of_edge(uuid)`
- `is_owner_of_operation(uuid)`

Reason:
- these functions are either trigger-only or no longer used by the app / active RLS policies

## Validation

### Application validation
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

### Live privilege validation
- target tables now show reduced grants exactly as intended
- `process_revisions` no longer appears with `authenticated` table privileges
- removed helper/trigger functions no longer have `EXECUTE` for `authenticated`
- `remaining_unused_execs = 0`

## Assessment
This pass moved the privilege model from broad generic CRUD toward actual usage-based grants.

Biggest wins:
- several support/admin tables are now read-only for the client
- change-history tables are no longer writable beyond append behavior
- dead helper function surface is gone

## Next Sensible Step
The next hardening pass can focus on the smallest remaining exposed surface:
1. review remaining callable RPCs for `authenticated`
2. decide whether `access_requests` should stay `INSERT, SELECT, UPDATE` or go lower
3. review whether `organizations` should remain mutable for `authenticated` or be reduced to `SELECT` only
