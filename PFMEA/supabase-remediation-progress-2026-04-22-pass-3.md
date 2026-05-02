# Supabase Remediation Progress - 2026-04-22 - Pass 3

## Scope
Third live remediation pass focused on:
- invitation/admin functions
- `global admin` consistency
- project-level role alignment
- removing remaining explicit `row_security` disabling from critical invitation/admin functions

## Changes Applied To Live Supabase

### 1. `global admin` is now treated correctly in org-admin helper logic
Updated:
- `is_org_admin_or_champion_v2(uuid)`

New behavior:
- returns `true` for:
  - `profiles.global_role = 'admin'`
  - org membership role `admin`
  - org membership role `champion`
- no longer uses `set_config('row_security', 'off', true)`

### 2. Invitation accept flow normalized
Updated:
- `accept_invitation()`
- `accept_invitation(uuid)`

Fixes:
- no explicit `row_security` disabling
- both functions now require authentication explicitly
- both now set invitation status to `ACTIVE`
- both now set `profiles.active = true`
- both now set `profiles.active_organization_id = organization_id`

This removes the earlier status inconsistency where one accept path used `ACCEPTED` while the app/UI uses `ACTIVE`.

### 3. Invitation creation hardened
Updated:
- `create_org_invitation(uuid, text, app_role)`

Fixes:
- no explicit `row_security` disabling
- requires authenticated actor
- uses the improved org-admin helper
- now allows only invitation roles:
  - `champion`
  - `engineer`
  - `viewer`
- does not allow `customer` or other unsupported roles through RPC
- license counting now consistently uses `PENDING + ACTIVE`

### 4. Invitation status functions now sync profile activity
Updated both overloads:
- `set_invitation_status(uuid, text)`
- `set_invitation_status(uuid, text, text)`

Fixes:
- no explicit `row_security` disabling
- support consistent status validation
- when invite status changes, related `profiles.active` is synchronized
- when deactivating/pending and the profile points to that org as active, `active_organization_id` is cleared
- when activating, `active_organization_id` is restored if missing

This closes a real bug where UI deactivation of an invite did not actually deactivate the accepted user profile.

### 5. `projects` permissions aligned with agreed business model
Reworked:
- `projects_select`
- `projects_insert`
- `projects_update`
- `projects_delete`

New model:
- `SELECT`: any org member or global admin
- `INSERT`: `admin` / `champion` / `engineer` or global admin
- `UPDATE`: `admin` / `champion` / `engineer` or global admin
- `DELETE`: only org `admin` / `champion` or global admin

Most important fix:
- `engineer` no longer has delete rights on `projects`

### 6. `organizations` exposure reduced
Reworked:
- `organizations_select`
- `organizations_insert`
- `organizations_update`
- `organizations_delete`

New model:
- policies are now explicitly `to authenticated`
- `global admin` can create/update/delete organizations
- `SELECT` allows org members plus global admin

### 7. Reduced anon exposure on key business tables
Applied to:
- `projects`
- `organizations`

Changes:
- revoked all table privileges from `anon`
- removed broad grants such as `TRUNCATE` / `REFERENCES` from client roles
- kept only app-relevant privileges for `authenticated`:
  - `SELECT`
  - `INSERT`
  - `UPDATE`
  - `DELETE`

## App Change
Updated [app/settings/invitations/page.tsx](</c:/Users/zieada/pfmea-app/app/settings/invitations/page.tsx>) so `resendInvite()` no longer performs a direct table update to `status = 'PENDING'`. It now calls:
- `set_invitation_status(p_invite_id, 'PENDING')`

This ensures the frontend no longer bypasses the new backend synchronization logic for `profiles.active`.

## Files Saved In Repo
- SQL checkpoint: [2026-04-22_supabase_invites_projects_hardening.sql](</c:/Users/zieada/pfmea-app/db/2026-04-22_supabase_invites_projects_hardening.sql>)

## Validation

### Live DB validation
Confirmed:
- `projects_delete` no longer allows `engineer`
- `projects` and `organizations` no longer expose table grants to `anon`
- invitation/admin helper functions in this pass no longer contain explicit `set_config('row_security', 'off', true)`
- invitation insert license counting now uses `PENDING + ACTIVE`
- `global admin` is recognized by `is_org_admin_or_champion_v2`

### App validation
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed

## Risk Reduction

### Resolved
- inconsistent invitation state model (`ACCEPTED` vs `ACTIVE`)
- invite deactivation not propagating to `profiles.active`
- `global admin` not being consistently treated like top-level admin in org helper logic
- `engineer` having delete rights on `projects`
- unnecessary anon privileges on key business tables `projects` and `organizations`
- explicit `row_security off` usage in the main invitation/admin functions covered by this pass

### Still Open
- broader least-privilege cleanup for additional public tables beyond `projects` and `organizations`
- `organization_members` / `organization_invitations` still rely on `security definer` helper design, even though the most dangerous explicit `row_security off` usage is removed here
- customer-role access model is still not implemented and will require a separate granular-access design
- server-side/non-client orchestration for highest-risk business mutations can still be improved further

## Recommended Next Pass
1. Audit remaining table grants across the rest of `public`
2. Review whether some critical RPCs should move behind server-only execution paths
3. Design and implement granular `customer` access for selected `PFD/PFMEA/PCP`
