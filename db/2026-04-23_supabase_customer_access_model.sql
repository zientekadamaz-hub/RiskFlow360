-- Customer access model
-- Goals:
-- - allow champions/global admin to invite customer users
-- - keep customer users inside an organization without org-wide project/module read
-- - grant customer read access explicitly per project + module

create table if not exists public.customer_access_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  module text not null check (module in ('PFD', 'PFMEA', 'PCP')),
  active boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_access_grants_unique unique (customer_user_id, project_id, module)
);

create index if not exists idx_customer_access_grants_customer_project
  on public.customer_access_grants (customer_user_id, project_id);

create index if not exists idx_customer_access_grants_org_project
  on public.customer_access_grants (organization_id, project_id);

alter table public.customer_access_grants enable row level security;

revoke all on table public.customer_access_grants from public, anon;
grant select, insert, update, delete on table public.customer_access_grants to authenticated;

drop policy if exists "customer_access_grants_select" on public.customer_access_grants;
create policy "customer_access_grants_select"
on public.customer_access_grants
for select
to authenticated
using (
  customer_user_id = auth.uid()
  or public.is_org_admin_or_champion_v2(organization_id)
);

drop policy if exists "customer_access_grants_insert" on public.customer_access_grants;
create policy "customer_access_grants_insert"
on public.customer_access_grants
for insert
to authenticated
with check (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "customer_access_grants_update" on public.customer_access_grants;
create policy "customer_access_grants_update"
on public.customer_access_grants
for update
to authenticated
using (public.is_org_admin_or_champion_v2(organization_id))
with check (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "customer_access_grants_delete" on public.customer_access_grants;
create policy "customer_access_grants_delete"
on public.customer_access_grants
for delete
to authenticated
using (public.is_org_admin_or_champion_v2(organization_id));

create or replace function public.list_customer_access_candidates(p_org uuid)
returns table (
  customer_user_id uuid,
  email text,
  first_name text,
  last_name text,
  profile_active boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_org_admin_or_champion_v2(p_org) then
    raise exception 'Not allowed';
  end if;

  return query
  select
    om.user_id as customer_user_id,
    p.email,
    p.first_name,
    p.last_name,
    p.active as profile_active
  from public.organization_members om
  join public.profiles p
    on p.id = om.user_id
  where om.organization_id = p_org
    and om.role = 'customer'
  order by lower(coalesce(p.email, ''));
end;
$function$;

create or replace function public.list_customer_access_grants(p_org uuid)
returns table (
  grant_id uuid,
  customer_user_id uuid,
  email text,
  first_name text,
  last_name text,
  project_id uuid,
  project_name text,
  module text,
  active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_org_admin_or_champion_v2(p_org) then
    raise exception 'Not allowed';
  end if;

  return query
  select
    cag.id as grant_id,
    cag.customer_user_id,
    p.email,
    p.first_name,
    p.last_name,
    pr.id as project_id,
    pr.name as project_name,
    cag.module,
    cag.active,
    cag.created_at
  from public.customer_access_grants cag
  join public.profiles p
    on p.id = cag.customer_user_id
  join public.projects pr
    on pr.id = cag.project_id
  where cag.organization_id = p_org
  order by lower(coalesce(p.email, '')), lower(coalesce(pr.name, '')), cag.module;
end;
$function$;

create or replace function public.set_customer_access_grant(
  p_org uuid,
  p_customer_user_id uuid,
  p_project_id uuid,
  p_module text,
  p_enabled boolean
)
returns public.customer_access_grants
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_module text := upper(trim(coalesce(p_module, '')));
  v_row public.customer_access_grants;
begin
  if not public.is_org_admin_or_champion_v2(p_org) then
    raise exception 'Not allowed';
  end if;

  if v_module not in ('PFD', 'PFMEA', 'PCP') then
    raise exception 'Invalid module';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_org
      and om.user_id = p_customer_user_id
      and om.role = 'customer'
  ) then
    raise exception 'Selected user is not an active customer member of this organization';
  end if;

  if not exists (
    select 1
    from public.projects pr
    where pr.id = p_project_id
      and pr.organization_id = p_org
  ) then
    raise exception 'Project does not belong to this organization';
  end if;

  if coalesce(p_enabled, false) then
    insert into public.customer_access_grants (
      organization_id,
      customer_user_id,
      project_id,
      module,
      active,
      created_by,
      created_at,
      updated_at
    )
    values (
      p_org,
      p_customer_user_id,
      p_project_id,
      v_module,
      true,
      auth.uid(),
      now(),
      now()
    )
    on conflict (customer_user_id, project_id, module)
    do update set
      active = true,
      updated_at = now()
    returning * into v_row;

    return v_row;
  end if;

  delete from public.customer_access_grants
  where organization_id = p_org
    and customer_user_id = p_customer_user_id
    and project_id = p_project_id
    and module = v_module;

  return null;
end;
$function$;

revoke execute on function public.list_customer_access_candidates(uuid) from public, anon;
grant execute on function public.list_customer_access_candidates(uuid) to authenticated, service_role;

revoke execute on function public.list_customer_access_grants(uuid) from public, anon;
grant execute on function public.list_customer_access_grants(uuid) to authenticated, service_role;

revoke execute on function public.set_customer_access_grant(uuid, uuid, uuid, text, boolean) from public, anon;
grant execute on function public.set_customer_access_grant(uuid, uuid, uuid, text, boolean) to authenticated, service_role;

create or replace function public.create_org_invitation(p_org uuid, p_email text, p_role app_role)
returns organization_invitations
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_allowed int;
  v_used int;
  v_now timestamptz := now();
  v_inv public.organization_invitations;
  v_exists public.organization_invitations;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_org_admin_or_champion_v2(p_org) then
    raise exception 'Not allowed';
  end if;

  if p_role not in ('champion', 'engineer', 'viewer', 'customer') then
    raise exception 'Invalid role for invitation';
  end if;

  if exists (
    select 1 from public.profiles p
    where lower(p.email) = lower(p_email)
  ) then
    raise exception 'User with this email already exists.';
  end if;

  select ol.invites_allowed_total
    into v_allowed
  from public.organization_license ol
  where ol.organization_id = p_org
    and (ol.valid_from is null or ol.valid_from <= v_now::date)
    and (ol.valid_to is null or ol.valid_to >= v_now::date);

  if v_allowed is null then
    raise exception 'No active license for organization';
  end if;

  select count(*)
    into v_used
  from public.organization_invitations oi
  where oi.organization_id = p_org
    and oi.status in ('PENDING', 'ACTIVE');

  if v_used >= v_allowed then
    raise exception 'Invite limit reached (%/%).', v_used, v_allowed;
  end if;

  select *
    into v_exists
  from public.organization_invitations
  where organization_id = p_org
    and lower(email) = lower(p_email)
  limit 1;

  if found and v_exists.status in ('PENDING', 'ACTIVE') then
    raise exception 'Invitation already exists with status %', v_exists.status;
  end if;

  if found and v_exists.status = 'NOACTIVE' then
    update public.organization_invitations
       set role = p_role,
           status = 'PENDING',
           token = gen_random_uuid(),
           invited_by = v_actor,
           created_at = now(),
           expires_at = null,
           accepted_at = null,
           accepted_by = null
     where id = v_exists.id
     returning * into v_inv;

    return v_inv;
  end if;

  insert into public.organization_invitations (
    id, organization_id, email, role, token, status,
    invited_by, created_at, expires_at, accepted_at, accepted_by
  ) values (
    gen_random_uuid(), p_org, p_email, p_role, gen_random_uuid(), 'PENDING',
    v_actor, now(), null, null, null
  )
  returning * into v_inv;

  return v_inv;
end;
$function$;

drop policy if exists "projects_select" on public.projects;
create policy "projects_select"
on public.projects
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
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = projects.organization_id
      and om.role <> 'customer'
  )
  or exists (
    select 1
    from public.customer_access_grants cag
    where cag.project_id = projects.id
      and cag.customer_user_id = auth.uid()
      and cag.active
  )
);

drop policy if exists "operations_select" on public.operations;
create policy "operations_select"
on public.operations
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
    where pr.id = operations.project_id
      and om.user_id = auth.uid()
      and om.role <> 'customer'
  )
  or exists (
    select 1
    from public.customer_access_grants cag
    where cag.project_id = operations.project_id
      and cag.customer_user_id = auth.uid()
      and cag.active
  )
);

