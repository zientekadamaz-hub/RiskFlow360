-- Organization member directory + Champion guard
-- Purpose:
-- - Invitations screen must show both accepted organization members and pending invitations.
-- - Organization must never be left without an active Champion.

create or replace function public.list_org_member_directory(p_org uuid)
returns table(
  id text,
  source text,
  invitation_id uuid,
  member_id uuid,
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  role text,
  status text,
  created_at timestamptz,
  accepted_at timestamptz,
  token uuid
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_org_admin_or_champion_v2(p_org) then
    raise exception 'Not allowed';
  end if;

  return query
  select *
  from (
    select
      concat('member:', om.id)::text as id,
      'member'::text as source,
      null::uuid as invitation_id,
      om.id as member_id,
      om.user_id,
      p.email::text,
      p.first_name::text,
      p.last_name::text,
      om.role::text,
      'ACTIVE'::text as status,
      om.created_at,
      null::timestamptz as accepted_at,
      null::uuid as token
    from public.organization_members om
    join public.profiles p
      on p.id = om.user_id
    where om.organization_id = p_org

    union all

    select
      concat('invitation:', oi.id)::text as id,
      'invitation'::text as source,
      oi.id as invitation_id,
      null::uuid as member_id,
      oi.accepted_by as user_id,
      oi.email::text,
      oi.first_name::text,
      oi.last_name::text,
      oi.role::text,
      oi.status::text,
      oi.created_at,
      oi.accepted_at,
      oi.token
    from public.organization_invitations oi
    where oi.organization_id = p_org
      and not exists (
        select 1
        from public.organization_members om
        left join public.profiles p
          on p.id = om.user_id
        where om.organization_id = p_org
          and (
            om.user_id = oi.accepted_by
            or lower(p.email) = lower(oi.email)
          )
      )
  ) rows
  order by
    case
      when rows.source = 'member' and rows.role = 'champion' then 0
      when rows.source = 'member' then 1
      when rows.status = 'PENDING' then 2
      when rows.status = 'ACTIVE' then 3
      when rows.status = 'NOACTIVE' then 4
      else 5
    end,
    rows.created_at desc;
end;
$function$;

create or replace function public.set_org_member_role(p_org uuid, p_user uuid, p_role app_role)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_current_role text;
  v_champion_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_org_admin_or_champion_v2(p_org) then
    raise exception 'Not allowed';
  end if;

  if p_role not in ('champion', 'engineer', 'viewer', 'customer') then
    raise exception 'Invalid role';
  end if;

  select om.role::text
    into v_current_role
  from public.organization_members om
  where om.organization_id = p_org
    and om.user_id = p_user
  limit 1;

  if v_current_role is null then
    raise exception 'Member not found';
  end if;

  if v_current_role = 'champion' and p_role::text <> 'champion' then
    select count(*)
      into v_champion_count
    from public.organization_members om
    where om.organization_id = p_org
      and om.role = 'champion';

    if coalesce(v_champion_count, 0) <= 1 then
      raise exception 'At least one active Champion is required for the organization.';
    end if;
  end if;

  update public.organization_members
     set role = p_role
   where organization_id = p_org
     and user_id = p_user;

  update public.organization_invitations
     set role = p_role
   where organization_id = p_org
     and accepted_by = p_user;
end;
$function$;

revoke execute on function public.list_org_member_directory(uuid) from public, anon;
revoke execute on function public.set_org_member_role(uuid, uuid, app_role) from public, anon;

grant execute on function public.list_org_member_directory(uuid) to authenticated, service_role;
grant execute on function public.set_org_member_role(uuid, uuid, app_role) to authenticated, service_role;
