# Supabase Remediation Progress - 2026-04-22 - Pass 4

## Scope
Fourth live remediation pass focused on reducing anonymous/public attack surface in the `public` schema without breaking current authenticated app flows.

## Changes Applied To Live Supabase

### 1. Removed anonymous table access across `public`
Applied:
- `revoke all on all tables in schema public from anon`

Result:
- anonymous table/view access in `public` has been removed globally
- only one explicit exception remains:
  - `public.access_requests` -> `INSERT` for `anon`

This preserves the public "request access" flow while removing all other anonymous table access paths.

### 2. Preserved only the known public insert path
Applied:
- `grant insert on public.access_requests to anon`

Current live state:
- `anon` can only `INSERT` into `access_requests`
- no `SELECT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` remain there for `anon`

### 3. Tightened `access_requests` for authenticated users
Applied:
- revoked all previous broad privileges
- re-granted only:
  - `INSERT`
  - `SELECT`
  - `UPDATE`

This matches the actual intent much better than the previous full privilege surface.

### 4. Removed `PUBLIC` / `anon` function execute from `public` schema
Applied:
- `revoke execute on all functions in schema public from public`
- `revoke execute on all functions in schema public from anon`

### 5. Preserved authenticated app compatibility
Applied:
- `grant execute on all functions in schema public to authenticated`
- `grant execute on all functions in schema public to service_role`

This keeps current app behavior working while eliminating anonymous and default-public execution surface.

## Files Saved In Repo
- SQL checkpoint: [2026-04-22_supabase_anon_surface_reduction.sql](</c:/Users/zieada/pfmea-app/db/2026-04-22_supabase_anon_surface_reduction.sql>)

## Validation

### Live DB validation
Confirmed after change:
- `anon` now has table privileges only on:
  - `access_requests` -> `INSERT`
- `PUBLIC` no longer has `EXECUTE` on functions in `public`
- `anon` no longer has `EXECUTE` on functions in `public`
- authenticated app functions still retain `EXECUTE`

### App validation
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed

## Risk Reduction

### Resolved
- broad anonymous data-plane exposure across `public` schema
- default `PUBLIC` function-execution surface in `public`
- unnecessary anonymous access to internal tables/views such as:
  - project data
  - org data
  - settings data
  - draft/session/history data

### Still Open
- authenticated role still has broader function/table surface than a final least-privilege model would ideally allow
- some authenticated grants remain broader than current app needs
- some internal/legacy functions still exist in `public` and should eventually be reviewed one by one
- customer-specific granular-access model is still a future design task

## Recommended Next Pass
1. Reduce authenticated table grants table-by-table to true minimum required operations
2. Review unused or legacy functions in `public` and narrow `authenticated` execute where possible
3. Decide whether highest-risk business operations should move from client RPC to server-only execution
