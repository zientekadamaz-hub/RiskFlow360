-- PFD private drafts + edit lock bootstrap
-- This file defines structural objects only.
-- It intentionally does not create permissive RLS policies.
-- After running this bootstrap on a fresh environment, apply:
--   - 2026-04-22_supabase_critical_auth_hardening.sql
--   - 2026-04-22_supabase_session_history_hardening.sql
--   - 2026-04-22_supabase_invites_projects_hardening.sql
--   - 2026-04-22_supabase_anon_surface_reduction.sql

create extension if not exists pgcrypto;

create table if not exists public.pfd_edit_sessions (
  project_id uuid primary key references public.projects(id) on delete cascade,
  locked_by uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pfd_drafts (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.pfd_session_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create table if not exists public.pfd_change_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_label text not null default '0.0.0',
  change_description text not null default '',
  author_id uuid null references auth.users(id) on delete set null,
  author_name text not null default 'Unknown user',
  node_count integer not null default 0,
  edge_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_pfd_session_events_user_unread
  on public.pfd_session_events (project_id, user_id, created_at desc)
  where read_at is null;

create index if not exists idx_pfd_change_history_project_created
  on public.pfd_change_history (project_id, created_at desc);

alter table public.pfd_edit_sessions enable row level security;
alter table public.pfd_drafts enable row level security;
alter table public.pfd_session_events enable row level security;
alter table public.pfd_change_history enable row level security;
