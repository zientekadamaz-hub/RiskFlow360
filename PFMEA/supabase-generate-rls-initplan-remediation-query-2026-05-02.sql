with target_policies as (
  select
    p.schemaname,
    p.tablename,
    p.policyname,
    p.permissive,
    p.roles,
    p.cmd,
    p.qual,
    p.with_check
  from pg_policies p
  where p.schemaname = 'public'
    and exists (
      select 1
      from (
        values
          ('process_revisions','process_revisions_select'),
          ('projects','projects_insert'),
          ('projects','projects_update'),
          ('projects','projects_delete'),
          ('organizations','organizations_select'),
          ('severity_overrides','severity_overrides_read'),
          ('control_plan_rows','control_plan_rows_insert_editor'),
          ('control_plan_rows','control_plan_rows_update_editor'),
          ('control_plan_rows','control_plan_rows_delete_editor'),
          ('organizations','organizations_insert'),
          ('organizations','organizations_update'),
          ('organizations','organizations_delete'),
          ('occurrence_overrides','occurrence_overrides_read'),
          ('access_requests','access_requests_select_admin'),
          ('access_requests','access_requests_update_admin'),
          ('pfd_change_history','pfd_change_history_insert_editor'),
          ('pfmea_change_history','pfmea_change_history_insert_editor'),
          ('pcp_change_history','pcp_change_history_insert_editor'),
          ('pfd_edit_sessions','pfd_edit_sessions_select_member'),
          ('pfd_edit_sessions','pfd_edit_sessions_insert_editor'),
          ('pfd_edit_sessions','pfd_edit_sessions_update_editor'),
          ('pfd_edit_sessions','pfd_edit_sessions_delete_editor'),
          ('pfmea_edit_sessions','pfmea_edit_sessions_select_member'),
          ('pfmea_edit_sessions','pfmea_edit_sessions_insert_editor'),
          ('pfmea_edit_sessions','pfmea_edit_sessions_update_editor'),
          ('pfmea_edit_sessions','pfmea_edit_sessions_delete_editor'),
          ('detection_overrides','detection_overrides_read'),
          ('organization_invitations','org_invites_select_org'),
          ('pfd_diagrams','pfd_diagrams_delete'),
          ('pfd_diagrams','pfd_diagrams_insert'),
          ('pfd_diagrams','pfd_diagrams_update'),
          ('pfd_diagrams','pfd_diagrams_select'),
          ('pcp_edit_sessions','pcp_edit_sessions_select_member'),
          ('pcp_edit_sessions','pcp_edit_sessions_insert_editor'),
          ('pcp_edit_sessions','pcp_edit_sessions_update_editor'),
          ('pcp_edit_sessions','pcp_edit_sessions_delete_editor'),
          ('pfd_drafts','pfd_drafts_select_allowed'),
          ('pfd_drafts','pfd_drafts_insert_own_editor'),
          ('pfd_drafts','pfd_drafts_update_own_editor'),
          ('pfd_drafts','pfd_drafts_delete_allowed'),
          ('pfd_session_events','pfd_session_events_select_recipient'),
          ('pfd_session_events','pfd_session_events_insert_editor'),
          ('pfd_session_events','pfd_session_events_update_recipient'),
          ('profiles','profiles_select_own'),
          ('profiles','profiles_update_own'),
          ('organization_members','organization_members_select'),
          ('operations','operations_delete'),
          ('operations','operations_insert'),
          ('operations','operations_update'),
          ('pfd_edges','pfd_edges_delete2'),
          ('pfd_edges','pfd_edges_insert2'),
          ('pfd_edges','pfd_edges_select'),
          ('pfd_edges','pfd_edges_update2'),
          ('pfd_nodes','pfd_nodes_delete'),
          ('pfd_nodes','pfd_nodes_insert'),
          ('pfd_nodes','pfd_nodes_select'),
          ('pfd_nodes','pfd_nodes_update'),
          ('pfmea_rows','pfmea_rows_delete'),
          ('pfmea_rows','pfmea_rows_insert'),
          ('pfmea_rows','pfmea_rows_update'),
          ('process_revisions','process_revisions_insert'),
          ('customer_access_grants','customer_access_grants_select'),
          ('projects','projects_select'),
          ('operations','operations_select'),
          ('site_departments','site_departments_select'),
          ('pfmea_rows','pfmea_rows_select'),
          ('control_plan_rows','control_plan_rows_select_member'),
          ('pfd_change_history','pfd_change_history_select_member'),
          ('pfmea_change_history','pfmea_change_history_select_member'),
          ('pcp_change_history','pcp_change_history_select_member')
      ) as flagged(tablename, policyname)
      where flagged.tablename = p.tablename
        and flagged.policyname = p.policyname
    )
),
rewritten as (
  select
    *,
    replace(qual, 'auth.uid()', '(select auth.uid())') as new_qual,
    replace(with_check, 'auth.uid()', '(select auth.uid())') as new_with_check
  from target_policies
),
statements as (
  select
    format('drop policy if exists %I on %I.%I;', policyname, schemaname, tablename) || E'\n' ||
    format(
      'create policy %I on %I.%I as %s for %s to %s%s%s;',
      policyname,
      schemaname,
      tablename,
      permissive,
      cmd,
      array_to_string(array(select quote_ident(role_name) from unnest(roles) as role_name), ', '),
      case when new_qual is not null then E'\n  using (' || new_qual || ')' else '' end,
      case when new_with_check is not null then E'\n  with check (' || new_with_check || ')' else '' end
    ) as sql_statement
  from rewritten
)
select string_agg(sql_statement, E'\n\n' order by sql_statement) as remediation_sql
from statements;
