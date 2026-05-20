-- Deduplicate PCP rows by stable PFMEA risk identity before enforcing uniqueness.

with ranked as (
  select
    id,
    revision_id,
    risk_uid,
    (
      (case when nullif(trim(coalesce(control_method, '')), '') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(sample_size, '')), '') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(frequency, '')), '') is not null then 1 else 0 end) +
      (case when nullif(trim(coalesce(reaction_plan, '')), '') is not null then 1 else 0 end)
    ) as control_count,
    row_number() over (
      partition by revision_id, risk_uid
      order by
        (
          (case when nullif(trim(coalesce(control_method, '')), '') is not null then 1 else 0 end) +
          (case when nullif(trim(coalesce(sample_size, '')), '') is not null then 1 else 0 end) +
          (case when nullif(trim(coalesce(frequency, '')), '') is not null then 1 else 0 end) +
          (case when nullif(trim(coalesce(reaction_plan, '')), '') is not null then 1 else 0 end)
        ) desc,
        updated_at desc nulls last,
        created_at desc nulls last,
        id asc
    ) as rn
  from public.control_plan_rows
  where risk_uid is not null
),
keepers as (
  select id, revision_id, risk_uid
  from ranked
  where rn = 1
),
merged as (
  select
    k.id,
    (
      select d.control_method
      from public.control_plan_rows d
      join ranked r on r.id = d.id
      where d.revision_id = k.revision_id
        and d.risk_uid = k.risk_uid
        and nullif(trim(coalesce(d.control_method, '')), '') is not null
      order by r.control_count desc, d.updated_at desc nulls last, d.created_at desc nulls last, d.id asc
      limit 1
    ) as control_method,
    (
      select d.sample_size
      from public.control_plan_rows d
      join ranked r on r.id = d.id
      where d.revision_id = k.revision_id
        and d.risk_uid = k.risk_uid
        and nullif(trim(coalesce(d.sample_size, '')), '') is not null
      order by r.control_count desc, d.updated_at desc nulls last, d.created_at desc nulls last, d.id asc
      limit 1
    ) as sample_size,
    (
      select d.frequency
      from public.control_plan_rows d
      join ranked r on r.id = d.id
      where d.revision_id = k.revision_id
        and d.risk_uid = k.risk_uid
        and nullif(trim(coalesce(d.frequency, '')), '') is not null
      order by r.control_count desc, d.updated_at desc nulls last, d.created_at desc nulls last, d.id asc
      limit 1
    ) as frequency,
    (
      select d.reaction_plan
      from public.control_plan_rows d
      join ranked r on r.id = d.id
      where d.revision_id = k.revision_id
        and d.risk_uid = k.risk_uid
        and nullif(trim(coalesce(d.reaction_plan, '')), '') is not null
      order by r.control_count desc, d.updated_at desc nulls last, d.created_at desc nulls last, d.id asc
      limit 1
    ) as reaction_plan
  from keepers k
)
update public.control_plan_rows target
set
  control_method = coalesce(nullif(trim(coalesce(target.control_method, '')), ''), merged.control_method, target.control_method),
  sample_size = coalesce(nullif(trim(coalesce(target.sample_size, '')), ''), merged.sample_size, target.sample_size),
  frequency = coalesce(nullif(trim(coalesce(target.frequency, '')), ''), merged.frequency, target.frequency),
  reaction_plan = coalesce(nullif(trim(coalesce(target.reaction_plan, '')), ''), merged.reaction_plan, target.reaction_plan),
  updated_at = greatest(coalesce(target.updated_at, target.created_at, now()), now())
from merged
where target.id = merged.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by revision_id, risk_uid
      order by
        (
          (case when nullif(trim(coalesce(control_method, '')), '') is not null then 1 else 0 end) +
          (case when nullif(trim(coalesce(sample_size, '')), '') is not null then 1 else 0 end) +
          (case when nullif(trim(coalesce(frequency, '')), '') is not null then 1 else 0 end) +
          (case when nullif(trim(coalesce(reaction_plan, '')), '') is not null then 1 else 0 end)
        ) desc,
        updated_at desc nulls last,
        created_at desc nulls last,
        id asc
    ) as rn
  from public.control_plan_rows
  where risk_uid is not null
)
delete from public.control_plan_rows target
using ranked
where target.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists ux_control_plan_rows_revision_risk_uid
  on public.control_plan_rows (revision_id, risk_uid)
  where risk_uid is not null;
