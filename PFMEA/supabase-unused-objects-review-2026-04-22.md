# Supabase Unused Objects Review - 2026-04-22

## Scope
- Compared live `public` schema in Supabase with real usage in the Next.js repo
- Goal: identify likely unused tables, views, columns, and legacy code references
- This is a review only; no schema deletions were performed in this step

## Executive Summary
Yes, there are strong candidates for cleanup.

The biggest finding is not just "unused columns", but also a schema/code drift:
- the app code still references some objects that do not exist in the current live `public` schema
- some views look like clear legacy compatibility layers and are not referenced anymore
- several columns look like old-model leftovers kept for backward compatibility, not real active usage

## High-Confidence Candidates

### 1. Likely unused views in live `public`
These exist in live Supabase but I found no real usage in the current app code:

- `org_invitations_list`
- `org_license_usage`
- `processes`
- `severity_effective`

Notes:
- `severity_effective` seems superseded by RPC-based reads:
  - `get_severity_effective`
  - `get_occurrence_effective`
  - `get_detection_effective`
- `processes` looks like an older compatibility view based on `projects.current_revision_id`
- `org_invitations_list` is just a thin pass-through over `organization_invitations`
- `org_license_usage` also looks like reporting/compatibility SQL, but not used by current frontend paths

Recommendation:
- do not delete immediately
- first confirm they are not used by external scripts, admin tooling, or dashboards
- if unused, remove them in a dedicated cleanup migration

### 2. Code references to objects missing from live `public` schema
These are referenced in code or migrations, but do not exist in the current live `public` schema snapshot:

- `process_module_revisions`
- `pfmea_row_backups`

Why this matters:
- this is a stronger signal than an unused column
- it means the codebase and the live schema are already partially out of sync

Where references exist:
- `process_module_revisions` is queried in:
  - `app/projects/page.tsx`
  - `app/pfd/page.tsx`
  - `app/pfmea/page.tsx`
  - `app/pcp/page.tsx`
- `pfmea_row_backups` is referenced in:
  - `app/pfmea/page.tsx`
  - `db/pfmea_row_backups.sql`

Recommendation:
- verify whether these features are dead, partially disabled, or only work in some environments
- treat this as schema drift / dead-feature debt, not just cleanup

## Medium-Confidence Column Candidates

### `projects.current_revision_id`
Why suspicious:
- live app reads `current_open_revision_id` and `current_draft_revision_id`
- `projects_with_revision` view also uses `current_open_revision_id` and `current_draft_revision_id`
- only the legacy `processes` view still depends on `current_revision_id`

Assessment:
- strong candidate for legacy column

### `projects.standard`
Why suspicious:
- app still selects it in a few places
- insert path writes `standard: 'GENERIC'`
- I do not see meaningful product behavior driven by this value

Assessment:
- not fully unused, but likely low-value / placeholder field
- candidate for either removal or proper domain use definition

### `projects.user_id`
Why suspicious:
- exists in table and views
- current authorization model is org-based, not owner-based
- I do not see meaningful current UI behavior depending on "project owner"

Assessment:
- likely legacy ownership field
- needs confirmation before removal

### `access_requests.requested_seats`
Why suspicious:
- current request-access route writes `requested_invites`
- I do not see app usage of `requested_seats`

Assessment:
- likely obsolete after requirements shifted from seats to invites

### `operations.description`
Why suspicious:
- current app queries `name`, `machine`, `operation`, `active`, `operation_number`
- I did not find clear frontend use of `operations.description`

Assessment:
- probable unused/legacy field

### `operations.special_characteristic`
Why suspicious:
- present in live schema
- I did not find active app usage tied to this field

Assessment:
- likely legacy or incomplete feature

### `organization_invitations.expires_at`
Why suspicious:
- still checked inside `accept_invitation(uuid)`
- but invitation creation currently sets it to `null`
- I do not see current UI flow that actually creates expiring invitations

Assessment:
- not fully dead, but currently dormant
- candidate for either full implementation or removal

## Lower-Confidence / Needs Context

### `access_requests.notes_admin`, `handled_by`, `handled_at`
These do not appear in the frontend, but they may be valid admin/backoffice fields.

Assessment:
- not evidence of dead schema by itself
- likely intentional internal fields

### rating defaults / overrides tables
- `severity_defaults`
- `severity_overrides`
- `occurrence_defaults`
- `occurrence_overrides`
- `detection_defaults`
- `detection_overrides`

These are definitely used, but grants around them are still broader than necessary.
This is not unused-schema debt; it is privilege-hardening debt.

## Strongest Cleanup Opportunities

### A. Schema drift first
Highest-value next check:
- explain why code references `process_module_revisions` and `pfmea_row_backups` while live schema does not contain them

This is more important than dropping one old column.

### B. Remove legacy compatibility view path
Most likely removable, after one final confirmation:
- `processes`

Because it depends on `projects.current_revision_id`, it likely holds an older process-revision model alive.

### C. Remove or redefine clearly weak columns
Best candidates for product/technical decision:
- `projects.current_revision_id`
- `projects.user_id`
- `projects.standard`
- `access_requests.requested_seats`
- `operations.description`
- `operations.special_characteristic`
- `organization_invitations.expires_at`

## Recommended Next Step
Do this in order:
1. investigate schema drift for `process_module_revisions` and `pfmea_row_backups`
2. confirm whether any external admin/reporting workflow uses:
   - `org_invitations_list`
   - `org_license_usage`
   - `processes`
   - `severity_effective`
3. make a cleanup matrix:
   - keep
   - deprecate
   - remove now
4. only then write deletion migrations

## Final Assessment
Yes, there is cleanup potential in the schema.

The most important finding is:
- not just "some columns may be unused"
- but the database model and the repo are carrying visible legacy layers and at least a couple of missing-object references

So the next cleanup pass should be treated as:
- **schema alignment + dead-code cleanup**
- not just "drop random old columns"
