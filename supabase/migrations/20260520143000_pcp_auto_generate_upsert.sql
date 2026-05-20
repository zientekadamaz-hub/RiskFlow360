create or replace function public.auto_generate_pcp()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if (new.rpn is not null and new.rpn >= 200) then
    insert into public.control_plan_rows (
      revision_id,
      risk_uid,
      pfmea_row_id,
      operation_id,
      failure_mode,
      characteristic,
      class,
      current_prevention,
      current_detection,
      source,
      status
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
