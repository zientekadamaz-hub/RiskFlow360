-- Live performance remediation captured on 2026-05-02.
-- Non-destructive intent: recreate equivalent RLS policies with auth.uid() wrapped as (select auth.uid()).
-- Generated from live pg_policies metadata after manual review of policy scope.

drop policy if exists access_requests_select_admin on public.access_requests;
create policy access_requests_select_admin on public.access_requests as PERMISSIVE for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))));

drop policy if exists access_requests_update_admin on public.access_requests;
create policy access_requests_update_admin on public.access_requests as PERMISSIVE for UPDATE to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))));

drop policy if exists control_plan_rows_delete_editor on public.control_plan_rows;
create policy control_plan_rows_delete_editor on public.control_plan_rows as PERMISSIVE for DELETE to authenticated
  using (((EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = control_plan_rows.operation_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists control_plan_rows_insert_editor on public.control_plan_rows;
create policy control_plan_rows_insert_editor on public.control_plan_rows as PERMISSIVE for INSERT to authenticated
  with check (((EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = control_plan_rows.operation_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists control_plan_rows_select_member on public.control_plan_rows;
create policy control_plan_rows_select_member on public.control_plan_rows as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = control_plan_rows.operation_id) AND (om.user_id = (select auth.uid())) AND (om.role <> 'customer'::app_role)))) OR (EXISTS ( SELECT 1
   FROM (operations op
     JOIN customer_access_grants cag ON ((cag.project_id = op.project_id)))
  WHERE ((op.id = control_plan_rows.operation_id) AND (cag.customer_user_id = (select auth.uid())) AND cag.active AND (cag.module = 'PCP'::text))))));

drop policy if exists control_plan_rows_update_editor on public.control_plan_rows;
create policy control_plan_rows_update_editor on public.control_plan_rows as PERMISSIVE for UPDATE to authenticated
  using (((EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = control_plan_rows.operation_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))))
  with check (((EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = control_plan_rows.operation_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists customer_access_grants_select on public.customer_access_grants;
create policy customer_access_grants_select on public.customer_access_grants as PERMISSIVE for SELECT to authenticated
  using (((customer_user_id = (select auth.uid())) OR is_org_admin_or_champion_v2(organization_id)));

drop policy if exists detection_overrides_read on public.detection_overrides;
create policy detection_overrides_read on public.detection_overrides as PERMISSIVE for SELECT to authenticated
  using ((is_org_admin_or_champion_v2(organization_id) OR (EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = detection_overrides.organization_id) AND (m.user_id = (select auth.uid())))))));

drop policy if exists occurrence_overrides_read on public.occurrence_overrides;
create policy occurrence_overrides_read on public.occurrence_overrides as PERMISSIVE for SELECT to authenticated
  using ((is_org_admin_or_champion_v2(organization_id) OR (EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = occurrence_overrides.organization_id) AND (m.user_id = (select auth.uid())))))));

drop policy if exists operations_delete on public.operations;
create policy operations_delete on public.operations as PERMISSIVE for DELETE to authenticated
  using (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = operations.project_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists operations_insert on public.operations;
create policy operations_insert on public.operations as PERMISSIVE for INSERT to authenticated
  with check (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = operations.project_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists operations_select on public.operations;
create policy operations_select on public.operations as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = operations.project_id) AND (om.user_id = (select auth.uid())) AND (om.role <> 'customer'::app_role)))) OR (EXISTS ( SELECT 1
   FROM customer_access_grants cag
  WHERE ((cag.project_id = operations.project_id) AND (cag.customer_user_id = (select auth.uid())) AND cag.active)))));

drop policy if exists operations_update on public.operations;
create policy operations_update on public.operations as PERMISSIVE for UPDATE to authenticated
  using (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = operations.project_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))))
  with check (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = operations.project_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists org_invites_select_org on public.organization_invitations;
create policy org_invites_select_org on public.organization_invitations as PERMISSIVE for SELECT to authenticated
  using ((is_org_admin_or_champion_v2(organization_id) OR (email = ( SELECT p.email
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))));

drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members as PERMISSIVE for SELECT to authenticated
  using (((user_id = (select auth.uid())) OR is_org_admin_or_champion_v2(organization_id)));

drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete on public.organizations as PERMISSIVE for DELETE to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))));

drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert on public.organizations as PERMISSIVE for INSERT to authenticated
  with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))));

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.organization_id = organizations.id) AND (om.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations as PERMISSIVE for UPDATE to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))));

drop policy if exists pcp_change_history_insert_editor on public.pcp_change_history;
create policy pcp_change_history_insert_editor on public.pcp_change_history as PERMISSIVE for INSERT to authenticated
  with check (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pcp_change_history.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pcp_change_history_select_member on public.pcp_change_history;
create policy pcp_change_history_select_member on public.pcp_change_history as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pcp_change_history.project_id) AND (om.user_id = (select auth.uid())) AND (om.role <> 'customer'::app_role)))) OR (EXISTS ( SELECT 1
   FROM customer_access_grants cag
  WHERE ((cag.project_id = pcp_change_history.project_id) AND (cag.customer_user_id = (select auth.uid())) AND cag.active AND (cag.module = 'PCP'::text))))));

drop policy if exists pcp_edit_sessions_delete_editor on public.pcp_edit_sessions;
create policy pcp_edit_sessions_delete_editor on public.pcp_edit_sessions as PERMISSIVE for DELETE to authenticated
  using ((((locked_by = (select auth.uid())) OR (last_activity_at < (now() - '48:00:00'::interval)) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pcp_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pcp_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))));

drop policy if exists pcp_edit_sessions_insert_editor on public.pcp_edit_sessions;
create policy pcp_edit_sessions_insert_editor on public.pcp_edit_sessions as PERMISSIVE for INSERT to authenticated
  with check (((locked_by = (select auth.uid())) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pcp_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))));

drop policy if exists pcp_edit_sessions_select_member on public.pcp_edit_sessions;
create policy pcp_edit_sessions_select_member on public.pcp_edit_sessions as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pcp_edit_sessions.project_id) AND (om.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pcp_edit_sessions_update_editor on public.pcp_edit_sessions;
create policy pcp_edit_sessions_update_editor on public.pcp_edit_sessions as PERMISSIVE for UPDATE to authenticated
  using ((((locked_by = (select auth.uid())) OR (last_activity_at < (now() - '48:00:00'::interval)) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pcp_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pcp_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))))
  with check (((locked_by = (select auth.uid())) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pcp_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))));

drop policy if exists pfd_change_history_insert_editor on public.pfd_change_history;
create policy pfd_change_history_insert_editor on public.pfd_change_history as PERMISSIVE for INSERT to authenticated
  with check (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_change_history.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_change_history_select_member on public.pfd_change_history;
create policy pfd_change_history_select_member on public.pfd_change_history as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_change_history.project_id) AND (om.user_id = (select auth.uid())) AND (om.role <> 'customer'::app_role)))) OR (EXISTS ( SELECT 1
   FROM customer_access_grants cag
  WHERE ((cag.project_id = pfd_change_history.project_id) AND (cag.customer_user_id = (select auth.uid())) AND cag.active AND (cag.module = 'PFD'::text))))));

drop policy if exists pfd_diagrams_delete on public.pfd_diagrams;
create policy pfd_diagrams_delete on public.pfd_diagrams as PERMISSIVE for DELETE to authenticated
  using (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_diagrams.project_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_diagrams_insert on public.pfd_diagrams;
create policy pfd_diagrams_insert on public.pfd_diagrams as PERMISSIVE for INSERT to authenticated
  with check (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_diagrams.project_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_diagrams_select on public.pfd_diagrams;
create policy pfd_diagrams_select on public.pfd_diagrams as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_diagrams.project_id) AND (om.user_id = (select auth.uid())) AND (om.role <> 'customer'::app_role)))) OR (EXISTS ( SELECT 1
   FROM customer_access_grants cag
  WHERE ((cag.project_id = pfd_diagrams.project_id) AND (cag.customer_user_id = (select auth.uid())) AND cag.active AND (cag.module = 'PFD'::text))))));

