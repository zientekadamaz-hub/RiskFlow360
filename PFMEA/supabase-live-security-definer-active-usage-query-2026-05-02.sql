select
  p.oid::regprocedure::text as signature,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'accept_invitation',
    'activate_invited_user',
    'get_invitation_preview',
    'submit_access_request'
  )
order by signature;
