# Supabase Least-Privilege Progress - 2026-04-23 Pass 3

## Scope
- tighten the last two broad table grants identified in the previous pass
- keep current application behavior unchanged

## What Was Changed

Migration file:
- [2026-04-23_supabase_least_privilege_pass_3.sql](</c:/Users/zieada/pfmea-app/db/2026-04-23_supabase_least_privilege_pass_3.sql>)

### 1. Reduced `access_requests` to append-only for `authenticated`
Changed grants for `authenticated` to:
- `INSERT`

Removed:
- `SELECT`
- `UPDATE`

Reason:
- current app code only creates access requests
- there is no active client path reading or updating `access_requests`

### 2. Reduced `organizations` to read-only for `authenticated`
Changed grants for `authenticated` to:
- `SELECT`

Removed:
- `INSERT`
- `UPDATE`
- `DELETE`

Reason:
- current app code only reads organization names
- no active client path creates, updates, or deletes organizations directly
- org creation remains a business capability, but there is no current direct frontend path using table CRUD for it

## Validation

### Application validation
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

### Live privilege validation
- `access_requests` for `authenticated` -> `INSERT`
- `organizations` for `authenticated` -> `SELECT`

### Repo usage validation
Search confirmed no active code paths for:
- `organizations.insert/update/upsert/delete`
- `access_requests.select/update/upsert/delete`

## Assessment
This pass finishes the obvious least-privilege tightening for the current app surface.

At this point, the remaining `authenticated` access is much closer to actual behavior:
- read-only where the app only reads
- append-only where the app only creates
- broader CRUD only where active process-editing workflows still need it

## Next Sensible Step
The next meaningful Supabase step is no longer generic grant cleanup.

Best options now:
1. audit the remaining callable RPC surface one by one
2. design the future granular access model for `customer`
3. review remaining domain fields still awaiting product decisions:
   - `projects.user_id`
   - `projects.standard`
   - `organization_invitations.expires_at`
