-- control_plan_rows bootstrap and trigger support
-- This file defines structural changes and trigger logic only.
-- It intentionally does not grant broad access or create permissive RLS policies.
-- After running this bootstrap on a fresh environment, apply:
--   - 2026-04-22_supabase_critical_auth_hardening.sql
--   - 2026-04-22_supabase_session_history_hardening.sql
--   - 2026-04-22_supabase_invites_projects_hardening.sql
--   - 2026-04-22_supabase_anon_surface_reduction.sql

alter table if exists public.control_plan_rows enable row level security;

alter table if exists public.control_plan_rows
  add column if not exists pfmea_row_id uuid null references public.pfmea_rows(id) on delete set null;

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

-- Trigger helper used to auto-create PCP rows from high-RPN PFMEA rows.
create or replace function public.auto_generate_pcp()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if (new.rpn is not null and new.rpn >= 200) then
    insert into control_plan_rows (
      pfmea_row_id, operation_id, failure_mode, characteristic, class, current_prevention, current_detection, source, status
    )
    values (
      new.id,
      new.operation_id,
      new.failure_mode,
      coalesce(nullif(trim(coalesce(new.characteristic, '')), ''), new.failure_mode),
      coalesce(nullif(trim(coalesce(new.class, '')), ''), null),
      coalesce(new.current_prevention, ''),
      coalesce(new.current_detection, ''),
      'AUTO',
      'REVIEW_REQUIRED'
    )
    on conflict (operation_id, characteristic)
    where (source = 'AUTO')
    do update
      set status = 'REVIEW_REQUIRED',
          updated_at = now();
  end if;

  return new;
end;
$function$;

alter function public.auto_generate_pcp() owner to postgres;
