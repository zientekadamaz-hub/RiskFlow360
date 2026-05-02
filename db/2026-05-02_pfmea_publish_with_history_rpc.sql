-- PFMEA publish helper
-- Non-destructive wrapper: publishes the PFMEA draft and records PFMEA history
-- in the same database transaction. Existing publish_process_module_revision
-- remains unchanged for backwards compatibility.

create or replace function public.publish_pfmea_revision_with_history(
  p_project_id uuid,
  p_change_description text,
  p_user_id uuid,
  p_author_name text default null,
  p_risk_count integer default 0,
  p_avg_rpn numeric default null
)
returns table(revision_id uuid, revision_label text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor uuid := auth.uid();
  v_revision_id uuid;
  v_revision_label text;
  v_author_name text := coalesce(nullif(btrim(p_author_name), ''), 'Unknown user');
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id is not null and p_user_id <> v_actor then
    raise exception 'User mismatch';
  end if;

  v_revision_id := public.publish_process_module_revision(
    p_project_id,
    'PFMEA',
    p_change_description,
    v_actor
  );

  select pr.pfd_rev::text || '.' || pr.pfmea_rev::text || '.' || pr.pcp_rev::text
    into v_revision_label
  from public.process_revisions pr
  where pr.id = v_revision_id;

  v_revision_label := coalesce(nullif(v_revision_label, ''), '0.0.0');

  insert into public.pfmea_change_history (
    project_id,
    revision_label,
    change_description,
    author_id,
    author_name,
    risk_count,
    avg_rpn,
    created_at
  ) values (
    p_project_id,
    v_revision_label,
    coalesce(p_change_description, ''),
    v_actor,
    v_author_name,
    greatest(coalesce(p_risk_count, 0), 0),
    p_avg_rpn,
    now()
  );

  revision_id := v_revision_id;
  revision_label := v_revision_label;
  return next;
end;
$function$;

revoke execute on function public.publish_pfmea_revision_with_history(uuid, text, uuid, text, integer, numeric) from public, anon;
grant execute on function public.publish_pfmea_revision_with_history(uuid, text, uuid, text, integer, numeric) to authenticated, service_role;
