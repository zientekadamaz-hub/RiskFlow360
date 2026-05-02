-- Allow projects_with_revision (security_invoker) to work for authenticated users
-- while keeping customer reads scoped only to granted projects.

grant select on table public.process_revisions to authenticated, service_role;

drop policy if exists "process_revisions_select" on public.process_revisions;
create policy "process_revisions_select"
on public.process_revisions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
  or exists (
    select 1
    from public.projects pr
    join public.organization_members om
      on om.organization_id = pr.organization_id
    where pr.id = process_revisions.project_id
      and om.user_id = auth.uid()
      and om.role <> 'customer'
  )
  or exists (
    select 1
    from public.customer_access_grants cag
    where cag.project_id = process_revisions.project_id
      and cag.customer_user_id = auth.uid()
      and cag.active
  )
);
