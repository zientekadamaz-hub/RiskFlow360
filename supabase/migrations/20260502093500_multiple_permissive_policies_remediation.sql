-- Live performance remediation captured on 2026-05-02.
-- Non-destructive intent: collapse equivalent SELECT access into single permissive policies.

drop policy if exists org_invites_select on public.organization_invitations;

drop policy if exists risk_matrix_cells_select on public.risk_matrix_cells;
drop policy if exists risk_matrix_cells_system_default_select on public.risk_matrix_cells;
create policy risk_matrix_cells_select
  on public.risk_matrix_cells
  as permissive
  for select
  to authenticated
  using (
    is_org_admin_or_champion_v2(organization_id)
    or project_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

drop policy if exists risk_matrix_config_select on public.risk_matrix_config;
drop policy if exists risk_matrix_config_system_default_select on public.risk_matrix_config;
create policy risk_matrix_config_select
  on public.risk_matrix_config
  as permissive
  for select
  to authenticated
  using (
    is_org_admin_or_champion_v2(organization_id)
    or id = 1
  );
