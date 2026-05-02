-- Ensure customer-facing project list respects table RLS.
-- Without security_invoker the view runs as owner (postgres) and can bypass
-- the restrictive projects_select policy intended for customer users.

create or replace view public.projects_with_revision
with (security_invoker = true)
as
select
  p.id,
  p.user_id,
  p.name,
  p.standard,
  p.status,
  p.created_at,
  p.updated_at,
  p.updated_by,
  p.current_open_revision_id,
  p.current_draft_revision_id,
  ro.pfd_rev as open_pfd_rev,
  ro.pfmea_rev as open_pfmea_rev,
  ro.pcp_rev as open_pcp_rev,
  coalesce(
    ((ro.pfd_rev::text || '.'::text) || ro.pfmea_rev::text) || '.'::text || ro.pcp_rev::text,
    '0.0.0'::text
  ) as open_revision_label,
  rd.pfd_rev as draft_pfd_rev,
  rd.pfmea_rev as draft_pfmea_rev,
  rd.pcp_rev as draft_pcp_rev,
  coalesce(
    ((rd.pfd_rev::text || '.'::text) || rd.pfmea_rev::text) || '.'::text || rd.pcp_rev::text,
    null::text
  ) as draft_revision_label,
  p.organization_id,
  p.site_department_id,
  p.products
from public.projects p
left join public.process_revisions ro
  on ro.id = p.current_open_revision_id
left join public.process_revisions rd
  on rd.id = p.current_draft_revision_id;

revoke all on table public.projects_with_revision from public, anon;
grant select on table public.projects_with_revision to authenticated, service_role;
