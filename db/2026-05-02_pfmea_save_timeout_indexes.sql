-- Manual mirror of supabase/migrations/20260502113000_pfmea_save_timeout_indexes.sql
-- Keep `supabase/migrations/` as the canonical deployment source.

create index if not exists idx_pfmea_rows_operation_id
  on public.pfmea_rows (operation_id);

create index if not exists idx_pfmea_rows_revision_operation
  on public.pfmea_rows (revision_id, operation_id);

create index if not exists idx_pfmea_rows_revision_created_id
  on public.pfmea_rows (revision_id, created_at, id);

create index if not exists idx_operations_project_active_number
  on public.operations (project_id, active, operation_number, id);
