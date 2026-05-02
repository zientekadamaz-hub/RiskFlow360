-- Invitation token expiry hardening
-- Goals:
-- 1) stop invitation links from remaining valid indefinitely
-- 2) make public invitation preview / first-password activation respect expires_at
-- 3) preserve the token-first invitation flow and existing role model

update public.organization_invitations
   set expires_at = now() + interval '14 days'
 where status = 'PENDING'
   and expires_at is null;

create or replace function public.get_invitation_preview(p_token uuid)
returns table(
  email text,
  first_name text,
  last_name text,
  organization_name text,
  role text,
  status text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_token is null then
    raise exception 'Invitation token is required';
  end if;

  return query
  select
    oi.email,
    oi.first_name,
    oi.last_name,
    o.name as organization_name,
    oi.role::text,
    oi.status::text
  from public.organization_invitations oi
  left join public.organizations o
    on o.id = oi.organization_id
  where oi.token = p_token
    and oi.status = 'PENDING'
    and oi.expires_at >= now()
  limit 1;

  if not found then
    raise exception 'Invitation not found, expired, or no longer pending';
  end if;
end;
$function$;

create or replace function public.activate_invited_user(
  p_token uuid,
  p_password text
)
returns table(
  user_id uuid,
  email text
)
language plpgsql
security definer
set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  v_inv public.organization_invitations;
  v_email text;
  v_user_id uuid;
  v_now timestamptz := now();
  v_password text := coalesce(p_password, '');
begin
  if p_token is null then
    raise exception 'Invitation token is required';
  end if;

  if length(v_password) < 8
     or v_password !~ '[A-Z]'
     or v_password !~ '[a-z]'
     or v_password !~ '[0-9]'
     or v_password !~ '[^A-Za-z0-9]' then
    raise exception 'Password does not meet security requirements';
  end if;

  select *
    into v_inv
  from public.organization_invitations oi
  where oi.token = p_token
  limit 1;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if coalesce(v_inv.status, 'PENDING') <> 'PENDING' then
    if v_inv.status = 'ACTIVE' then
      raise exception 'Invitation already accepted. Sign in with your password.';
    end if;
    raise exception 'Invitation is no longer available.';
  end if;

  if v_inv.expires_at is null or v_inv.expires_at < v_now then
    raise exception 'Invitation expired. Ask your champion to resend the invitation.';
  end if;

  v_email := lower(nullif(btrim(v_inv.email), ''));
  if v_email is null then
    raise exception 'Invitation email is missing';
  end if;

  select u.id
    into v_user_id
  from auth.users u
  where lower(u.email) = v_email
    and u.deleted_at is null
  limit 1;

  if v_user_id is not null then
    raise exception 'Account already exists for this invitation email. Sign in with your password or use password recovery.';
  end if;

  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    v_now,
    v_now,
    '',
    null,
    '',
    null,
    '',
    '',
    null,
    null,
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_strip_nulls(
      jsonb_build_object(
        'first_name', v_inv.first_name,
        'last_name', v_inv.last_name
      )
    ),
    false,
    v_now,
    v_now,
    null,
    null,
    '',
    '',
    v_now,
    '',
    0,
    null,
    '',
    null,
    false,
    null,
    false
  );

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    null,
    v_now,
    v_now
  );

  update public.profiles
     set email = v_email,
         first_name = coalesce(v_inv.first_name, first_name),
         last_name = coalesce(v_inv.last_name, last_name)
   where id = v_user_id;

  return query
  select v_user_id, v_email;
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

  if v_inv.expires_at is null or v_inv.expires_at < now() then
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
           created_at = v_now,
           expires_at = v_now + interval '14 days',
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
    v_actor, v_now, v_now + interval '14 days', null, null
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
     set status = p_status,
         token = case when p_status = 'PENDING' then gen_random_uuid() else token end,
         expires_at = case when p_status = 'PENDING' then now() + interval '14 days' else expires_at end,
         accepted_at = case when p_status = 'PENDING' then null else accepted_at end,
         accepted_by = case when p_status = 'PENDING' then null else accepted_by end
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
     set status = p_status,
         token = case when p_status = 'PENDING' then gen_random_uuid() else token end,
         expires_at = case when p_status = 'PENDING' then now() + interval '14 days' else expires_at end,
         accepted_at = case when p_status = 'PENDING' then null else accepted_at end,
         accepted_by = case when p_status = 'PENDING' then null else accepted_by end
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

revoke execute on function public.get_invitation_preview(uuid) from public;
revoke execute on function public.activate_invited_user(uuid, text) from public;
revoke execute on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.get_invitation_preview(uuid) to anon, authenticated, service_role;
grant execute on function public.activate_invited_user(uuid, text) to anon, authenticated, service_role;
grant execute on function public.accept_invitation(uuid) to authenticated, service_role;

revoke execute on function public.create_org_invitation(uuid, text, public.app_role) from public, anon;
revoke execute on function public.set_invitation_status(uuid, text) from public, anon;
revoke execute on function public.set_invitation_status(uuid, text, text) from public, anon;
grant execute on function public.create_org_invitation(uuid, text, public.app_role) to authenticated, service_role;
grant execute on function public.set_invitation_status(uuid, text) to authenticated, service_role;
grant execute on function public.set_invitation_status(uuid, text, text) to authenticated, service_role;
