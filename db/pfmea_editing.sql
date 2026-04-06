-- PFMEA revision history support
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

alter table if exists public.pfmea_rows
  add column if not exists characteristic text null;

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

drop policy if exists "pfmea_change_history_all_auth" on public.pfmea_change_history;
create policy "pfmea_change_history_all_auth"
  on public.pfmea_change_history
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "pfmea_edit_sessions_all_auth" on public.pfmea_edit_sessions;
create policy "pfmea_edit_sessions_all_auth"
  on public.pfmea_edit_sessions
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Optional one-time backfill from module revision log.
do $$
begin
  if to_regclass('public.process_module_revisions') is not null then
    insert into public.pfmea_change_history (
      project_id,
      revision_label,
      change_description,
      author_id,
      author_name,
      risk_count,
      avg_rpn,
      created_at
    )
    select
      pmr.project_id,
      coalesce(pmr.revision_label, '0.0.0'),
      coalesce(pmr.change_description, ''),
      pmr.user_id,
      coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), 'Unknown user'),
      0,
      null,
      coalesce(pmr.created_at, now())
    from public.process_module_revisions pmr
    left join public.profiles p on p.id = pmr.user_id
    where pmr.module = 'PFMEA'
      and not exists (
        select 1
        from public.pfmea_change_history h
        where h.project_id = pmr.project_id
          and h.revision_label = coalesce(pmr.revision_label, '0.0.0')
          and h.change_description = coalesce(pmr.change_description, '')
          and h.created_at = coalesce(pmr.created_at, now())
      );
  end if;
end
$$;
