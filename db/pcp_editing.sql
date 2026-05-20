-- PCP revision history and edit session bootstrap
-- This file defines structural objects only.
-- It intentionally does not create permissive RLS policies.
-- After running this bootstrap on a fresh environment, apply:
--   - 2026-04-22_supabase_critical_auth_hardening.sql
--   - 2026-04-22_supabase_session_history_hardening.sql
--   - 2026-04-22_supabase_invites_projects_hardening.sql
--   - 2026-04-22_supabase_anon_surface_reduction.sql

create extension if not exists pgcrypto;

alter table if exists public.control_plan_rows
  add column if not exists pfmea_row_id uuid null references public.pfmea_rows(id) on delete set null;

alter table if exists public.control_plan_rows
  add column if not exists risk_uid uuid null;

alter table if exists public.control_plan_rows
  drop constraint if exists ux_pcp_auto_per_op_characteristic;

drop index if exists public.ux_pcp_auto_per_op_characteristic;

create unique index if not exists ux_control_plan_rows_revision_risk_uid
  on public.control_plan_rows (revision_id, risk_uid)
  where risk_uid is not null;

alter table if exists public.control_plan_rows
  add column if not exists failure_mode text null;

alter table if exists public.control_plan_rows
  add column if not exists class text null;

alter table if exists public.control_plan_rows
  add column if not exists current_prevention text null;

alter table if exists public.control_plan_rows
  add column if not exists current_detection text null;

alter table if exists public.control_plan_rows
  add column if not exists sample_size text null;

create table if not exists public.pcp_change_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_label text not null default '0.0.0',
  change_description text not null default '',
  author_id uuid null references auth.users(id) on delete set null,
  author_name text not null default 'Unknown user',
  control_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.pcp_edit_sessions (
  project_id uuid primary key references public.projects(id) on delete cascade,
  locked_by uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pcp_change_history_project_created
  on public.pcp_change_history (project_id, created_at desc);

alter table public.pcp_change_history enable row level security;
alter table public.pcp_edit_sessions enable row level security;
