-- Supabase invitation/admin + projects hardening
-- 1. Normalize invitation flows and role checks
-- 2. Align project permissions with agreed business model
-- 3. Reduce anon exposure on key project/admin tables

-- ---------------------------------------------------------------------------
-- Helper function: global admin OR org admin/champion
-- ---------------------------------------------------------------------------

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
        and om.role in ('champion', 'admin')
    );
$function$;

-- ---------------------------------------------------------------------------
-- Invitation accept flow
-- ---------------------------------------------------------------------------

create or replace function public.accept_invitation()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv public.organization_invitations;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select p.email
    into v_email
  from public.profiles p
  where p.id = v_uid;

  if v_email is null then
    raise exception 'No profile/email for current user';
  end if;

  select *
    into v_inv
  from public.organization_invitations oi
  where lower(oi.email) = lower(v_email)
    and oi.status = 'PENDING'
  order by oi.created_at desc
  limit 1;

  if not found then
    raise exception 'No pending invitation for %', v_email;
  end if;

  insert into public.organization_members (organization_id, user_id, role, created_at)
  values (v_inv.organization_id, v_uid, v_inv.role, now())
  on conflict (organization_id, user_id)
  do update set role = excluded.role;

  update public.profiles
     set active_organization_id = v_inv.organization_id,
         active = true
   where id = v_uid;

  update public.organization_invitations
     set status = 'ACTIVE',
         accepted_by = v_uid,
         accepted_at = now()
   where id = v_inv.id;

  return v_inv.organization_id;
end;
$function$;

create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inv public.organization_invitations;
  v_uid uuid := auth.uid();
  v_email text := (auth.jwt() ->> 'email');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_inv
  from public.organization_invitations
  where token = p_token
  limit 1;

  if not found then
    raise exception 'Invalid token';
  end if;

  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception 'Invitation expired';
  end if;

  if v_inv.status <> 'PENDING' then
    raise exception 'Invitation not pending (status=%)', v_inv.status;
  end if;

  if v_email is null or lower(v_email) <> lower(v_inv.email) then
    raise exception 'Email mismatch';
  end if;

  insert into public.organization_members (id, organization_id, user_id, role, created_at)
  values (gen_random_uuid(), v_inv.organization_id, v_uid, v_inv.role, now())
  on conflict (organization_id, user_id)
  do update set role = excluded.role;

  update public.organization_invitations
     set status = 'ACTIVE',
         accepted_at = now(),
         accepted_by = v_uid
   where id = v_inv.id;

  update public.profiles
     set active = true,
         active_organization_id = v_inv.organization_id
   where id = v_uid;

  return v_inv.organization_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Invitation admin functions
-- ---------------------------------------------------------------------------

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

  if p_role not in ('champion', 'engineer', 'viewer') then
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

create or replace function public.set_invitation_status(p_invite_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
  v_uid uuid;
begin
  select organization_id, accepted_by
    into v_org, v_uid
  from public.organization_invitations
  where id = p_invite_id;

  if v_org is null then
    raise exception 'Invite not found';
  end if;

  if not public.is_org_admin_or_champion_v2(v_org) then
    raise exception 'Not allowed';
  end if;

  if p_status not in ('PENDING', 'ACTIVE', 'NOACTIVE') then
    raise exception 'Invalid status';
  end if;

  update public.organization_invitations
     set status = p_status
   where id = p_invite_id;

  if v_uid is not null then
    update public.profiles
       set active = (p_status = 'ACTIVE'),
           active_organization_id = case
             when p_status = 'ACTIVE' then coalesce(active_organization_id, v_org)
             when active_organization_id = v_org then null
             else active_organization_id
           end
     where id = v_uid;
  end if;
end;
$function$;

create or replace function public.set_invitation_status(p_org uuid, p_email text, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid;
  v_inv public.organization_invitations;
begin
  if not public.is_org_admin_or_champion_v2(p_org) then
    raise exception 'Not allowed';
  end if;

  if p_status not in ('ACTIVE', 'NOACTIVE', 'PENDING') then
    raise exception 'Invalid status';
  end if;

  select *
    into v_inv
  from public.organization_invitations
  where organization_id = p_org
    and lower(email) = lower(p_email)
  limit 1;

  if not found then
    raise exception 'Invitation not found for email';
  end if;

  update public.organization_invitations
     set status = p_status
   where id = v_inv.id;

  v_uid := v_inv.accepted_by;

  if v_uid is null then
    select id into v_uid
    from public.profiles
    where lower(email) = lower(p_email)
    limit 1;
  end if;

  if v_uid is not null then
    update public.profiles
       set active = (p_status = 'ACTIVE'),
           active_organization_id = case
             when p_status = 'ACTIVE' then coalesce(active_organization_id, p_org)
             when active_organization_id = p_org then null
             else active_organization_id
           end
     where id = v_uid;
  end if;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Normalize invitation-related policy semantics
-- ---------------------------------------------------------------------------

drop policy if exists "org_invites_insert_org" on public.organization_invitations;

create policy "org_invites_insert_org"
on public.organization_invitations
for insert
to authenticated
with check (
  is_org_admin_or_champion_v2(organization_id)
  and (
    coalesce(
      (
        select ol.invites_allowed_total
        from public.organization_license ol
        where ol.organization_id = organization_invitations.organization_id
      ),
      0
    ) > (
      select count(*)
      from public.organization_invitations oi
      where oi.organization_id = organization_invitations.organization_id
        and oi.status in ('PENDING', 'ACTIVE')
    )
  )
);

-- ---------------------------------------------------------------------------
-- Align project permissions with business role model
-- engineer: create/update yes, delete no
-- champion/org admin/global admin: delete yes
-- ---------------------------------------------------------------------------

revoke all on table public.projects from anon;
revoke all on table public.projects from authenticated;
grant select, insert, update, delete on table public.projects to authenticated;

drop policy if exists "projects_select" on public.projects;
drop policy if exists "projects_insert" on public.projects;
drop policy if exists "projects_update" on public.projects;
drop policy if exists "projects_delete" on public.projects;

create policy "projects_select"
on public.projects
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = projects.organization_id
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "projects_insert"
on public.projects
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = projects.organization_id
      and om.role in ('admin', 'champion', 'engineer')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "projects_update"
on public.projects
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = projects.organization_id
      and om.role in ('admin', 'champion', 'engineer')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = projects.organization_id
      and om.role in ('admin', 'champion', 'engineer')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "projects_delete"
on public.projects
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = projects.organization_id
      and om.role in ('admin', 'champion')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- Organizations: remove anon access, keep global admin capability explicit
-- ---------------------------------------------------------------------------

revoke all on table public.organizations from anon;
revoke all on table public.organizations from authenticated;
grant select, insert, update, delete on table public.organizations to authenticated;

drop policy if exists "organizations_select" on public.organizations;
drop policy if exists "organizations_insert" on public.organizations;
drop policy if exists "organizations_update" on public.organizations;
drop policy if exists "organizations_delete" on public.organizations;

create policy "organizations_select"
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "organizations_insert"
on public.organizations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "organizations_update"
on public.organizations
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "organizations_delete"
on public.organizations
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);
