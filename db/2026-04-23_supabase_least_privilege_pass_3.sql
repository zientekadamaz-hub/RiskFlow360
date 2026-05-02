-- Least-privilege hardening pass 3
-- Safe scope:
-- - reduce `access_requests` to append-only for client roles
-- - reduce `organizations` to read-only for authenticated users

revoke select, update
on table public.access_requests
from authenticated;

grant insert
on table public.access_requests
to authenticated;

revoke insert, update, delete
on table public.organizations
from authenticated;

grant select
on table public.organizations
to authenticated;
