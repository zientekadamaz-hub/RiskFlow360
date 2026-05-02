-- PFMEA revision history and edit session bootstrap
-- This file defines structural objects only.
-- It intentionally does not create permissive RLS policies.
-- After running this bootstrap on a fresh environment, apply:
--   - 2026-04-22_supabase_critical_auth_hardening.sql
--   - 2026-04-22_supabase_session_history_hardening.sql
--   - 2026-04-22_supabase_invites_projects_hardening.sql
--   - 2026-04-22_supabase_anon_surface_reduction.sql

create extension if not exists pgcrypto;

alter table if exists public.pfmea_rows
  add column if not exists characteristic text null;

alter table if exists public.pfmea_rows
  add column if not exists pcp boolean null;

alter table if exists public.pfmea_rows
  add column if not exists row_no text null;

alter table if exists public.pfmea_rows
  add column if not exists failure_mode_group_id uuid null;

alter table if exists public.pfmea_rows
  add column if not exists failure_block_group_id uuid null;

alter table if exists public.pfmea_rows
  add column if not exists action_plan_group_id uuid null;

create table if not exists public.pfmea_change_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_label text not null default '0.0.0',
  change_description text not null default '',
  author_id uuid null references auth.users(id) on delete set null,
  author_name text not null default 'Unknown user',
  risk_count integer not null default 0,
  avg_rpn numeric(10,2) null,
  created_at timestamptz not null default now()
);

create table if not exists public.pfmea_edit_sessions (
  project_id uuid primary key references public.projects(id) on delete cascade,
  locked_by uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pfmea_change_history_project_created
  on public.pfmea_change_history (project_id, created_at desc);

alter table public.pfmea_change_history enable row level security;
alter table public.pfmea_edit_sessions enable row level security;
