-- PFD private drafts + edit lock (one active editor per project)
-- Run in Supabase SQL editor.

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

drop policy if exists "pfd_edit_sessions_all_auth" on public.pfd_edit_sessions;
create policy "pfd_edit_sessions_all_auth"
  on public.pfd_edit_sessions
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "pfd_drafts_all_auth" on public.pfd_drafts;
create policy "pfd_drafts_all_auth"
  on public.pfd_drafts
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "pfd_session_events_all_auth" on public.pfd_session_events;
create policy "pfd_session_events_all_auth"
  on public.pfd_session_events
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "pfd_change_history_all_auth" on public.pfd_change_history;
create policy "pfd_change_history_all_auth"
  on public.pfd_change_history
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Optional one-time backfill from existing revision log
do $$
begin
  if to_regclass('public.process_module_revisions') is not null then
    insert into public.pfd_change_history (
      project_id,
      revision_label,
      change_description,
      author_id,
      author_name,
      node_count,
      edge_count,
      created_at
    )
    select
      pmr.project_id,
      coalesce(pmr.revision_label, '0.0.0'),
      coalesce(pmr.change_description, ''),
      pmr.user_id,
      coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), 'Unknown user'),
      0,
      0,
      coalesce(pmr.created_at, now())
    from public.process_module_revisions pmr
    left join public.profiles p on p.id = pmr.user_id
    where pmr.module = 'PFD'
      and not exists (
        select 1
        from public.pfd_change_history h
        where h.project_id = pmr.project_id
          and h.revision_label = coalesce(pmr.revision_label, '0.0.0')
          and h.change_description = coalesce(pmr.change_description, '')
          and h.created_at = coalesce(pmr.created_at, now())
      );
  end if;
end
$$;
