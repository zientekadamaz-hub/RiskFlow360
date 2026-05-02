select
  n.nspname as schema_name,
  c.relname as table_name,
  c.reltuples::bigint as estimated_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'control_plan_rows',
    'customer_access_grants',
    'organization_invitations',
    'pcp_change_history',
    'pcp_edit_sessions',
    'pfd_change_history',
    'pfd_drafts',
    'pfd_edges',
    'pfd_edit_sessions',
    'pfd_nodes',
    'pfd_session_events',
    'pfmea_change_history',
    'pfmea_edit_sessions',
    'pfmea_rows',
    'process_revisions',
    'projects'
  )
order by pg_total_relation_size(c.oid) desc, c.relname;
