-- Deprecated: PFMEA row backup storage
-- The application no longer uses `public.pfmea_row_backups`.
-- Do not create this table in new environments.
-- Historical context:
-- - earlier versions attempted to persist a safety snapshot before PFMEA publish
-- - the current app now relies on active integrity checks and row restore logic instead
-- If snapshot persistence is reintroduced in the future, create a new migration
-- with a fresh schema and scoped RLS, rather than reviving this file.

do $$
begin
  raise notice 'Deprecated script: public.pfmea_row_backups is no longer part of the active schema contract.';
end
$$;