drop policy if exists pfd_diagrams_update on public.pfd_diagrams;
create policy pfd_diagrams_update on public.pfd_diagrams as PERMISSIVE for UPDATE to authenticated
  using (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_diagrams.project_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))))
  with check (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_diagrams.project_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_drafts_delete_allowed on public.pfd_drafts;
create policy pfd_drafts_delete_allowed on public.pfd_drafts as PERMISSIVE for DELETE to authenticated
  using ((((user_id = (select auth.uid())) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_drafts.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_drafts.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))) OR ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_drafts.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) AND (EXISTS ( SELECT 1
   FROM pfd_edit_sessions s
  WHERE ((s.project_id = pfd_drafts.project_id) AND (s.locked_by = pfd_drafts.user_id) AND (s.last_activity_at < (now() - '48:00:00'::interval))))))));

drop policy if exists pfd_drafts_insert_own_editor on public.pfd_drafts;
create policy pfd_drafts_insert_own_editor on public.pfd_drafts as PERMISSIVE for INSERT to authenticated
  with check (((user_id = (select auth.uid())) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_drafts.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))));

drop policy if exists pfd_drafts_select_allowed on public.pfd_drafts;
create policy pfd_drafts_select_allowed on public.pfd_drafts as PERMISSIVE for SELECT to authenticated
  using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_drafts.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_drafts_update_own_editor on public.pfd_drafts;
create policy pfd_drafts_update_own_editor on public.pfd_drafts as PERMISSIVE for UPDATE to authenticated
  using (((user_id = (select auth.uid())) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_drafts.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))))
  with check (((user_id = (select auth.uid())) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_drafts.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))));

