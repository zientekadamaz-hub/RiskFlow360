# Supabase Audit (Direct Project Access) - 2026-04-22

## Scope
- Direct inspection of the live Supabase project `piewgtoldsnyynueztos`
- Verified through Supabase Management API SQL queries against the live database
- Focus: RLS, grants, `security definer` functions, function execute exposure, selected triggers, storage posture

## Executive Summary
The biggest application-level risk identified in the earlier audit is confirmed in the live Supabase project: the main problem is not the frontend anymore, but the authorization model in the database.

The current project has multiple strong points:
- RLS is enabled on the main `public` tables
- storage tables also have RLS enabled
- core domain tables such as `projects`, `pfmea_rows`, `pfd_nodes`, `pfd_edges`, `organization_members` and `process_revisions` generally use organization-aware policies instead of fully open reads/writes

However, the live project still contains several production-grade security risks:
- one table is effectively open to `anon` and `authenticated` for full CRUD
- several `security definer` functions disable RLS explicitly
- critical mutating functions are executable by `PUBLIC` / `anon` / `authenticated`
- at least one overlapping permissive policy weakens otherwise organization-scoped rules
- several edit/session/history tables still use "any logged-in user can do anything" policies

This means the project is **not yet safe enough to treat Supabase as production-ready** without a focused remediation pass.

## Findings

### CRITICAL-1: `control_plan_rows` is fully open to `anon` and `authenticated`
**Evidence from live project**
- Table policies include:
  - `control_plan_rows_select_all` with `qual = true`
  - `control_plan_rows_insert_all` with `with_check = true`
  - `control_plan_rows_update_all` with `qual = true` and `with_check = true`
  - `control_plan_rows_delete_all` with `qual = true`
- Roles on these policies: `{anon,authenticated,service_role}`
- Table grants for both `anon` and `authenticated` include `SELECT`, `INSERT`, `UPDATE`, `DELETE`

**Impact**
- Any anonymous caller can read, create, modify and delete control plan rows through Supabase API/RPC surface
- This is direct cross-tenant data exposure and tampering risk
- If the frontend or another integration exposes the anon key, this table is effectively public

**Assessment**
- Severity: **CRITICAL**
- Status: confirmed in live environment

**Required remediation**
1. Remove the emergency "open all" policies immediately
2. Revoke unnecessary grants from `anon`
3. Replace them with org/project-scoped policies derived from `operation_id -> project -> organization_members`

### CRITICAL-2: Critical `security definer` functions are executable by `PUBLIC` / `anon` / `authenticated`
**Evidence from live project**
- `role_routine_grants` shows `EXECUTE` granted to `PUBLIC` or directly to `anon` / `authenticated` for:
  - `ensure_process_draft`
  - `publish_process_module_revision`
  - `get_my_header`
  - `is_org_admin_or_champion_v2`
  - `accept_invitation`
  - `set_invitation_status`
  - `create_org_invitation`

**Most concerning functions**
- `ensure_process_draft(p_project_id uuid, p_user_id uuid)`
- `publish_process_module_revision(p_project_id uuid, p_module text, p_change_description text, p_user_id uuid)`

**Why this is critical**
- These are `SECURITY DEFINER`, so they execute with elevated privileges
- If they are callable from client-side RPC and do not enforce authorization internally, RLS does not protect the mutation path
- This bypasses the normal assumption that table policies are the final gate

### CRITICAL-3: `ensure_process_draft` and `publish_process_module_revision` do not enforce caller authorization internally
**Evidence from live function definitions**
- `ensure_process_draft(...)`:
  - reads and updates `projects`
  - inserts into `process_revisions`
  - does not perform an explicit permission check
  - does not reference `auth.uid()`
- `publish_process_module_revision(...)`:
  - calls `ensure_process_draft(...)`
  - mutates `process_revisions`
  - updates `projects.current_open_revision_id`, `current_draft_revision_id`, `status`, `updated_by`, `updated_at`
  - does not perform an explicit permission check
  - does not reference `auth.uid()`

**Impact**
- A client who can execute the function may be able to create drafts and publish revisions for arbitrary projects by supplying UUIDs
- The function trusts `p_user_id` from the caller instead of binding actions to `auth.uid()`

**Assessment**
- Severity: **CRITICAL**
- This is one of the highest-priority fixes in the whole system

**Required remediation**
1. Revoke `EXECUTE` from `PUBLIC`, `anon`, and likely from direct `authenticated` on these functions
2. Recreate them with explicit authorization checks inside the function body
3. Never trust caller-supplied `p_user_id`; derive acting user from `auth.uid()`
4. Prefer a service/backend-only execution path if possible

### HIGH-1: Invitation/admin helper functions disable RLS explicitly
**Evidence from live function definitions**
- `accept_invitation()`
- `accept_invitation(p_token uuid)`
- `create_org_invitation(...)`
- `set_invitation_status(p_org uuid, p_email text, p_status text)`
- `is_org_admin_or_champion_v2(p_org_id uuid)`

All above contain:
- `set_config('row_security', 'off', true)`

**Impact**
- These functions bypass table-level protection by design
- This is not automatically a bug, but it sharply increases the need for perfect internal authorization checks
- Any missing validation inside one function becomes a database-level privilege escalation path

**Assessment**
- Severity: **HIGH**

**Notes**
- Some of these functions do include meaningful checks, for example `create_org_invitation(...)` verifies `is_org_admin_or_champion_v2(...)`
- The problem is architectural: you currently rely on privileged function code more than on table policies

