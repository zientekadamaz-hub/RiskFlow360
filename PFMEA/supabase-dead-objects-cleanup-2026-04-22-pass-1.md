# Supabase Dead Objects Cleanup - 2026-04-22 Pass 1

## Scope
- first destructive cleanup pass in live Supabase
- limited to confirmed dead views and low-risk unused columns
- based on prior review and schema-alignment passes

## Preconditions Checked
Before applying the cleanup I verified:
- live views existed:
  - `public.org_invitations_list`
  - `public.org_license_usage`
  - `public.severity_effective`
- no SQL dependents were detected for those views
- target columns still existed:
  - `public.access_requests.requested_seats`
  - `public.operations.description`
  - `public.operations.special_characteristic`
- target column usage in live data was effectively zero:
  - `requested_seats`: `0` non-null values
  - `description`: `0` non-blank values
  - `special_characteristic = true`: `0`

## Changes Applied
Migration file:
- [2026-04-22_supabase_dead_views_columns_cleanup.sql](</c:/Users/zieada/pfmea-app/db/2026-04-22_supabase_dead_views_columns_cleanup.sql>)

Applied live changes:

### Removed views
- `public.org_invitations_list`
- `public.org_license_usage`
- `public.severity_effective`

### Removed columns
- `public.access_requests.requested_seats`
- `public.operations.description`
- `public.operations.special_characteristic`

## Validation

### Live schema validation
After migration:
- the three removed views no longer exist in `pg_views`
- the three removed columns no longer exist in `information_schema.columns`

### Application validation
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

## Risk Assessment
This was a low-risk cleanup pass because:
- removed views had no detected SQL dependents
- removed columns had no active live data
- app runtime had already been aligned away from legacy references in earlier passes

## What Was Intentionally Not Removed Yet
Still deferred for a later decision:
- `public.processes` view
- `projects.current_revision_id`
- `projects.user_id`
- `projects.standard`
- `organization_invitations.expires_at`

Reason:
- these items still need either domain confirmation or a coordinated cleanup with the remaining legacy compatibility path

## Final Assessment
This pass successfully removed the safest confirmed dead objects from live Supabase.

The schema is now smaller and cleaner, and the next cleanup pass can focus on the remaining legacy process-revision path rather than obvious dead weight.
