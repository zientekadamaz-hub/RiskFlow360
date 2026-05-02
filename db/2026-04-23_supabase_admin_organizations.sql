-- Admin organization management
-- - expose global_role in get_my_header()
-- - allow global admin to create a new organization with starter license
-- - assign an existing user as champion or create a pending champion invitation
-- - expose read-only organization overview for the admin settings page

drop function if exists public.get_my_header();

create function public.get_my_header()
returns table(
  user_id uuid,
  first_name text,
  last_name text,
  org_name text,
  org_role text,
  global_role text
)
language sql
security definer
set search_path to 'public'
as $function$
  select
    p.id as user_id,
    p.first_name,
    p.last_name,
    o.name as org_name,
    om.role::text as org_role,
    p.global_role
  from public.profiles p
  left join public.organization_members om
    on om.user_id = p.id
   and (
     om.organization_id = p.active_organization_id
     or p.active_organization_id is null
   )
  left join public.organizations o
    on o.id = coalesce(p.active_organization_id, om.organization_id)
  where p.id = auth.uid()
  order by case when om.organization_id = p.active_organization_id then 0 else 1 end, om.created_at asc
  limit 1;
$function$;

create or replace function public.admin_create_organization_with_champion(
  p_organization_name text,
  p_champion_email text,
  p_champion_first_name text default null,
  p_champion_last_name text default null,
  p_seats_purchased integer default 10,
  p_invites_allowed_total integer default 10,
  p_valid_to date default null
)
returns table(
  organization_id uuid,
  organization_name text,
  champion_email text,
  champion_first_name text,
  champion_last_name text,
  champion_status text,
  invitation_id uuid,
  invitation_token uuid
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_org_id uuid;
  v_org_name text := nullif(btrim(p_organization_name), '');
  v_email text := lower(nullif(btrim(p_champion_email), ''));
  v_first_name text := nullif(btrim(p_champion_first_name), '');
  v_last_name text := nullif(btrim(p_champion_last_name), '');
  v_profile public.profiles;
  v_inv public.organization_invitations;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select p.global_role
    into v_actor_role
  from public.profiles p
  where p.id = v_actor;

  if v_actor_role <> 'admin' then
    raise exception 'Not allowed';
  end if;

  if v_org_name is null then
    raise exception 'Organization name is required';
  end if;

  if v_email is null then
    raise exception 'Champion email is required';
  end if;

  if p_seats_purchased < 1 then
    raise exception 'Seats purchased must be greater than zero';
  end if;

  if p_invites_allowed_total < 1 then
    raise exception 'Invites allowed total must be greater than zero';
  end if;

  if exists (
    select 1
    from public.organizations o
    where lower(o.name) = lower(v_org_name)
  ) then
    raise exception 'Organization with this name already exists';
  end if;

  insert into public.organizations (
    id,
    name,
    created_at,
    created_by,
    active
  ) values (
    gen_random_uuid(),
    v_org_name,
    now(),
    v_actor,
    true
  )
  returning id into v_org_id;

  insert into public.organization_license (
    organization_id,
    seats_purchased,
    invites_allowed_total,
    valid_from,
    valid_to,
    created_at,
    updated_at
  ) values (
    v_org_id,
    p_seats_purchased,
    p_invites_allowed_total,
    current_date,
    p_valid_to,
    now(),
    now()
  );

  select *
    into v_profile
  from public.profiles p
  where lower(p.email) = v_email
  limit 1;

  if found then
    insert into public.organization_members (
      id,
      organization_id,
      user_id,
      role,
      created_at
    ) values (
      gen_random_uuid(),
      v_org_id,
      v_profile.id,
      'champion',
      now()
    )
    on conflict (organization_id, user_id)
    do update set role = excluded.role;

    update public.profiles
       set first_name = coalesce(v_first_name, first_name),
           last_name = coalesce(v_last_name, last_name),
           active = true,
           active_organization_id = coalesce(active_organization_id, v_org_id)
     where id = v_profile.id;

    organization_id := v_org_id;
    organization_name := v_org_name;
    champion_email := coalesce(v_profile.email, v_email);
    champion_first_name := coalesce(v_first_name, v_profile.first_name);
    champion_last_name := coalesce(v_last_name, v_profile.last_name);
    champion_status := 'ASSIGNED';
    invitation_id := null;
    invitation_token := null;
    return next;
    return;
  end if;

  insert into public.organization_invitations (
    id,
    organization_id,
    email,
    role,
    token,
    status,
    invited_by,
    created_at,
    expires_at,
    accepted_at,
    accepted_by,
    first_name,
    last_name
  ) values (
    gen_random_uuid(),
    v_org_id,
    v_email,
    'champion',
    gen_random_uuid(),
    'PENDING',
    v_actor,
    now(),
    null,
    null,
    null,
    v_first_name,
    v_last_name
  )
  returning * into v_inv;

  organization_id := v_org_id;
  organization_name := v_org_name;
  champion_email := v_inv.email;
  champion_first_name := v_inv.first_name;
  champion_last_name := v_inv.last_name;
  champion_status := 'PENDING';
  invitation_id := v_inv.id;
  invitation_token := v_inv.token;
  return next;
end;
$function$;

create or replace function public.admin_list_organizations()
returns table(
  organization_id uuid,
  organization_name text,
  active boolean,
  created_at timestamptz,
  seats_purchased integer,
  invites_allowed_total integer,
  valid_to date,
  champion_email text,
  champion_first_name text,
  champion_last_name text,
  champion_status text,
  champion_source text,
  champion_invitation_token uuid
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select p.global_role
    into v_actor_role
  from public.profiles p
  where p.id = v_actor;

  if v_actor_role <> 'admin' then
    raise exception 'Not allowed';
  end if;

  return query
  select
    o.id as organization_id,
    o.name as organization_name,
    o.active,
    o.created_at,
    ol.seats_purchased,
    ol.invites_allowed_total,
    ol.valid_to,
    coalesce(cm.email, ci.email) as champion_email,
    coalesce(cm.first_name, ci.first_name) as champion_first_name,
    coalesce(cm.last_name, ci.last_name) as champion_last_name,
    case
      when cm.user_id is not null then 'ASSIGNED'
      else coalesce(ci.status, 'UNASSIGNED')
    end as champion_status,
    case
      when cm.user_id is not null then 'member'
      when ci.id is not null then 'invitation'
      else 'none'
    end as champion_source,
    case when cm.user_id is null then ci.token else null end as champion_invitation_token
  from public.organizations o
  left join public.organization_license ol
    on ol.organization_id = o.id
  left join lateral (
    select
      om.user_id,
      p.email,
      p.first_name,
      p.last_name
    from public.organization_members om
    join public.profiles p
      on p.id = om.user_id
    where om.organization_id = o.id
      and om.role = 'champion'
    order by om.created_at asc
    limit 1
  ) cm on true
  left join lateral (
    select
      oi.id,
      oi.email,
      oi.first_name,
      oi.last_name,
      oi.token,
      oi.status,
      oi.created_at
    from public.organization_invitations oi
    where oi.organization_id = o.id
      and oi.role = 'champion'
    order by
      case
        when oi.status = 'ACTIVE' then 0
        when oi.status = 'PENDING' then 1
        when oi.status = 'NOACTIVE' then 2
        else 3
      end,
      oi.created_at desc
    limit 1
  ) ci on cm.user_id is null
  order by o.created_at desc;
end;
$function$;

revoke execute on function public.admin_create_organization_with_champion(text, text, text, text, integer, integer, date) from public, anon;
revoke execute on function public.admin_list_organizations() from public, anon;
revoke execute on function public.get_my_header() from public, anon;

grant execute on function public.admin_create_organization_with_champion(text, text, text, text, integer, integer, date) to authenticated, service_role;
grant execute on function public.admin_list_organizations() to authenticated, service_role;
grant execute on function public.get_my_header() to authenticated, service_role;
