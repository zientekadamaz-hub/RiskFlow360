create extension if not exists pgcrypto;

alter table if exists public.pfmea_rows
  add column if not exists risk_uid uuid;

alter table if exists public.control_plan_rows
  add column if not exists risk_uid uuid;

alter table if exists public.pfmea_rows
  alter column risk_uid set default gen_random_uuid();

alter table if exists public.control_plan_rows
  alter column risk_uid set default gen_random_uuid();

with grouped as (
  select
    id,
    first_value(id) over (
      partition by
        operation_id,
        lower(trim(coalesce(failure_mode, ''))),
        lower(trim(coalesce(characteristic, ''))),
        lower(trim(coalesce(class, ''))),
        lower(trim(coalesce(cause, '')))
      order by created_at nulls last, id
    ) as stable_uid
  from public.pfmea_rows
)
update public.pfmea_rows target
set risk_uid = grouped.stable_uid
from grouped
where target.id = grouped.id
  and target.risk_uid is null;

update public.pfmea_rows
set risk_uid = gen_random_uuid()
where risk_uid is null;

update public.control_plan_rows cpr
set risk_uid = pr.risk_uid
from public.pfmea_rows pr
where cpr.pfmea_row_id = pr.id
  and cpr.risk_uid is null;

with grouped as (
  select
    id,
    first_value(coalesce(risk_uid, id)) over (
      partition by
        operation_id,
        lower(trim(coalesce(failure_mode, ''))),
        lower(trim(coalesce(characteristic, ''))),
        lower(trim(coalesce(class, '')))
      order by created_at nulls last, id
    ) as stable_uid
  from public.control_plan_rows
)
update public.control_plan_rows target
set risk_uid = grouped.stable_uid
from grouped
where target.id = grouped.id
  and target.risk_uid is null;

update public.control_plan_rows
set risk_uid = gen_random_uuid()
where risk_uid is null;

alter table if exists public.pfmea_rows
  alter column risk_uid set not null;

alter table if exists public.control_plan_rows
  alter column risk_uid set not null;

create index if not exists idx_pfmea_rows_risk_uid
  on public.pfmea_rows (risk_uid);

create index if not exists idx_pfmea_rows_revision_risk_uid
  on public.pfmea_rows (revision_id, risk_uid);

create index if not exists idx_control_plan_rows_risk_uid
  on public.control_plan_rows (risk_uid);

create index if not exists idx_control_plan_rows_revision_risk_uid
  on public.control_plan_rows (revision_id, risk_uid);

alter table if exists public.control_plan_rows
  drop constraint if exists ux_pcp_auto_per_op_characteristic;

drop index if exists public.ux_pcp_auto_per_op_characteristic;

create or replace function public.auto_generate_pcp()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if (new.rpn is not null and new.rpn >= 200) then
    update public.control_plan_rows
    set pfmea_row_id = new.id,
        operation_id = new.operation_id,
        failure_mode = new.failure_mode,
        characteristic = coalesce(nullif(trim(coalesce(new.characteristic, '')), ''), new.failure_mode),
        class = coalesce(nullif(trim(coalesce(new.class, '')), ''), null),
        current_prevention = coalesce(new.current_prevention, ''),
        current_detection = coalesce(new.current_detection, ''),
        status = 'REVIEW_REQUIRED',
        updated_at = now()
    where revision_id = new.revision_id
      and risk_uid = new.risk_uid
      and source = 'AUTO';

    if not found then
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
      );
    end if;
  end if;

  return new;
end;
$function$;

alter function public.auto_generate_pcp() owner to postgres;
