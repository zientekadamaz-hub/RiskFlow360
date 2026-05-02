-- Role model normalization
-- Target model:
-- - global admin exists only in public.profiles.global_role
-- - organization-level leadership role is champion
-- - organization_members.role = 'admin' is treated as legacy and normalized to 'champion'

create or replace function public.is_org_admin_or_champion_v2(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.global_role = 'admin'
    )
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = p_org_id
        and om.user_id = auth.uid()
        and om.role = 'champion'
    );
$function$;

update public.organization_members
set role = 'champion'
where role = 'admin';

update public.profiles
set global_role = 'admin'
where lower(email) = 'riskflow360@gmail.com';
