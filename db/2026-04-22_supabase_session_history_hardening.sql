-- Supabase session / history hardening
-- Replaces broad "(auth.uid() IS NOT NULL)" policies with project/org-scoped rules
-- for PFD / PFMEA / PCP session and history tables.

-- ---------------------------------------------------------------------------
-- PFD change history
-- ---------------------------------------------------------------------------

drop policy if exists "pfd_change_history_all_auth" on public.pfd_change_history;

create policy "pfd_change_history_select_member"
on public.pfd_change_history
for select
to authenticated
using (
  exists (
    select 1
    from public.projects pr
    join public.organization_members om on om.organization_id = pr.organization_id
    where pr.id = pfd_change_history.project_id
      and om.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "pfd_change_history_insert_editor"
on public.pfd_change_history
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects pr
    join public.organization_members om on om.organization_id = pr.organization_id
    where pr.id = pfd_change_history.project_id
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
-- PFMEA change history
-- ---------------------------------------------------------------------------

drop policy if exists "pfmea_change_history_all_auth" on public.pfmea_change_history;

create policy "pfmea_change_history_select_member"
on public.pfmea_change_history
for select
to authenticated
using (
  exists (
    select 1
    from public.projects pr
    join public.organization_members om on om.organization_id = pr.organization_id
    where pr.id = pfmea_change_history.project_id
      and om.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "pfmea_change_history_insert_editor"
on public.pfmea_change_history
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects pr
    join public.organization_members om on om.organization_id = pr.organization_id
    where pr.id = pfmea_change_history.project_id
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
-- PCP change history
-- ---------------------------------------------------------------------------

drop policy if exists "pcp_change_history_all_auth" on public.pcp_change_history;

create policy "pcp_change_history_select_member"
on public.pcp_change_history
for select
to authenticated
using (
  exists (
    select 1
    from public.projects pr
    join public.organization_members om on om.organization_id = pr.organization_id
    where pr.id = pcp_change_history.project_id
      and om.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "pcp_change_history_insert_editor"
on public.pcp_change_history
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects pr
    join public.organization_members om on om.organization_id = pr.organization_id
    where pr.id = pcp_change_history.project_id
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
-- PFD edit sessions
-- ---------------------------------------------------------------------------

drop policy if exists "pfd_edit_sessions_all_auth" on public.pfd_edit_sessions;

create policy "pfd_edit_sessions_select_member"
on public.pfd_edit_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.projects pr
    join public.organization_members om on om.organization_id = pr.organization_id
    where pr.id = pfd_edit_sessions.project_id
      and om.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "pfd_edit_sessions_insert_editor"
on public.pfd_edit_sessions
for insert
to authenticated
with check (
  locked_by = auth.uid()
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfd_edit_sessions.project_id
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
);

create policy "pfd_edit_sessions_update_editor"
on public.pfd_edit_sessions
for update
to authenticated
using (
  (
    locked_by = auth.uid()
    or last_activity_at < (now() - interval '48 hours')
    or exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfd_edit_sessions.project_id
        and om.user_id = auth.uid()
        and om.role in ('admin', 'champion')
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.global_role = 'admin'
    )
  )
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfd_edit_sessions.project_id
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
)
with check (
  locked_by = auth.uid()
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfd_edit_sessions.project_id
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
);

create policy "pfd_edit_sessions_delete_editor"
on public.pfd_edit_sessions
for delete
to authenticated
using (
  (
    locked_by = auth.uid()
    or last_activity_at < (now() - interval '48 hours')
    or exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfd_edit_sessions.project_id
        and om.user_id = auth.uid()
        and om.role in ('admin', 'champion')
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.global_role = 'admin'
    )
  )
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfd_edit_sessions.project_id
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
);

-- ---------------------------------------------------------------------------
-- PFMEA edit sessions
-- ---------------------------------------------------------------------------

drop policy if exists "pfmea_edit_sessions_all_auth" on public.pfmea_edit_sessions;

create policy "pfmea_edit_sessions_select_member"
on public.pfmea_edit_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.projects pr
    join public.organization_members om on om.organization_id = pr.organization_id
    where pr.id = pfmea_edit_sessions.project_id
      and om.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "pfmea_edit_sessions_insert_editor"
on public.pfmea_edit_sessions
for insert
to authenticated
with check (
  locked_by = auth.uid()
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfmea_edit_sessions.project_id
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
);

create policy "pfmea_edit_sessions_update_editor"
on public.pfmea_edit_sessions
for update
to authenticated
using (
  (
    locked_by = auth.uid()
    or last_activity_at < (now() - interval '48 hours')
    or exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfmea_edit_sessions.project_id
        and om.user_id = auth.uid()
        and om.role in ('admin', 'champion')
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.global_role = 'admin'
    )
  )
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfmea_edit_sessions.project_id
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
)
with check (
  locked_by = auth.uid()
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfmea_edit_sessions.project_id
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
);

create policy "pfmea_edit_sessions_delete_editor"
on public.pfmea_edit_sessions
for delete
to authenticated
using (
  (
    locked_by = auth.uid()
    or last_activity_at < (now() - interval '48 hours')
    or exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfmea_edit_sessions.project_id
        and om.user_id = auth.uid()
        and om.role in ('admin', 'champion')
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.global_role = 'admin'
    )
  )
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfmea_edit_sessions.project_id
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
);

-- ---------------------------------------------------------------------------
-- PCP edit sessions
-- ---------------------------------------------------------------------------

drop policy if exists "pcp_edit_sessions_all_auth" on public.pcp_edit_sessions;

create policy "pcp_edit_sessions_select_member"
on public.pcp_edit_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.projects pr
    join public.organization_members om on om.organization_id = pr.organization_id
    where pr.id = pcp_edit_sessions.project_id
      and om.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "pcp_edit_sessions_insert_editor"
on public.pcp_edit_sessions
for insert
to authenticated
with check (
  locked_by = auth.uid()
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pcp_edit_sessions.project_id
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
);

create policy "pcp_edit_sessions_update_editor"
on public.pcp_edit_sessions
for update
to authenticated
using (
  (
    locked_by = auth.uid()
    or last_activity_at < (now() - interval '48 hours')
    or exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pcp_edit_sessions.project_id
        and om.user_id = auth.uid()
        and om.role in ('admin', 'champion')
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.global_role = 'admin'
    )
  )
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pcp_edit_sessions.project_id
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
)
with check (
  locked_by = auth.uid()
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pcp_edit_sessions.project_id
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
);

create policy "pcp_edit_sessions_delete_editor"
on public.pcp_edit_sessions
for delete
to authenticated
using (
  (
    locked_by = auth.uid()
    or last_activity_at < (now() - interval '48 hours')
    or exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pcp_edit_sessions.project_id
        and om.user_id = auth.uid()
        and om.role in ('admin', 'champion')
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.global_role = 'admin'
    )
  )
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pcp_edit_sessions.project_id
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
);

