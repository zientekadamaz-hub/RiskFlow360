begin;

set local statement_timeout = '60s';

create temp table cleanup_project_ids on commit drop as
select id from public.projects;

create temp table cleanup_revision_ids on commit drop as
select id
from public.process_revisions
where project_id in (select id from cleanup_project_ids);

create temp table cleanup_operation_ids on commit drop as
select id
from public.operations
where project_id in (select id from cleanup_project_ids);

create temp table cleanup_pfmea_row_ids on commit drop as
select id
from public.pfmea_rows
where revision_id in (select id from cleanup_revision_ids)
   or operation_id in (select id from cleanup_operation_ids);

create temp table cleanup_pfd_node_ids on commit drop as
select id
from public.pfd_nodes
where revision_id in (select id from cleanup_revision_ids)
   or operation_id in (select id from cleanup_operation_ids);

update public.projects
set current_open_revision_id = null,
    current_draft_revision_id = null
where id in (select id from cleanup_project_ids);

update public.process_revisions
set based_on_revision_id = null
where id in (select id from cleanup_revision_ids)
   or based_on_revision_id in (select id from cleanup_revision_ids);

delete from public.pfd_edges
where revision_id in (select id from cleanup_revision_ids)
   or source_node_id in (select id from cleanup_pfd_node_ids)
   or target_node_id in (select id from cleanup_pfd_node_ids);

delete from public.control_plan_rows
where revision_id in (select id from cleanup_revision_ids)
   or operation_id in (select id from cleanup_operation_ids)
   or pfmea_row_id in (select id from cleanup_pfmea_row_ids);

delete from public.pfd_nodes
where id in (select id from cleanup_pfd_node_ids);

delete from public.pfd_diagrams
where project_id in (select id from cleanup_project_ids);

delete from public.pfd_drafts
where project_id in (select id from cleanup_project_ids);

delete from public.pfd_session_events
where project_id in (select id from cleanup_project_ids);

delete from public.pfd_edit_sessions
where project_id in (select id from cleanup_project_ids);

delete from public.pfd_change_history
where project_id in (select id from cleanup_project_ids);

delete from public.pfmea_edit_sessions
where project_id in (select id from cleanup_project_ids);

delete from public.pfmea_change_history
where project_id in (select id from cleanup_project_ids);

delete from public.pcp_edit_sessions
where project_id in (select id from cleanup_project_ids);

delete from public.pcp_change_history
where project_id in (select id from cleanup_project_ids);

delete from public.customer_access_grants
where project_id in (select id from cleanup_project_ids);

delete from public.pfmea_rows
where id in (select id from cleanup_pfmea_row_ids);

delete from public.process_revisions
where id in (select id from cleanup_revision_ids);

delete from public.operations
where id in (select id from cleanup_operation_ids);

delete from public.projects
where id in (select id from cleanup_project_ids);

commit;
