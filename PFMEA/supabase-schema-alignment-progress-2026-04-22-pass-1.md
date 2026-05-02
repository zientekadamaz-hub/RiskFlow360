# Supabase Schema Alignment Progress - 2026-04-22 Pass 1

## Scope
- first implementation step from `supabase-schema-cleanup-plan-2026-04-22.md`
- goal: align app code with live Supabase schema before any destructive schema cleanup
- no visual/style changes

## What Was Changed

### 1. Removed app fallbacks to missing `process_module_revisions`
Updated:
- `app/projects/page.tsx`
- `app/pfd/page.tsx`
- `app/pfmea/page.tsx`
- `app/pcp/page.tsx`

Changes:
- project revision popup now reads module history from:
  - `pfd_change_history`
  - `pfmea_change_history`
  - `pcp_change_history`
- removed fallback queries to `process_module_revisions`
- `PFD` publish flow now resolves revision label from `projects_with_revision`
- `PFMEA` history and publish flow no longer query `process_module_revisions`
- `PCP` history no longer queries `process_module_revisions`

Effect:
- the app no longer depends on a table that does not exist in live Supabase
- revision/history paths now use the actual live schema contract

### 2. Removed dead `pfmea_row_backups` app flow
Updated:
- `app/pfmea/page.tsx`

Changes:
- removed optional backup insert/update flow against missing table `pfmea_row_backups`
- removed missing-table guard that existed only to silently skip this dead feature
- kept the real safety logic:
  - in-memory snapshot of current PFMEA rows
  - post-publish integrity check
  - automatic restore into published revision when needed

Effect:
- the app no longer pretends to persist backups into a missing table
- publish safety remains in place through active integrity-check logic

## Validation
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

Additional check:
- `rg -n "process_module_revisions|pfmea_row_backups" app` returned no matches

## What Still Remains
Repo-level legacy SQL artifacts still exist and should be handled in a later pass:
- `db/pfd_editing.sql`
- `db/pfmea_editing.sql`
- `db/pfmea_row_backups.sql`

These are no longer referenced by the active app runtime, but they still carry outdated schema assumptions.

## Assessment
This pass successfully completed the safest part of schema cleanup:
- **code/runtime alignment first**
- without deleting live Supabase objects yet

Next sensible step:
1. review and clean legacy SQL files in `db/`
2. then remove confirmed dead views/columns from Supabase in a dedicated migration pass
