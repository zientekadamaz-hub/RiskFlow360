# Supabase Least-Privilege Progress - 2026-04-22 Pass 1

## Scope
- reduce unnecessary privileges for `authenticated`
- keep app flows working without visual or runtime behavior changes
- focus on safe privilege tightening only

## What Was Changed

Migration file:
- [2026-04-22_supabase_least_privilege_pass_1.sql](</c:/Users/zieada/pfmea-app/db/2026-04-22_supabase_least_privilege_pass_1.sql>)

### 1. Removed structural table privileges from `authenticated`
Revoked from all tables in `public`:
- `TRUNCATE`
- `REFERENCES`
- `TRIGGER`

Reason:
- these privileges are not needed by the Next.js app client
- they unnecessarily enlarge blast radius for authenticated users

### 2. Restricted `projects_with_revision` to read-only
Changed `public.projects_with_revision` grants for `authenticated` to:
- `SELECT` only

Reason:
- the app uses this view only for reads
- write privileges on this view were unnecessary

### 3. Removed client `EXECUTE` from internal functions
Revoked `authenticated` execute from:
- `auto_generate_pcp()`
- `handle_auth_user_updated()`
- `handle_new_auth_user()`
- `handle_new_user()`
- `set_updated_at()`
- `create_org_invitation_as(uuid, text, app_role, uuid)`
- `create_process_revision_and_tag_changes(...)`

Reason:
- these functions are internal trigger/helper paths, not intended client RPC surface
- some are trigger-bound, some are legacy/internal orchestration helpers

## Validation

### Application validation
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

### Live privilege validation
- `projects_with_revision` now has only `SELECT` for `authenticated`
- sample write tables such as:
  - `operations`
  - `organization_invitations`
  - `pfmea_rows`
  now keep only business-relevant CRUD:
  - `SELECT`
  - `INSERT`
  - `UPDATE`
  - `DELETE`
- remaining structural grants for `authenticated` in `public`:
  - `0`
- internal functions listed above no longer have `EXECUTE` for `authenticated`

## Assessment
This pass materially reduced privilege surface without touching business logic.

Biggest win:
- `authenticated` no longer holds schema-management-style powers in `public`
- internal trigger/helper functions are no longer exposed as callable client RPCs

## Next Sensible Step
Next least-privilege pass can go deeper:
1. table-by-table CRUD reduction for `authenticated`
2. review whether some history tables should lose `DELETE`
3. narrow remaining `EXECUTE` grants to:
   - actual client RPCs
   - policy helper functions that still need to be executable
