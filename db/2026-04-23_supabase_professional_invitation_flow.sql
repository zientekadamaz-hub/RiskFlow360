-- Professional invitation flow
-- Goals:
-- - token-based invitation becomes the primary acceptance path
-- - no-arg accept flow stops ambiguously accepting "latest" invite
-- - resending / resetting to PENDING rotates token and clears acceptance state

create or replace function public.accept_invitation()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_pending_count integer := 0;
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

  select count(*)
    into v_pending_count
  from public.organization_invitations oi
  where lower(oi.email) = lower(v_email)
    and oi.status = 'PENDING';

  if v_pending_count = 0 then
    raise exception 'No pending invitation for %', v_email;
  end if;

  if v_pending_count > 1 then
    raise exception 'Multiple pending invitations found. Use the invitation link.';
  end if;

  select *
    into v_inv
  from public.organization_invitations oi
  where lower(oi.email) = lower(v_email)
    and oi.status = 'PENDING'
  limit 1;

  if v_inv.token is null then
    raise exception 'Invitation token missing. Ask your champion to resend the invitation.';
  end if;

  return public.accept_invitation(v_inv.token);
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