drop policy if exists "site_departments_select" on public.site_departments;
create policy "site_departments_select"
on public.site_departments
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
    from public.organization_members om
    where om.organization_id = site_departments.organization_id
      and om.user_id = auth.uid()
      and om.role <> 'customer'
  )
  or exists (
    select 1
    from public.customer_access_grants cag
    join public.projects pr
      on pr.id = cag.project_id
    where cag.customer_user_id = auth.uid()
      and cag.active
      and pr.site_department_id = site_departments.id
  )
);

drop policy if exists "pfd_diagrams_select" on public.pfd_diagrams;
create policy "pfd_diagrams_select"
on public.pfd_diagrams
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
    where pr.id = pfd_diagrams.project_id
      and om.user_id = auth.uid()
      and om.role <> 'customer'
  )
  or exists (
    select 1
    from public.customer_access_grants cag
    where cag.project_id = pfd_diagrams.project_id
      and cag.customer_user_id = auth.uid()
      and cag.active
      and cag.module = 'PFD'
  )
);

drop policy if exists "pfmea_rows_select" on public.pfmea_rows;
create policy "pfmea_rows_select"
on public.pfmea_rows
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
    from public.operations op
    join public.projects pr
      on pr.id = op.project_id
    join public.organization_members om
      on om.organization_id = pr.organization_id
    where op.id = pfmea_rows.operation_id
      and om.user_id = auth.uid()
      and om.role <> 'customer'
  )
  or exists (
    select 1
    from public.operations op
    join public.customer_access_grants cag
      on cag.project_id = op.project_id
    where op.id = pfmea_rows.operation_id
      and cag.customer_user_id = auth.uid()
      and cag.active
      and cag.module = 'PFMEA'
  )
);

