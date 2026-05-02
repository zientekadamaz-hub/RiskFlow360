-- Invite-only activation hardening
-- Goals:
-- 1) remove browser-side open signUp from invitation flow
-- 2) allow invited users to set their first password only through a valid invitation token
-- 3) expose a safe invitation preview for login / waiting screens

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
  limit 1;

  if not found then
    raise exception 'Invitation not found or no longer pending';
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

revoke execute on function public.get_invitation_preview(uuid) from public;
revoke execute on function public.activate_invited_user(uuid, text) from public;

grant execute on function public.get_invitation_preview(uuid) to anon, authenticated, service_role;
grant execute on function public.activate_invited_user(uuid, text) to anon, authenticated, service_role;
