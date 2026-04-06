-- PCP revision history and edit session support
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

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

drop policy if exists "pcp_change_history_all_auth" on public.pcp_change_history;
create policy "pcp_change_history_all_auth"
  on public.pcp_change_history
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "pcp_edit_sessions_all_auth" on public.pcp_edit_sessions;
create policy "pcp_edit_sessions_all_auth"
  on public.pcp_edit_sessions
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

