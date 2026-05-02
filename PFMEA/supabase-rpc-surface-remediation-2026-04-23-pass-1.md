# Supabase RPC Surface Remediation - 2026-04-23 Pass 1

## Scope
- implement the two `HIGH` findings from `supabase-rpc-surface-audit-2026-04-23.md`
- no visual or app-behavior changes
- SQL/RLS hardening only

## What Was Changed

Migration file:
- [2026-04-23_supabase_rpc_surface_hardening_pass_1.sql](</c:/Users/zieada/pfmea-app/db/2026-04-23_supabase_rpc_surface_hardening_pass_1.sql>)

### 1. Rating override writes are no longer open to any org member
Updated policies for:
- `severity_overrides`
- `occurrence_overrides`
- `detection_overrides`

New behavior:
- `SELECT`:
  - allowed for any org member
  - also allowed for global `admin` through `is_org_admin_or_champion_v2(...)`
- `INSERT / UPDATE / DELETE`:
  - allowed only through `is_org_admin_or_champion_v2(...)`

Effect:
- `engineer` and `viewer` can still read effective org settings when needed by PFMEA/settings reads
- only `admin/champion` can mutate overrides

### 2. Risk matrix policies now honor global admin
Updated policies for:
- `risk_matrix_config`
- `risk_matrix_cells`

Change:
- replaced `is_org_admin_or_champion(...)`
with:
- `is_org_admin_or_champion_v2(...)`

Effect:
- global `admin` now gets the same effective access model as intended elsewhere in the system
- risk-matrix authorization is now aligned with the declared role model

### 3. Old risk-matrix helper is no longer client-callable
Changed:
- revoked `EXECUTE` for `authenticated` from `public.is_org_admin_or_champion(uuid)`

Effect:
- old helper remains available only for privileged/internal roles
- client surface no longer exposes the outdated role helper

## Validation

### Application validation
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

### Live policy validation
Confirmed:
- override write policies now use `is_org_admin_or_champion_v2(organization_id)`
- override read policies now allow:
  - `is_org_admin_or_champion_v2(...)`
  - or plain org membership
- `risk_matrix_config` policies now use `is_org_admin_or_champion_v2(organization_id)`
- `risk_matrix_cells` policies now use `is_org_admin_or_champion_v2(organization_id)`

### Live grant validation
Confirmed:
- `is_org_admin_or_champion(uuid)` no longer has `EXECUTE` for `authenticated`
- only `postgres` and `service_role` retain `EXECUTE`

## Assessment
This pass closes the two main remaining `HIGH` findings from the RPC surface audit.

Most important outcomes:
- settings-write authorization is now consistent with UI intent and business roles
- risk-matrix authorization now properly honors global admin

## Remaining RPC / Function Debt
Still worth addressing later:
- `accept_invitation()` without token remains ambiguous when multiple pending invites exist
- `get_my_header()` is still potentially nondeterministic when membership state is messy
- `ensure_process_draft(...)` and `publish_process_module_revision(...)` still expose stale `p_user_id` parameters in their signatures

## Final Assessment
After this pass, the remaining Supabase RPC surface is in a substantially better place:
- broad privilege issues: largely solved
- major role inconsistencies: fixed
- remaining problems: mostly contract clarity and edge-case behavior