drop policy if exists "control_plan_rows_select_member" on public.control_plan_rows;
create policy "control_plan_rows_select_member"
on public.control_plan_rows
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
    from public.operations op
    join public.projects pr
      on pr.id = op.project_id
    join public.organization_members om
      on om.organization_id = pr.organization_id
    where op.id = control_plan_rows.operation_id
      and om.user_id = auth.uid()
      and om.role <> 'customer'
  )
  or exists (
    select 1
    from public.operations op
    join public.customer_access_grants cag
      on cag.project_id = op.project_id
    where op.id = control_plan_rows.operation_id
      and cag.customer_user_id = auth.uid()
      and cag.active
      and cag.module = 'PCP'
  )
);

drop policy if exists "pfd_change_history_select_member" on public.pfd_change_history;
create policy "pfd_change_history_select_member"
on public.pfd_change_history
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
    where pr.id = pfd_change_history.project_id
      and om.user_id = auth.uid()
      and om.role <> 'customer'
  )
  or exists (
    select 1
    from public.customer_access_grants cag
    where cag.project_id = pfd_change_history.project_id
      and cag.customer_user_id = auth.uid()
      and cag.active
      and cag.module = 'PFD'
  )
);

drop policy if exists "pfmea_change_history_select_member" on public.pfmea_change_history;
create policy "pfmea_change_history_select_member"
on public.pfmea_change_history
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
    where pr.id = pfmea_change_history.project_id
      and om.user_id = auth.uid()
      and om.role <> 'customer'
  )
  or exists (
    select 1
    from public.customer_access_grants cag
    where cag.project_id = pfmea_change_history.project_id
      and cag.customer_user_id = auth.uid()
      and cag.active
      and cag.module = 'PFMEA'
  )
);

drop policy if exists "pcp_change_history_select_member" on public.pcp_change_history;
create policy "pcp_change_history_select_member"
on public.pcp_change_history
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
    where pr.id = pcp_change_history.project_id
      and om.user_id = auth.uid()
      and om.role <> 'customer'
  )
  or exists (
    select 1
    from public.customer_access_grants cag
    where cag.project_id = pcp_change_history.project_id
      and cag.customer_user_id = auth.uid()
      and cag.active
      and cag.module = 'PCP'
  )
);
