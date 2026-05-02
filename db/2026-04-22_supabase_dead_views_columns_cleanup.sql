-- Remove confirmed dead views and low-risk unused columns.
-- Safe scope only:
-- - views with no current app usage and no detected SQL dependents
-- - columns confirmed present but empty in live data

drop view if exists public.org_invitations_list;
drop view if exists public.org_license_usage;
drop view if exists public.severity_effective;

alter table if exists public.access_requests
  drop column if exists requested_seats;

alter table if exists public.operations
  drop column if exists description;

alter table if exists public.operations
  drop column if exists special_characteristic;
