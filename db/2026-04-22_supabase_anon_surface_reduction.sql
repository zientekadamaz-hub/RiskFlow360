-- Supabase anonymous/public surface reduction
-- Goal:
-- 1. Remove anonymous table access across public schema
-- 2. Preserve only the one known public path: access request submission
-- 3. Remove PUBLIC/anon function execute on public schema
-- 4. Keep authenticated/service_role compatibility for current app flows

-- ---------------------------------------------------------------------------
-- Tables / views in public schema
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;

-- Keep the public access-request path working.
grant insert on table public.access_requests to anon;

-- Tighten authenticated table access for access_requests to match current intent.
revoke all on table public.access_requests from authenticated;
grant insert, select, update on table public.access_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Functions in public schema
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- Preserve compatibility for the authenticated app and backend/service flows.
grant execute on all functions in schema public to authenticated;
grant execute on all functions in schema public to service_role;
