create or replace function public.submit_access_request(
  p_company_name text,
  p_requester_email text,
  p_first_name text default null,
  p_last_name text default null,
  p_requested_invites integer default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_company_name text := nullif(btrim(p_company_name), '');
  v_requester_email text := lower(nullif(btrim(p_requester_email), ''));
  v_first_name text := nullif(btrim(p_first_name), '');
  v_last_name text := nullif(btrim(p_last_name), '');
  v_requested_invites integer := p_requested_invites;
  v_existing_active uuid;
  v_recent_request uuid;
  v_new_id uuid;
begin
  if v_company_name is null or length(v_company_name) < 2 then
    raise exception 'Company name is required';
  end if;

  if length(v_company_name) > 120 then
    raise exception 'Company name is too long';
  end if;

  if v_requester_email is null or v_requester_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Requester email is invalid';
  end if;

  if v_first_name is not null and length(v_first_name) > 80 then
    raise exception 'First name is too long';
  end if;

  if v_last_name is not null and length(v_last_name) > 80 then
    raise exception 'Last name is too long';
  end if;

  if v_requested_invites is not null and (v_requested_invites < 1 or v_requested_invites > 250) then
    raise exception 'Requested invites must be between 1 and 250';
  end if;

  select ar.id
    into v_existing_active
  from public.access_requests ar
  where lower(ar.requester_email) = v_requester_email
    and lower(ar.company_name) = lower(v_company_name)
    and coalesce(ar.status, 'NEW') in ('NEW', 'PENDING', 'IN_REVIEW')
  order by ar.created_at desc
  limit 1;

  if v_existing_active is not null then
    raise exception 'A request for this company and email is already pending review';
  end if;

  select ar.id
    into v_recent_request
  from public.access_requests ar
  where lower(ar.requester_email) = v_requester_email
    and ar.created_at >= now() - interval '24 hours'
  order by ar.created_at desc
  limit 1;

  if v_recent_request is not null then
    raise exception 'A request was recently submitted for this email. Please wait before trying again';
  end if;

  insert into public.access_requests (
    company_name,
    requester_email,
    first_name,
    last_name,
    requested_invites
  )
  values (
    v_company_name,
    v_requester_email,
    v_first_name,
    v_last_name,
    v_requested_invites
  )
  returning id into v_new_id;

  return v_new_id;
end;
$function$;
