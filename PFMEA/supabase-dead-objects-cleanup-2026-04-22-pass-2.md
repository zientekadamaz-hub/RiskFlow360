# Supabase Dead Objects Cleanup - 2026-04-22 Pass 2

## Scope
- remove the last confirmed legacy compatibility path
- target:
  - `public.processes`
  - `public.projects.current_revision_id`

## Preconditions Checked
Before applying the cleanup I verified:
- `public.processes` still existed in live schema
- no SQL dependents were detected for `public.processes`
- `public.projects.current_revision_id` still existed
- `current_revision_id` had `0` non-null values in live data
- current app code did not reference `processes` or `current_revision_id`

## Changes Applied
Migration file:
- [2026-04-22_supabase_processes_legacy_cleanup.sql](</c:/Users/zieada/pfmea-app/db/2026-04-22_supabase_processes_legacy_cleanup.sql>)

Applied live changes:
- dropped view `public.processes`
- dropped column `public.projects.current_revision_id`

## Validation

### Live schema validation
After migration:
- `public.processes` no longer exists in `pg_views`
- `public.projects.current_revision_id` no longer exists in `information_schema.columns`

### Application validation
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

## Risk Assessment
This was still a low-risk cleanup pass because:
- the removed view had no detected SQL dependents
- the removed column had no live data usage
- the active app had already moved to:
  - `projects_with_revision`
  - `current_open_revision_id`
  - `current_draft_revision_id`

## What Remains Open
Remaining schema items now look more like domain decisions than obvious dead weight:
- `projects.user_id`
- `projects.standard`
- `organization_invitations.expires_at`

These should not be removed automatically without explicit business confirmation.

## Final Assessment
This pass closes the old `processes/current_revision_id` compatibility layer.

At this point the obvious dead-schema cleanup is largely complete, and the remaining work is mostly:
- role/access evolution
- least-privilege refinement
- domain-model cleanup decisions
