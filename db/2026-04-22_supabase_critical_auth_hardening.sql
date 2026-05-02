-- Critical Supabase authorization hardening
-- Scope:
-- 1. Close public CRUD exposure on control_plan_rows
-- 2. Remove overly broad risk_matrix update policy
-- 3. Harden privileged RPC functions used by the app
-- 4. Remove unnecessary PUBLIC/anon execute from critical functions

-- ---------------------------------------------------------------------------
-- control_plan_rows: replace open-all policies with org/project-scoped rules
-- ---------------------------------------------------------------------------

revoke all on table public.control_plan_rows from anon;
revoke all on table public.control_plan_rows from authenticated;
grant select, insert, update, delete on table public.control_plan_rows to authenticated;

drop policy if exists "control_plan_rows_select_all" on public.control_plan_rows;
drop policy if exists "control_plan_rows_insert_all" on public.control_plan_rows;
drop policy if exists "control_plan_rows_update_all" on public.control_plan_rows;
drop policy if exists "control_plan_rows_delete_all" on public.control_plan_rows;

create policy "control_plan_rows_select_member"
on public.control_plan_rows
for select
to authenticated
using (
  exists (
    select 1
    from public.operations op
    join public.projects pr on pr.id = op.project_id
    join public.organization_members om on om.organization_id = pr.organization_id
    where op.id = control_plan_rows.operation_id
      and om.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "control_plan_rows_insert_editor"
on public.control_plan_rows
for insert
to authenticated
with check (
  exists (
    select 1
    from public.operations op
    join public.projects pr on pr.id = op.project_id
    join public.organization_members om on om.organization_id = pr.organization_id
    where op.id = control_plan_rows.operation_id
      and om.user_id = auth.uid()
      and om.role in ('admin', 'champion', 'engineer')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "control_plan_rows_update_editor"
on public.control_plan_rows
for update
to authenticated
using (
  exists (
    select 1
    from public.operations op
    join public.projects pr on pr.id = op.project_id
    join public.organization_members om on om.organization_id = pr.organization_id
    where op.id = control_plan_rows.operation_id
      and om.user_id = auth.uid()
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
    from public.operations op
    join public.projects pr on pr.id = op.project_id
    join public.organization_members om on om.organization_id = pr.organization_id
    where op.id = control_plan_rows.operation_id
      and om.user_id = auth.uid()
      and om.role in ('admin', 'champion', 'engineer')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "control_plan_rows_delete_editor"
on public.control_plan_rows
for delete
to authenticated
using (
  exists (
    select 1
    from public.operations op
    join public.projects pr on pr.id = op.project_id
    join public.organization_members om on om.organization_id = pr.organization_id
    where op.id = control_plan_rows.operation_id
      and om.user_id = auth.uid()
      and om.role in ('admin', 'champion', 'engineer')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- risk matrix: remove overlapping fully open authenticated update policy
-- ---------------------------------------------------------------------------

drop policy if exists "update risk matrix" on public.risk_matrix_cells;

-- ---------------------------------------------------------------------------
-- Harden RPC functions used by the client
-- ---------------------------------------------------------------------------

create or replace function public.ensure_process_draft(p_project_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor uuid := auth.uid();
  v_draft_id uuid;
  v_open_id uuid;
  v_new_draft uuid;
  v_open record;
  v_is_allowed boolean := false;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1
    from public.projects pr
    left join public.organization_members om
      on om.organization_id = pr.organization_id
     and om.user_id = v_actor
     and om.role in ('admin', 'champion', 'engineer')
    left join public.profiles p
      on p.id = v_actor
    where pr.id = p_project_id
      and (
        om.user_id is not null
        or p.global_role = 'admin'
      )
  )
  into v_is_allowed;

  if not v_is_allowed then
    raise exception 'Not allowed';
  end if;

  select current_draft_revision_id, current_open_revision_id
    into v_draft_id, v_open_id
  from public.projects
  where id = p_project_id;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_draft_id is not null then
    return v_draft_id;
  end if;

  if v_open_id is null then
    insert into public.process_revisions (
      id, project_id, pfd_rev, pfmea_rev, pcp_rev,
      revision_status, based_on_revision_id,
      change_description, created_by, created_at
    ) values (
      gen_random_uuid(), p_project_id, 0, 0, 0,
      'DRAFT', null,
      'Draft created (0.0.0)', v_actor, now()
    )
    returning id into v_new_draft;

    update public.projects
      set current_draft_revision_id = v_new_draft
    where id = p_project_id;

    return v_new_draft;
  end if;

  select pfd_rev, pfmea_rev, pcp_rev
    into v_open
  from public.process_revisions
  where id = v_open_id;

  insert into public.process_revisions (
    id, project_id, pfd_rev, pfmea_rev, pcp_rev,
    revision_status, based_on_revision_id,
    change_description, created_by, created_at
  ) values (
    gen_random_uuid(), p_project_id, v_open.pfd_rev, v_open.pfmea_rev, v_open.pcp_rev,
    'DRAFT', v_open_id,
    'Draft created from current OPEN', v_actor, now()
  )
  returning id into v_new_draft;

  update public.projects
    set current_draft_revision_id = v_new_draft
  where id = p_project_id;

  return v_new_draft;
end;
$function$;

create or replace function public.publish_process_module_revision(
  p_project_id uuid,
  p_module text,
  p_change_description text,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor uuid := auth.uid();
  v_draft_id uuid;
  v_rev record;
  v_new_status text;
  v_is_allowed boolean := false;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if p_module not in ('PFD', 'PFMEA', 'PCP') then
    raise exception 'Invalid module: %', p_module;
  end if;

  select exists (
    select 1
    from public.projects pr
    left join public.organization_members om
      on om.organization_id = pr.organization_id
     and om.user_id = v_actor
     and om.role in ('admin', 'champion', 'engineer')
    left join public.profiles p
      on p.id = v_actor
    where pr.id = p_project_id
      and (
        om.user_id is not null
        or p.global_role = 'admin'
      )
  )
  into v_is_allowed;

  if not v_is_allowed then
    raise exception 'Not allowed';
  end if;

  v_draft_id := public.ensure_process_draft(p_project_id, v_actor);

  if p_module = 'PFD' then
    update public.process_revisions
      set pfd_rev = pfd_rev + 1
    where id = v_draft_id;
  elsif p_module = 'PFMEA' then
    update public.process_revisions
      set pfmea_rev = pfmea_rev + 1
    where id = v_draft_id;
  else
    update public.process_revisions
      set pcp_rev = pcp_rev + 1
    where id = v_draft_id;
  end if;

  update public.process_revisions
    set revision_status = 'OPEN',
        change_description = p_change_description,
        created_by = v_actor,
        created_at = now()
  where id = v_draft_id;

  update public.projects
    set current_open_revision_id = v_draft_id,
        current_draft_revision_id = null,
        updated_by = v_actor,
        updated_at = now()
  where id = p_project_id;

  select pfd_rev, pfmea_rev, pcp_rev
    into v_rev
  from public.process_revisions
  where id = v_draft_id;

  if v_rev.pfd_rev > 0 and v_rev.pfmea_rev > 0 and v_rev.pcp_rev > 0 then
    v_new_status := 'OPEN';
  else
    v_new_status := 'DRAFT';
  end if;

  update public.projects
    set status = v_new_status
  where id = p_project_id;

  return v_draft_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Critical function execute grants
-- Keep authenticated access for currently used client RPCs, remove PUBLIC/anon.
-- ---------------------------------------------------------------------------

revoke execute on function public.get_my_header() from public, anon;
grant execute on function public.get_my_header() to authenticated, service_role;

revoke execute on function public.accept_invitation() from public, anon;
grant execute on function public.accept_invitation() to authenticated, service_role;

revoke execute on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated, service_role;

revoke execute on function public.create_org_invitation(uuid, text, public.app_role) from public, anon;
grant execute on function public.create_org_invitation(uuid, text, public.app_role) to authenticated, service_role;

revoke execute on function public.set_invitation_status(uuid, text) from public, anon;
grant execute on function public.set_invitation_status(uuid, text) to authenticated, service_role;

revoke execute on function public.set_invitation_status(uuid, text, text) from public, anon;
grant execute on function public.set_invitation_status(uuid, text, text) to authenticated, service_role;

revoke execute on function public.ensure_process_draft(uuid, uuid) from public, anon;
grant execute on function public.ensure_process_draft(uuid, uuid) to authenticated, service_role;

revoke execute on function public.publish_process_module_revision(uuid, text, text, uuid) from public, anon;
grant execute on function public.publish_process_module_revision(uuid, text, text, uuid) to authenticated, service_role;

revoke execute on function public.is_org_admin_or_champion_v2(uuid) from public, anon;
grant execute on function public.is_org_admin_or_champion_v2(uuid) to authenticated, service_role;