-- ---------------------------------------------------------------------------
-- PFD drafts
-- ---------------------------------------------------------------------------

drop policy if exists "pfd_drafts_all_auth" on public.pfd_drafts;

create policy "pfd_drafts_select_allowed"
on public.pfd_drafts
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.projects pr
    join public.organization_members om on om.organization_id = pr.organization_id
    where pr.id = pfd_drafts.project_id
      and om.user_id = auth.uid()
      and om.role in ('admin', 'champion')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "pfd_drafts_insert_own_editor"
on public.pfd_drafts
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfd_drafts.project_id
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
);

create policy "pfd_drafts_update_own_editor"
on public.pfd_drafts
for update
to authenticated
using (
  user_id = auth.uid()
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfd_drafts.project_id
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
)
with check (
  user_id = auth.uid()
  and (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfd_drafts.project_id
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
);

create policy "pfd_drafts_delete_allowed"
on public.pfd_drafts
for delete
to authenticated
using (
  (
    user_id = auth.uid()
    and (
      exists (
        select 1
        from public.projects pr
        join public.organization_members om on om.organization_id = pr.organization_id
        where pr.id = pfd_drafts.project_id
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
  )
  or exists (
    select 1
    from public.projects pr
    join public.organization_members om on om.organization_id = pr.organization_id
    where pr.id = pfd_drafts.project_id
      and om.user_id = auth.uid()
      and om.role in ('admin', 'champion')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
  or (
    exists (
      select 1
      from public.projects pr
      join public.organization_members om on om.organization_id = pr.organization_id
      where pr.id = pfd_drafts.project_id
        and om.user_id = auth.uid()
        and om.role in ('admin', 'champion', 'engineer')
    )
    and exists (
      select 1
      from public.pfd_edit_sessions s
      where s.project_id = pfd_drafts.project_id
        and s.locked_by = pfd_drafts.user_id
        and s.last_activity_at < (now() - interval '48 hours')
    )
  )
);

-- ---------------------------------------------------------------------------
-- PFD session events
-- ---------------------------------------------------------------------------

drop policy if exists "pfd_session_events_all_auth" on public.pfd_session_events;

create policy "pfd_session_events_select_recipient"
on public.pfd_session_events
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "pfd_session_events_insert_editor"
on public.pfd_session_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects pr
    join public.organization_members actor on actor.organization_id = pr.organization_id
    join public.organization_members recipient on recipient.organization_id = pr.organization_id
    where pr.id = pfd_session_events.project_id
      and actor.user_id = auth.uid()
      and actor.role in ('admin', 'champion', 'engineer')
      and recipient.user_id = pfd_session_events.user_id
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);

create policy "pfd_session_events_update_recipient"
on public.pfd_session_events
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.global_role = 'admin'
  )
);
