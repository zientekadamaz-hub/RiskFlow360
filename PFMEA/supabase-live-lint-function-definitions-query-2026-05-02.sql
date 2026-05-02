select
  p.oid::regprocedure::text as signature,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'ensure_process_draft',
    'publish_process_module_revision',
    'admin_create_organization_with_champion',
    'create_process_revision_and_tag_changes'
  )
order by signature;
