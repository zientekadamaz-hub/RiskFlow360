select
  p.oid::regprocedure::text as signature,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute,
  has_function_privilege('public', p.oid, 'execute') as public_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'activate_invited_user',
    'get_invitation_preview',
    'submit_access_request',
    'accept_invitation',
    'get_my_header',
    'admin_create_organization_with_champion',
    'admin_list_access_requests',
    'admin_list_organizations',
    'admin_set_access_request_status',
    'create_org_invitation',
    'set_invitation_status',
    'set_org_member_role'
  )
order by signature;
