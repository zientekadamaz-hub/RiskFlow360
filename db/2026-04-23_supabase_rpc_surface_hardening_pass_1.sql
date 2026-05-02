-- RPC / policy hardening pass 1
-- Fixes:
-- 1. rating override writes were allowed for any org member
-- 2. risk-matrix policies used legacy helper without global admin support

drop policy if exists "severity_overrides_read" on public.severity_overrides;
create policy "severity_overrides_read"
  on public.severity_overrides
  for select
  to authenticated
  using (
    public.is_org_admin_or_champion_v2(organization_id)
    or exists (
      select 1
      from public.organization_members m
      where m.organization_id = severity_overrides.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "severity_overrides_insert" on public.severity_overrides;
create policy "severity_overrides_insert"
  on public.severity_overrides
  for insert
  to authenticated
  with check (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "severity_overrides_update" on public.severity_overrides;
create policy "severity_overrides_update"
  on public.severity_overrides
  for update
  to authenticated
  using (public.is_org_admin_or_champion_v2(organization_id))
  with check (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "severity_overrides_delete" on public.severity_overrides;
create policy "severity_overrides_delete"
  on public.severity_overrides
  for delete
  to authenticated
  using (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "occurrence_overrides_read" on public.occurrence_overrides;
create policy "occurrence_overrides_read"
  on public.occurrence_overrides
  for select
  to authenticated
  using (
    public.is_org_admin_or_champion_v2(organization_id)
    or exists (
      select 1
      from public.organization_members m
      where m.organization_id = occurrence_overrides.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "occurrence_overrides_insert" on public.occurrence_overrides;
create policy "occurrence_overrides_insert"
  on public.occurrence_overrides
  for insert
  to authenticated
  with check (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "occurrence_overrides_update" on public.occurrence_overrides;
create policy "occurrence_overrides_update"
  on public.occurrence_overrides
  for update
  to authenticated
  using (public.is_org_admin_or_champion_v2(organization_id))
  with check (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "occurrence_overrides_delete" on public.occurrence_overrides;
create policy "occurrence_overrides_delete"
  on public.occurrence_overrides
  for delete
  to authenticated
  using (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "detection_overrides_read" on public.detection_overrides;
create policy "detection_overrides_read"
  on public.detection_overrides
  for select
  to authenticated
  using (
    public.is_org_admin_or_champion_v2(organization_id)
    or exists (
      select 1
      from public.organization_members m
      where m.organization_id = detection_overrides.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "detection_overrides_insert" on public.detection_overrides;
create policy "detection_overrides_insert"
  on public.detection_overrides
  for insert
  to authenticated
  with check (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "detection_overrides_update" on public.detection_overrides;
create policy "detection_overrides_update"
  on public.detection_overrides
  for update
  to authenticated
  using (public.is_org_admin_or_champion_v2(organization_id))
  with check (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "detection_overrides_delete" on public.detection_overrides;
create policy "detection_overrides_delete"
  on public.detection_overrides
  for delete
  to authenticated
  using (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "risk_matrix_config_select" on public.risk_matrix_config;
create policy "risk_matrix_config_select"
  on public.risk_matrix_config
  for select
  to authenticated
  using (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "risk_matrix_config_insert" on public.risk_matrix_config;
create policy "risk_matrix_config_insert"
  on public.risk_matrix_config
  for insert
  to authenticated
  with check (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "risk_matrix_config_update" on public.risk_matrix_config;
create policy "risk_matrix_config_update"
  on public.risk_matrix_config
  for update
  to authenticated
  using (public.is_org_admin_or_champion_v2(organization_id))
  with check (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "risk_matrix_config_delete" on public.risk_matrix_config;
create policy "risk_matrix_config_delete"
  on public.risk_matrix_config
  for delete
  to authenticated
  using (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "risk_matrix_cells_select" on public.risk_matrix_cells;
create policy "risk_matrix_cells_select"
  on public.risk_matrix_cells
  for select
  to authenticated
  using (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "risk_matrix_cells_insert" on public.risk_matrix_cells;
create policy "risk_matrix_cells_insert"
  on public.risk_matrix_cells
  for insert
  to authenticated
  with check (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "risk_matrix_cells_update" on public.risk_matrix_cells;
create policy "risk_matrix_cells_update"
  on public.risk_matrix_cells
  for update
  to authenticated
  using (public.is_org_admin_or_champion_v2(organization_id))
  with check (public.is_org_admin_or_champion_v2(organization_id));

drop policy if exists "risk_matrix_cells_delete" on public.risk_matrix_cells;
create policy "risk_matrix_cells_delete"
  on public.risk_matrix_cells
  for delete
  to authenticated
  using (public.is_org_admin_or_champion_v2(organization_id));

revoke execute on function public.is_org_admin_or_champion(uuid) from authenticated;