### HIGH-2: Several edit/history/session tables are still open to any authenticated user
**Evidence from live policies**
- `pcp_change_history_all_auth`
- `pcp_edit_sessions_all_auth`
- `pfd_change_history_all_auth`
- `pfd_drafts_all_auth`
- `pfd_edit_sessions_all_auth`
- `pfd_session_events_all_auth`
- `pfmea_change_history_all_auth`
- `pfmea_edit_sessions_all_auth`

All use the pattern:
- roles `{public}`
- `qual = (auth.uid() IS NOT NULL)`
- `with_check = (auth.uid() IS NOT NULL)`

**Impact**
- Any logged-in user can potentially read/write operational draft/session/history data across organizations
- Even if these tables look less business-critical than `projects`, they still represent cross-tenant leakage and mutation risk

**Assessment**
- Severity: **HIGH**

**Required remediation**
- Replace these with project/org-scoped policies based on project ownership or organization membership

### HIGH-3: `risk_matrix_cells` contains an overlapping global update policy
**Evidence from live policies**
- Correct scoped policies exist:
  - `risk_matrix_cells_select`, `insert`, `update`, `delete` using `is_org_admin_or_champion(organization_id)`
- But there is also:
  - `update risk matrix`
  - `roles = {authenticated}`
  - `qual = true`
  - `with_check = true`

**Impact**
- The extra permissive update policy can override the intended organization scoping for updates
- Any authenticated user may be able to update records they should not control

**Assessment**
- Severity: **HIGH**

### MEDIUM-1: Broad table grants are still present across public tables
**Evidence from live grants**
- For many public tables, both `anon` and `authenticated` have grants such as:
  - `SELECT`
  - `INSERT`
  - `UPDATE`
  - `DELETE`
  - `TRUNCATE`
  - `REFERENCES`
  - `TRIGGER`

**Important nuance**
- In Supabase, RLS is the main access gate for normal client data access, so broad grants alone do not always mean exposure
- But broad grants increase blast radius and make mistakes in policies/functions much more dangerous

**Assessment**
- Severity: **MEDIUM**

**Recommendation**
- Move toward least-privilege grants, especially on the most sensitive tables and functions

### MEDIUM-2: `security definer` is used as an architectural shortcut in too many places
**Observed in live project**
- Many application functions in `public` are `SECURITY DEFINER`
- Some are legitimate helper functions, but several are business-critical mutation paths

**Impact**
- Harder to reason about effective authorization
- Harder to test safely
- Makes the system more dependent on handwritten procedural correctness than on consistent RLS boundaries

**Assessment**
- Severity: **MEDIUM**

### LOW-1: Storage does not currently appear open
**Evidence**
- `storage` tables have RLS enabled
- `storage` schema currently returns no explicit `pg_policies`

**Interpretation**
- With RLS enabled and no policies, storage is effectively closed by default for normal client access
- This is not a current exposure signal

**Assessment**
- Severity: **LOW / OK for now**

## What Looks Better Than Expected
- `projects`, `pfmea_rows`, `pfd_nodes`, `pfd_edges`, `organization_members`, `organization_invitations`, `organizations`, `profiles`, `process_revisions` are not generally world-readable by policy
- Main org-scoped tables already contain recognizable tenant-aware joins through `organization_members`
- Storage does not currently show public-open policies

## Recommended Remediation Order

### Phase 1 - Immediate containment
1. Remove all open CRUD policies from `control_plan_rows`
2. Remove the extra permissive `update risk matrix` policy
3. Revoke `EXECUTE` from `PUBLIC` / `anon` on critical `security definer` functions
4. Restrict or temporarily disable direct client RPC access to:
   - `ensure_process_draft`
   - `publish_process_module_revision`
   - `set_invitation_status`
   - `create_org_invitation`
   - `accept_invitation`

### Phase 2 - Fix privileged mutation paths
1. Rewrite `ensure_process_draft` to derive acting user from `auth.uid()`
2. Rewrite `publish_process_module_revision` to derive acting user from `auth.uid()`
3. Add explicit membership/role checks inside those functions
4. Consider moving publish/draft mutation behind a backend-only surface using service role or server actions

### Phase 3 - Normalize RLS
1. Replace all `(auth.uid() IS NOT NULL)` edit/session/history policies with project/org-scoped checks
2. Audit remaining overlapping permissive policies
3. Review whether `FORCE ROW LEVEL SECURITY` is warranted on the most sensitive tables

### Phase 4 - Permission hygiene
1. Review function `EXECUTE` grants
2. Revoke default `PUBLIC` execute where not needed
3. Review table grants for least privilege

## Suggested SQL Audit/Fix Backlog
- Audit and patch:
  - `control_plan_rows`
  - `pfd_drafts`
  - `pfd_edit_sessions`
  - `pfd_session_events`
  - `pfmea_edit_sessions`
  - `pfmea_change_history`
  - `pcp_edit_sessions`
  - `pcp_change_history`
  - `risk_matrix_cells`
- Rework functions:
  - `ensure_process_draft`
  - `publish_process_module_revision`
  - `create_org_invitation`
  - `accept_invitation`
  - `set_invitation_status`
  - `is_org_admin_or_champion_v2`

## Final Assessment
Current Supabase posture after direct inspection:
- App database model: **partially mature**
- RLS adoption: **present but inconsistent**
- Authorization architecture: **too dependent on privileged RPC/functions**
- Production readiness of Supabase layer: **not yet acceptable without remediation**

## Score
- Supabase security / authorization maturity: **4/10**

## Verdict
The live Supabase project has real structure and is not a total mess, but it still contains several issues that are below senior / production standard, especially around privileged functions and tenant isolation.

The next workstream should be a **focused Supabase remediation pass**, starting from:
1. `control_plan_rows`
2. `ensure_process_draft`
3. `publish_process_module_revision`
4. broad `ALL auth.uid() IS NOT NULL` policies
