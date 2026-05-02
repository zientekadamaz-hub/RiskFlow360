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

  if p_user_id is not null and p_user_id <> v_actor then
    raise exception 'User mismatch';
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

  if p_user_id is not null and p_user_id <> v_actor then
    raise exception 'User mismatch';
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
    on conflict on constraint organization_members_user_org_unique
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

create or replace function public.create_process_revision_and_tag_changes(
  p_process_id uuid,
  p_change_description text,
  p_changed_pfd boolean default false,
  p_changed_pfmea boolean default false,
  p_changed_pcp boolean default false,
  p_pfmea_row_ids uuid[] default '{}'::uuid[],
  p_pcp_row_ids uuid[] default '{}'::uuid[],
  p_pfd_node_ids uuid[] default '{}'::uuid[],
  p_pfd_edge_ids uuid[] default '{}'::uuid[]
)
returns table(revision_id uuid, revision_label text, pfd_rev integer, pfmea_rev integer, pcp_rev integer)
language plpgsql
security definer
set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_prev record;
  v_new_pfd integer;
  v_new_pfmea integer;
  v_new_pcp integer;
  v_new_rev_id uuid;
begin
  if p_change_description is null or length(trim(p_change_description)) = 0 then
    raise exception 'change_description is required';
  end if;

  if not public.can_edit() then
    raise exception 'Not allowed';
  end if;

  select r.*
  into v_prev
  from public.projects pr
  left join public.process_revisions r
    on r.id = coalesce(pr.current_draft_revision_id, pr.current_open_revision_id)
  where pr.id = p_process_id;

  if not found then
    raise exception 'Process not found: %', p_process_id;
  end if;

  v_new_pfd := coalesce(v_prev.pfd_rev, 1) + case when p_changed_pfd then 1 else 0 end;
  v_new_pfmea := coalesce(v_prev.pfmea_rev, 1) + case when p_changed_pfmea then 1 else 0 end;
  v_new_pcp := coalesce(v_prev.pcp_rev, 1) + case when p_changed_pcp then 1 else 0 end;

  insert into public.process_revisions (
    project_id,
    pfd_rev, pfmea_rev, pcp_rev,
    change_description,
    created_by,
    revision_status
  )
  values (
    p_process_id,
    v_new_pfd, v_new_pfmea, v_new_pcp,
    p_change_description,
    v_actor,
    'OPEN'
  )
  returning id into v_new_rev_id;

  update public.projects
  set
    current_open_revision_id = v_new_rev_id,
    current_draft_revision_id = null,
    status = 'OPEN',
    updated_at = now(),
    updated_by = v_actor
  where id = p_process_id;

  if array_length(p_pfmea_row_ids, 1) is not null then
    update public.pfmea_rows
    set revision_id = v_new_rev_id
    where id = any(p_pfmea_row_ids);
  end if;

  if array_length(p_pcp_row_ids, 1) is not null then
    update public.control_plan_rows
    set revision_id = v_new_rev_id
    where id = any(p_pcp_row_ids);
  end if;

  if array_length(p_pfd_node_ids, 1) is not null then
    update public.pfd_nodes
    set revision_id = v_new_rev_id
    where id = any(p_pfd_node_ids);
  end if;

  if array_length(p_pfd_edge_ids, 1) is not null then
    update public.pfd_edges
    set revision_id = v_new_rev_id
    where id = any(p_pfd_edge_ids);
  end if;

  return query
  select
    v_new_rev_id,
    (v_new_pfd::text || '.' || v_new_pfmea::text || '.' || v_new_pcp::text) as revision_label,
    v_new_pfd, v_new_pfmea, v_new_pcp;
end;
$function$;