drop policy if exists pfd_edges_delete2 on public.pfd_edges;
create policy pfd_edges_delete2 on public.pfd_edges as PERMISSIVE for DELETE to authenticated
  using (((EXISTS ( SELECT 1
   FROM (((pfd_nodes n
     JOIN operations op ON ((op.id = n.operation_id)))
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((n.id = pfd_edges.source_node_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_edges_insert2 on public.pfd_edges;
create policy pfd_edges_insert2 on public.pfd_edges as PERMISSIVE for INSERT to authenticated
  with check (((EXISTS ( SELECT 1
   FROM (((pfd_nodes n
     JOIN operations op ON ((op.id = n.operation_id)))
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((n.id = pfd_edges.source_node_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_edges_select on public.pfd_edges;
create policy pfd_edges_select on public.pfd_edges as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM (((pfd_nodes n
     JOIN operations op ON ((op.id = n.operation_id)))
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((n.id = pfd_edges.source_node_id) AND (om.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_edges_update2 on public.pfd_edges;
create policy pfd_edges_update2 on public.pfd_edges as PERMISSIVE for UPDATE to authenticated
  using (((EXISTS ( SELECT 1
   FROM (((pfd_nodes n
     JOIN operations op ON ((op.id = n.operation_id)))
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((n.id = pfd_edges.source_node_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))))
  with check (((EXISTS ( SELECT 1
   FROM (((pfd_nodes n
     JOIN operations op ON ((op.id = n.operation_id)))
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((n.id = pfd_edges.source_node_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_edit_sessions_delete_editor on public.pfd_edit_sessions;
create policy pfd_edit_sessions_delete_editor on public.pfd_edit_sessions as PERMISSIVE for DELETE to authenticated
  using ((((locked_by = (select auth.uid())) OR (last_activity_at < (now() - '48:00:00'::interval)) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))));

drop policy if exists pfd_edit_sessions_insert_editor on public.pfd_edit_sessions;
create policy pfd_edit_sessions_insert_editor on public.pfd_edit_sessions as PERMISSIVE for INSERT to authenticated
  with check (((locked_by = (select auth.uid())) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))));

drop policy if exists pfd_edit_sessions_select_member on public.pfd_edit_sessions;
create policy pfd_edit_sessions_select_member on public.pfd_edit_sessions as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_edit_sessions.project_id) AND (om.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_edit_sessions_update_editor on public.pfd_edit_sessions;
create policy pfd_edit_sessions_update_editor on public.pfd_edit_sessions as PERMISSIVE for UPDATE to authenticated
  using ((((locked_by = (select auth.uid())) OR (last_activity_at < (now() - '48:00:00'::interval)) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))))
  with check (((locked_by = (select auth.uid())) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))));

drop policy if exists pfd_nodes_delete on public.pfd_nodes;
create policy pfd_nodes_delete on public.pfd_nodes as PERMISSIVE for DELETE to authenticated
  using (((EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = pfd_nodes.operation_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_nodes_insert on public.pfd_nodes;
create policy pfd_nodes_insert on public.pfd_nodes as PERMISSIVE for INSERT to authenticated
  with check (((EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = pfd_nodes.operation_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_nodes_select on public.pfd_nodes;
create policy pfd_nodes_select on public.pfd_nodes as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = pfd_nodes.operation_id) AND (om.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_nodes_update on public.pfd_nodes;
create policy pfd_nodes_update on public.pfd_nodes as PERMISSIVE for UPDATE to authenticated
  using (((EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = pfd_nodes.operation_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))))
  with check (((EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = pfd_nodes.operation_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_session_events_insert_editor on public.pfd_session_events;
create policy pfd_session_events_insert_editor on public.pfd_session_events as PERMISSIVE for INSERT to authenticated
  with check (((EXISTS ( SELECT 1
   FROM ((projects pr
     JOIN organization_members actor ON ((actor.organization_id = pr.organization_id)))
     JOIN organization_members recipient ON ((recipient.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfd_session_events.project_id) AND (actor.user_id = (select auth.uid())) AND (actor.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role])) AND (recipient.user_id = pfd_session_events.user_id)))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_session_events_select_recipient on public.pfd_session_events;
create policy pfd_session_events_select_recipient on public.pfd_session_events as PERMISSIVE for SELECT to authenticated
  using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfd_session_events_update_recipient on public.pfd_session_events;
create policy pfd_session_events_update_recipient on public.pfd_session_events as PERMISSIVE for UPDATE to authenticated
  using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))))
  with check (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfmea_change_history_insert_editor on public.pfmea_change_history;
create policy pfmea_change_history_insert_editor on public.pfmea_change_history as PERMISSIVE for INSERT to authenticated
  with check (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfmea_change_history.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfmea_change_history_select_member on public.pfmea_change_history;
create policy pfmea_change_history_select_member on public.pfmea_change_history as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfmea_change_history.project_id) AND (om.user_id = (select auth.uid())) AND (om.role <> 'customer'::app_role)))) OR (EXISTS ( SELECT 1
   FROM customer_access_grants cag
  WHERE ((cag.project_id = pfmea_change_history.project_id) AND (cag.customer_user_id = (select auth.uid())) AND cag.active AND (cag.module = 'PFMEA'::text))))));

drop policy if exists pfmea_edit_sessions_delete_editor on public.pfmea_edit_sessions;
create policy pfmea_edit_sessions_delete_editor on public.pfmea_edit_sessions as PERMISSIVE for DELETE to authenticated
  using ((((locked_by = (select auth.uid())) OR (last_activity_at < (now() - '48:00:00'::interval)) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfmea_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfmea_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))));

drop policy if exists pfmea_edit_sessions_insert_editor on public.pfmea_edit_sessions;
create policy pfmea_edit_sessions_insert_editor on public.pfmea_edit_sessions as PERMISSIVE for INSERT to authenticated
  with check (((locked_by = (select auth.uid())) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfmea_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))));

drop policy if exists pfmea_edit_sessions_select_member on public.pfmea_edit_sessions;
create policy pfmea_edit_sessions_select_member on public.pfmea_edit_sessions as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfmea_edit_sessions.project_id) AND (om.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfmea_edit_sessions_update_editor on public.pfmea_edit_sessions;
create policy pfmea_edit_sessions_update_editor on public.pfmea_edit_sessions as PERMISSIVE for UPDATE to authenticated
  using ((((locked_by = (select auth.uid())) OR (last_activity_at < (now() - '48:00:00'::interval)) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfmea_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfmea_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))))
  with check (((locked_by = (select auth.uid())) AND ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = pfmea_edit_sessions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))))));

drop policy if exists pfmea_rows_delete on public.pfmea_rows;
create policy pfmea_rows_delete on public.pfmea_rows as PERMISSIVE for DELETE to authenticated
  using (((EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = pfmea_rows.operation_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfmea_rows_insert on public.pfmea_rows;
create policy pfmea_rows_insert on public.pfmea_rows as PERMISSIVE for INSERT to authenticated
  with check (((EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = pfmea_rows.operation_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists pfmea_rows_select on public.pfmea_rows;
create policy pfmea_rows_select on public.pfmea_rows as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = pfmea_rows.operation_id) AND (om.user_id = (select auth.uid())) AND (om.role <> 'customer'::app_role)))) OR (EXISTS ( SELECT 1
   FROM (operations op
     JOIN customer_access_grants cag ON ((cag.project_id = op.project_id)))
  WHERE ((op.id = pfmea_rows.operation_id) AND (cag.customer_user_id = (select auth.uid())) AND cag.active AND (cag.module = 'PFMEA'::text))))));

drop policy if exists pfmea_rows_update on public.pfmea_rows;
create policy pfmea_rows_update on public.pfmea_rows as PERMISSIVE for UPDATE to authenticated
  using (((EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = pfmea_rows.operation_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))))
  with check (((EXISTS ( SELECT 1
   FROM ((operations op
     JOIN projects pr ON ((pr.id = op.project_id)))
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((op.id = pfmea_rows.operation_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists process_revisions_insert on public.process_revisions;
create policy process_revisions_insert on public.process_revisions as PERMISSIVE for INSERT to authenticated
  with check (((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = process_revisions.project_id) AND (om.user_id = (select auth.uid())) AND ((om.role)::text = ANY (ARRAY['champion'::text, 'engineer'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists process_revisions_select on public.process_revisions;
create policy process_revisions_select on public.process_revisions as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM (projects pr
     JOIN organization_members om ON ((om.organization_id = pr.organization_id)))
  WHERE ((pr.id = process_revisions.project_id) AND (om.user_id = (select auth.uid())) AND (om.role <> 'customer'::app_role)))) OR (EXISTS ( SELECT 1
   FROM customer_access_grants cag
  WHERE ((cag.project_id = process_revisions.project_id) AND (cag.customer_user_id = (select auth.uid())) AND cag.active)))));

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles as PERMISSIVE for SELECT to authenticated
  using ((id = (select auth.uid())));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles as PERMISSIVE for UPDATE to authenticated
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects as PERMISSIVE for DELETE to authenticated
  using (((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = (select auth.uid())) AND (om.organization_id = projects.organization_id) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects as PERMISSIVE for INSERT to authenticated
  with check (((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = (select auth.uid())) AND (om.organization_id = projects.organization_id) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = (select auth.uid())) AND (om.organization_id = projects.organization_id) AND (om.role <> 'customer'::app_role)))) OR (EXISTS ( SELECT 1
   FROM customer_access_grants cag
  WHERE ((cag.project_id = projects.id) AND (cag.customer_user_id = (select auth.uid())) AND cag.active)))));

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects as PERMISSIVE for UPDATE to authenticated
  using (((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = (select auth.uid())) AND (om.organization_id = projects.organization_id) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))))
  with check (((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_id = (select auth.uid())) AND (om.organization_id = projects.organization_id) AND (om.role = ANY (ARRAY['admin'::app_role, 'champion'::app_role, 'engineer'::app_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text))))));

drop policy if exists severity_overrides_read on public.severity_overrides;
create policy severity_overrides_read on public.severity_overrides as PERMISSIVE for SELECT to authenticated
  using ((is_org_admin_or_champion_v2(organization_id) OR (EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.organization_id = severity_overrides.organization_id) AND (m.user_id = (select auth.uid())))))));

drop policy if exists site_departments_select on public.site_departments;
create policy site_departments_select on public.site_departments as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.global_role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.organization_id = site_departments.organization_id) AND (om.user_id = (select auth.uid())) AND (om.role <> 'customer'::app_role)))) OR (EXISTS ( SELECT 1
   FROM (customer_access_grants cag
     JOIN projects pr ON ((pr.id = cag.project_id)))
  WHERE ((cag.customer_user_id = (select auth.uid())) AND cag.active AND (pr.site_department_id = site_departments.id))))));
