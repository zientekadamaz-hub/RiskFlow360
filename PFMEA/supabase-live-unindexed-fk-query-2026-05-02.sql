with fk as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    con.conname as constraint_name,
    con.conkey as key_attnums
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and con.contype = 'f'
    and con.conname in (
      'control_plan_rows_pfmea_row_id_fkey',
      'control_plan_rows_revision_id_fkey',
      'customer_access_grants_created_by_fkey',
      'customer_access_grants_project_id_fkey',
      'organization_invitations_invited_by_fkey',
      'pcp_change_history_author_id_fkey',
      'pcp_edit_sessions_locked_by_fkey',
      'pfd_change_history_author_id_fkey',
      'pfd_drafts_user_id_fkey',
      'pfd_edges_revision_id_fkey',
      'pfd_edit_sessions_locked_by_fkey',
      'pfd_nodes_revision_id_fkey',
      'pfd_session_events_user_id_fkey',
      'pfmea_change_history_author_id_fkey',
      'pfmea_edit_sessions_locked_by_fkey',
      'pfmea_rows_revision_id_fkey',
      'process_revisions_based_on_fk',
      'process_revisions_project_id_fkey',
      'projects_current_draft_rev_fk',
      'projects_current_open_rev_fk'
    )
)
select
  fk.schema_name,
  fk.table_name,
  fk.constraint_name,
  array_agg(a.attname order by ord.ordinality) as columns
from fk
join unnest(fk.key_attnums) with ordinality as ord(attnum, ordinality) on true
join pg_attribute a on a.attrelid = (quote_ident(fk.schema_name) || '.' || quote_ident(fk.table_name))::regclass
  and a.attnum = ord.attnum
group by fk.schema_name, fk.table_name, fk.constraint_name
order by fk.table_name, fk.constraint_name;
