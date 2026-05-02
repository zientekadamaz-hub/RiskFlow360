# Settings Organizations And Theme - 2026-04-23 - Pass 1

## Scope
- add an admin-only settings page for organization creation
- align the rest of the settings area to the `Invitations` visual shell
- keep business logic stable while reducing legacy duplication

## Changes

### New admin page
- Added [app/settings/organizations/page.tsx](</c:/Users/zieada/pfmea-app/app/settings/organizations/page.tsx>)
- Page allows global admin to:
  - create a new organization
  - set starter license values
  - assign an existing user as champion immediately or create a secure pending champion invitation
  - copy the champion invitation link when a pending invitation exists

### Settings visual unification
- Added shared settings shell:
  - [src/features/settings/invitation-shell.tsx](</c:/Users/zieada/pfmea-app/src/features/settings/invitation-shell.tsx>)
- Updated settings pages to use the same dark/glass visual direction as `Invitations`
- Refactored:
  - [app/settings/risk-matrix/page.tsx](</c:/Users/zieada/pfmea-app/app/settings/risk-matrix/page.tsx>)
  - [app/settings/sites-departments/page.tsx](</c:/Users/zieada/pfmea-app/app/settings/sites-departments/page.tsx>)

### Rating scale cleanup
- Reused the shared rating-scale feature instead of keeping three near-duplicate legacy pages
- Switched:
  - [app/settings/severity/page.tsx](</c:/Users/zieada/pfmea-app/app/settings/severity/page.tsx>)
  - [app/settings/occurrence/page.tsx](</c:/Users/zieada/pfmea-app/app/settings/occurrence/page.tsx>)
  - [app/settings/detection/page.tsx](</c:/Users/zieada/pfmea-app/app/settings/detection/page.tsx>)
- Backed by:
  - [src/features/settings/rating-scale/RatingScalePage.tsx](</c:/Users/zieada/pfmea-app/src/features/settings/rating-scale/RatingScalePage.tsx>)

### Navigation and role context
- Added `Organizations` to settings navigation for global admin
- Updated [src/lib/auth/client-session.ts](</c:/Users/zieada/pfmea-app/src/lib/auth/client-session.ts>) so global admin is not treated like `no-org` in settings context resolution
- Updated [src/components/Layout/AppHeader.tsx](</c:/Users/zieada/pfmea-app/src/components/Layout/AppHeader.tsx>) and [src/lib/routing.ts](</c:/Users/zieada/pfmea-app/src/lib/routing.ts>)

### Supabase
- Added and applied live:
  - [db/2026-04-23_supabase_admin_organizations.sql](</c:/Users/zieada/pfmea-app/db/2026-04-23_supabase_admin_organizations.sql>)
- New live functions:
  - `admin_create_organization_with_champion(...)`
  - `admin_list_organizations()`
- Updated live `get_my_header()` to include `global_role`

## Validation
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- live Supabase validation confirmed:
  - `get_my_header()` returns `global_role`
  - `admin_create_organization_with_champion(...)` exists
  - `admin_list_organizations()` exists
  - execute grants are limited to `authenticated`, `service_role`, `postgres`

## Remaining
- `Invitations` still uses its own local style definitions and can later be migrated onto the shared shell for full code-level consistency
- organization management currently covers create + champion assignment/invitation, but not later reassignment workflows
