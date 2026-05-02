-- Risk Matrix system defaults
-- Allows the global admin to store default manual matrix cells separately from
-- organization-specific overrides. Configuration defaults remain stored in
-- risk_matrix_config.id = 1 for compatibility with existing PFMEA/Projects reads.

alter table if exists public.risk_matrix_config
  add column if not exists project_id uuid null;

update public.risk_matrix_config
set project_id = '00000000-0000-0000-0000-000000000000'::uuid
where id = 1
  and project_id is null;

create unique index if not exists risk_matrix_config_project_default_unique
  on public.risk_matrix_config (project_id)
  where project_id is not null;

alter table if exists public.risk_matrix_cells
  add column if not exists project_id uuid null;

create unique index if not exists risk_matrix_cells_project_default_unique
  on public.risk_matrix_cells (project_id, severity, do_value)
  where project_id is not null;

create index if not exists risk_matrix_cells_project_default_lookup
  on public.risk_matrix_cells (project_id)
  where project_id is not null;

drop policy if exists "risk_matrix_config_system_default_select" on public.risk_matrix_config;
create policy "risk_matrix_config_system_default_select"
  on public.risk_matrix_config
  for select
  to authenticated
  using (id = 1);

drop policy if exists "risk_matrix_cells_system_default_select" on public.risk_matrix_cells;
create policy "risk_matrix_cells_system_default_select"
  on public.risk_matrix_cells
  for select
  to authenticated
  using (project_id = '00000000-0000-0000-0000-000000000000'::uuid);
