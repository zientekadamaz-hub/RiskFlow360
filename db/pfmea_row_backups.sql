-- PFMEA safety snapshot storage.
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.pfmea_row_backups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_revision_id uuid null,
  published_revision_id uuid null,
  revision_label text null,
  change_description text not null default '',
  row_count integer not null default 0,
  snapshot jsonb not null default '[]'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pfmea_row_backups_project_created
  on public.pfmea_row_backups (project_id, created_at desc);

alter table public.pfmea_row_backups enable row level security;

drop policy if exists "pfmea_row_backups_all_auth" on public.pfmea_row_backups;
create policy "pfmea_row_backups_all_auth"
  on public.pfmea_row_backups
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
