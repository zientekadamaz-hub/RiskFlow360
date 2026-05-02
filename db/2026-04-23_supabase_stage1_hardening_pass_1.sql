-- Stage 1 hardening pass:
-- 1) move public access-request writes behind a controlled RPC
-- 2) align site_departments write access with champion/admin model
-- 3) remove remaining broad "public" policy role usage for authenticated data tables

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
  v_existing_pending uuid;
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
    into v_existing_pending
  from public.access_requests ar
  where lower(ar.requester_email) = v_requester_email
    and lower(ar.company_name) = lower(v_company_name)
    and coalesce(ar.status, 'PENDING') in ('PENDING', 'IN_REVIEW')
  order by ar.created_at desc
  limit 1;

  if v_existing_pending is not null then
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

revoke insert on table public.access_requests from anon, authenticated;
drop policy if exists access_requests_insert_public on public.access_requests;

revoke execute on function public.submit_access_request(text, text, text, text, integer) from public;
grant execute on function public.submit_access_request(text, text, text, text, integer) to anon, authenticated, service_role;

alter policy operations_delete on public.operations to authenticated;
alter policy operations_insert on public.operations to authenticated;
alter policy operations_select on public.operations to authenticated;
alter policy operations_update on public.operations to authenticated;

alter policy pfd_diagrams_delete on public.pfd_diagrams to authenticated;
alter policy pfd_diagrams_insert on public.pfd_diagrams to authenticated;
alter policy pfd_diagrams_select on public.pfd_diagrams to authenticated;
alter policy pfd_diagrams_update on public.pfd_diagrams to authenticated;

alter policy pfd_edges_delete2 on public.pfd_edges to authenticated;
alter policy pfd_edges_insert2 on public.pfd_edges to authenticated;
alter policy pfd_edges_select on public.pfd_edges to authenticated;
alter policy pfd_edges_update2 on public.pfd_edges to authenticated;

alter policy pfd_nodes_delete on public.pfd_nodes to authenticated;
alter policy pfd_nodes_insert on public.pfd_nodes to authenticated;
alter policy pfd_nodes_select on public.pfd_nodes to authenticated;
alter policy pfd_nodes_update on public.pfd_nodes to authenticated;

alter policy pfmea_rows_delete on public.pfmea_rows to authenticated;
alter policy pfmea_rows_insert on public.pfmea_rows to authenticated;
alter policy pfmea_rows_select on public.pfmea_rows to authenticated;
alter policy pfmea_rows_update on public.pfmea_rows to authenticated;

alter policy process_revisions_insert on public.process_revisions to authenticated;
alter policy process_revisions_select on public.process_revisions to authenticated;

alter policy site_departments_select on public.site_departments to authenticated;
alter policy site_departments_insert on public.site_departments to authenticated;
alter policy site_departments_insert on public.site_departments
  with check (is_org_admin_or_champion_v2(organization_id));
alter policy site_departments_delete on public.site_departments to authenticated;
alter policy site_departments_delete on public.site_departments
  using (is_org_admin_or_champion_v2(organization_id));
