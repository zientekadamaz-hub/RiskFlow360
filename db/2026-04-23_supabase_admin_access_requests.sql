-- Admin access request visibility and status handling

create or replace function public.admin_list_access_requests()
returns table(
  request_id uuid,
  company_name text,
  requester_email text,
  first_name text,
  last_name text,
  requested_invites integer,
  status text,
  notes_admin text,
  created_at timestamptz,
  handled_at timestamptz,
  handled_by uuid,
  handled_by_name text
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
    ar.id as request_id,
    ar.company_name,
    ar.requester_email,
    ar.first_name,
    ar.last_name,
    ar.requested_invites,
    ar.status,
    ar.notes_admin,
    ar.created_at,
    ar.handled_at,
    ar.handled_by,
    trim(coalesce(h.first_name, '') || ' ' || coalesce(h.last_name, '')) as handled_by_name
  from public.access_requests ar
  left join public.profiles h
    on h.id = ar.handled_by
  order by
    case
      when ar.status = 'PENDING' then 0
      when ar.status = 'IN_REVIEW' then 1
      when ar.status = 'APPROVED' then 2
      when ar.status = 'REJECTED' then 3
      else 4
    end,
    ar.created_at desc;
end;
$function$;

create or replace function public.admin_set_access_request_status(
  p_request_id uuid,
  p_status text,
  p_notes_admin text default null
)
returns void
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

  if p_status not in ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED') then
    raise exception 'Invalid status';
  end if;

  update public.access_requests
     set status = p_status,
         notes_admin = nullif(btrim(p_notes_admin), ''),
         handled_by = v_actor,
         handled_at = now()
   where id = p_request_id;

  if not found then
    raise exception 'Access request not found';
  end if;
end;
$function$;

revoke execute on function public.admin_list_access_requests() from public, anon;
revoke execute on function public.admin_set_access_request_status(uuid, text, text) from public, anon;

grant execute on function public.admin_list_access_requests() to authenticated, service_role;
grant execute on function public.admin_set_access_request_status(uuid, text, text) to authenticated, service_role;
