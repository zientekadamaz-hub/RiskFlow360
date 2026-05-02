-- Live performance remediation captured on 2026-05-02.
-- Non-destructive: adds covering indexes for foreign keys reported by Supabase advisors.
-- Target tables were verified as small during live audit; regular CREATE INDEX keeps this migration transaction-compatible.

create index if not exists idx_control_plan_rows_pfmea_row_id
  on public.control_plan_rows (pfmea_row_id);

create index if not exists idx_control_plan_rows_revision_id
  on public.control_plan_rows (revision_id);

create index if not exists idx_customer_access_grants_created_by
  on public.customer_access_grants (created_by);

create index if not exists idx_customer_access_grants_project_id
  on public.customer_access_grants (project_id);

create index if not exists idx_organization_invitations_invited_by
  on public.organization_invitations (invited_by);

create index if not exists idx_pcp_change_history_author_id
  on public.pcp_change_history (author_id);

create index if not exists idx_pcp_edit_sessions_locked_by
  on public.pcp_edit_sessions (locked_by);

create index if not exists idx_pfd_change_history_author_id
  on public.pfd_change_history (author_id);

create index if not exists idx_pfd_drafts_user_id
  on public.pfd_drafts (user_id);

create index if not exists idx_pfd_edges_revision_id
  on public.pfd_edges (revision_id);

create index if not exists idx_pfd_edit_sessions_locked_by
  on public.pfd_edit_sessions (locked_by);

create index if not exists idx_pfd_nodes_revision_id
  on public.pfd_nodes (revision_id);

create index if not exists idx_pfd_session_events_user_id
  on public.pfd_session_events (user_id);

create index if not exists idx_pfmea_change_history_author_id
  on public.pfmea_change_history (author_id);

create index if not exists idx_pfmea_edit_sessions_locked_by
  on public.pfmea_edit_sessions (locked_by);

create index if not exists idx_pfmea_rows_revision_id
  on public.pfmea_rows (revision_id);

create index if not exists idx_process_revisions_based_on_revision_id
  on public.process_revisions (based_on_revision_id);

create index if not exists idx_process_revisions_project_id
  on public.process_revisions (project_id);

create index if not exists idx_projects_current_draft_revision_id
  on public.projects (current_draft_revision_id);

create index if not exists idx_projects_current_open_revision_id
  on public.projects (current_open_revision_id);
