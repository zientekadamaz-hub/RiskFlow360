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
  add column if not exists risk_uid uuid null;

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

alter table if exists public.control_plan_rows
  drop constraint if exists ux_pcp_auto_per_op_characteristic;

drop index if exists public.ux_pcp_auto_per_op_characteristic;

create unique index if not exists ux_control_plan_rows_revision_risk_uid
  on public.control_plan_rows (revision_id, risk_uid)
  where risk_uid is not null;

-- Trigger helper used to auto-create PCP rows from high-RPN PFMEA rows.
create or replace function public.auto_generate_pcp()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if (new.rpn is not null and new.rpn >= 200) then
    insert into public.control_plan_rows (
      revision_id, risk_uid, pfmea_row_id, operation_id, failure_mode, characteristic, class, current_prevention, current_detection, source, status
    )
    values (
      new.revision_id,
      new.risk_uid,
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
    on conflict (revision_id, risk_uid) where risk_uid is not null
    do update set
      pfmea_row_id = excluded.pfmea_row_id,
      operation_id = excluded.operation_id,
      failure_mode = excluded.failure_mode,
      characteristic = excluded.characteristic,
      class = excluded.class,
      current_prevention = excluded.current_prevention,
      current_detection = excluded.current_detection,
      status = case
        when public.control_plan_rows.source = 'AUTO' then excluded.status
        else public.control_plan_rows.status
      end,
      updated_at = now();
  end if;

  return new;
end;
$function$;

alter function public.auto_generate_pcp() owner to postgres;
