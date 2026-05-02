# Supabase RPC Surface Audit - 2026-04-23

## Scope
- audit of the remaining callable RPC/function surface for `authenticated`
- focused on:
  - current `EXECUTE` grants
  - function definitions
  - relationship to app usage
  - relationship to current RLS policies
- no changes were applied in this step

## Executive Summary
The RPC surface is now much smaller and substantially safer than at the start of remediation.

The remaining callable functions fall into three groups:
- real client RPCs used by the app
- policy helpers still needed by RLS
- one legacy helper still used by risk-matrix policies

The main conclusion is:
- the overall RPC surface is **no longer broadly exposed**
- but there are still **two meaningful authorization inconsistencies**
- and **two medium-level contract/design issues**

## Remaining `authenticated` RPC Surface

### Direct client RPCs still used by the app
- `accept_invitation()`
- `create_org_invitation(uuid, text, app_role)`
- `ensure_process_draft(uuid, uuid)`
- `get_detection_effective(uuid)`
- `get_my_header()`
- `get_occurrence_effective(uuid)`
- `get_severity_effective(uuid)`
- `publish_process_module_revision(uuid, text, text, uuid)`
- `set_invitation_status(uuid, text)`

### Helpers still callable for `authenticated`
- `is_org_admin_or_champion(uuid)`
- `is_org_admin_or_champion_v2(uuid)`

`is_org_admin_or_champion_v2` is still actively needed by invitation / membership policies.
`is_org_admin_or_champion` is still used by `risk_matrix_config` and `risk_matrix_cells` policies.

## Findings

### [HIGH] Rating override tables are still writable by any org member, not only admin/champion
Affected area:
- `severity_overrides`
- `occurrence_overrides`
- `detection_overrides`

Current policy pattern:
- `INSERT/SELECT/UPDATE/DELETE` is allowed for any row where there exists an `organization_members` record for `auth.uid()`
- there is **no role check** in those policies

Why this matters:
- current business model says settings are admin/champion territory
- current UI also treats settings as privileged
- but at the database level, any org member can mutate rating overrides directly if they know the API surface

Impact:
- `engineer`
- and likely even `viewer`
can bypass UI intent and change severity / occurrence / detection settings directly

Assessment:
- this is the most important remaining authorization issue found in this audit

Recommendation:
- replace membership-only checks with `admin/champion` checks
- preferably use a single consistent helper for settings authorization

### [HIGH] `risk_matrix_*` policies still use legacy helper that does not honor global admin
Affected area:
- `risk_matrix_config`
- `risk_matrix_cells`

Current policy helper:
- `is_org_admin_or_champion(p_org uuid)`

Problem:
- this helper checks only `organization_members.role in ('admin','champion')`
- it does **not** recognize `profiles.global_role = 'admin'`

Why this matters:
- your declared business model says global `admin` should have champion-equivalent rights plus org creation
- but risk-matrix RLS still follows the older helper

Impact:
- a global admin who is not explicitly a champion/admin member in that org may be blocked from risk-matrix management
- role semantics are therefore inconsistent across modules

Assessment:
- this is a real authorization inconsistency, not just cosmetic debt

Recommendation:
- migrate risk-matrix policies from `is_org_admin_or_champion(...)` to `is_org_admin_or_champion_v2(...)`
- then consider revoking `EXECUTE` for the old helper from `authenticated`

### [MEDIUM] `accept_invitation()` without token is ambiguous when multiple pending invites exist for one email
Affected function:
- `accept_invitation()`

Current behavior:
- loads current user email from `profiles`
- finds the latest `PENDING` invitation for that email
- accepts only that one

Problem:
- if the same email has multiple pending invites across orgs, this function silently accepts the newest one
- the function does not require the caller to disambiguate organization or token

Impact:
- user could join a different organization than expected
- auditability and UX are weaker than token-based acceptance

Assessment:
- not a broad security hole, but a fragile contract and a source of wrong-org acceptance

Recommendation:
- prefer token-based acceptance flow as the canonical path
- optionally deprecate the no-arg variant, or constrain it to a single pending invite only

### [MEDIUM] `get_my_header()` may return nondeterministic org context if membership state is messy
Affected function:
- `get_my_header()`

Current behavior:
- reads `profiles`
- left joins `organization_members`
- left joins `organizations`
- filters by `p.id = auth.uid()`
- `limit 1`

Problem:
- if a user has multiple org memberships and `active_organization_id` is null or inconsistent, the join can produce multiple rows
- `limit 1` without deterministic ordering can return an arbitrary org row

Impact:
- wrong header org name
- wrong org role in shell/session context
- subtle state confusion in UI

Assessment:
- medium reliability problem with security-adjacent impact

Recommendation:
- make active organization selection explicit and deterministic
- prefer:
  - active org first
  - then fallback only if exactly one membership exists

### [LOW] `ensure_process_draft` and `publish_process_module_revision` still carry stale `p_user_id` parameter
Affected functions:
- `ensure_process_draft(p_project_id uuid, p_user_id uuid)`
- `publish_process_module_revision(p_project_id uuid, p_module text, p_change_description text, p_user_id uuid)`

Current behavior:
- both functions correctly derive actor from `auth.uid()`
- caller-provided `p_user_id` is effectively ignored for authorization

Problem:
- SQL contract still suggests caller identity is an input
- app keeps sending a parameter that no longer has real authority

Impact:
- confusion
- unnecessary attack-surface ambiguity
- harder long-term maintenance

Assessment:
- low direct risk, but worth cleaning

Recommendation:
- remove `p_user_id` from signatures in a coordinated app + SQL migration

### [LOW] Invitation expiry is only partially real
Affected area:
- `accept_invitation(p_token uuid)`
- `create_org_invitation(...)`
- `organization_invitations.expires_at`

Current behavior:
- token-based accept checks `expires_at`
- invitation creation currently writes `expires_at = null`

Impact:
- expiry support exists in logic, but is dormant in normal flow

Assessment:
- product/contract drift rather than active vulnerability

Recommendation:
- either fully implement expiry
- or remove the dormant field/logic in a later cleanup pass

## Positive Findings

### Surface is now intentionally small
Compared to the initial state, the remaining callable RPC set is tight and mostly aligned to actual usage.

### Critical mutation RPCs now validate actor through `auth.uid()`
Most important flows were already hardened:
- `ensure_process_draft`
- `publish_process_module_revision`
- invitation admin functions

### Public / anon exposure is no longer the main risk
The remaining risks are now mostly:
- authorization consistency
- contract clarity
- edge-case correctness

This is a much healthier place than where the project started.

## Recommended Next Order
1. fix override-table RLS for:
   - `severity_overrides`
   - `occurrence_overrides`
   - `detection_overrides`
2. migrate risk-matrix policies from:
   - `is_org_admin_or_champion`
   to:
   - `is_org_admin_or_champion_v2`
3. decide whether to deprecate `accept_invitation()` without token
4. make `get_my_header()` deterministic
5. remove stale `p_user_id` params from process-draft/publish RPCs

## Final Assessment
The remaining RPC surface is **mostly production-acceptable**, but not fully closed.

Current status:
- broad exposure problems: mostly solved
- least-privilege cleanup: strongly advanced
- remaining work: targeted authorization consistency fixes

If the next pass fixes the two HIGH findings above, the Supabase function/RPC layer will be in a much stronger production state.
