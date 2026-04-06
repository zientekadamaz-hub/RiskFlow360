-- control_plan_rows RLS hard reset (temporary unblock)
-- Run in Supabase SQL editor for the SAME project as your app URL.
-- WARNING: this opens access broadly for anon/authenticated. Tighten later.

alter table if exists public.control_plan_rows enable row level security;
alter table if exists public.control_plan_rows no force row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table public.control_plan_rows to anon, authenticated, service_role;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'control_plan_rows'
  loop
    execute format('drop policy if exists %I on public.control_plan_rows', p.policyname);
  end loop;
end
$$;

create policy "control_plan_rows_select_all"
  on public.control_plan_rows
  for select
  to anon, authenticated, service_role
  using (true);

create policy "control_plan_rows_insert_all"
  on public.control_plan_rows
  for insert
  to anon, authenticated, service_role
  with check (true);

create policy "control_plan_rows_update_all"
  on public.control_plan_rows
  for update
  to anon, authenticated, service_role
  using (true)
  with check (true);

create policy "control_plan_rows_delete_all"
  on public.control_plan_rows
  for delete
  to anon, authenticated, service_role
  using (true);

-- make trigger function deterministic for high-RPN path (>=200)
-- this path writes to control_plan_rows from pfmea_rows trigger
create or replace function public.auto_generate_pcp()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if (new.rpn is not null and new.rpn >= 200) then
    insert into control_plan_rows (
      operation_id, characteristic, source, status
    )
    values (
      new.operation_id, new.failure_mode, 'AUTO', 'REVIEW_REQUIRED'
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

-- fix functions/triggers that touch control_plan_rows and were created with row_security=off
do $$
declare f record;
begin
  for f in
    with fn as (
      select
        p.oid,
        n.nspname as schema_name,
        p.proname as function_name,
        pg_get_function_identity_arguments(p.oid) as args,
        coalesce(p.proconfig, array[]::text[]) as proconfig,
        pg_get_functiondef(p.oid) as fn_def
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prokind = 'f'
    )
    select schema_name, function_name, args
    from fn
    where fn_def ilike '%control_plan_rows%'
      and exists (
        select 1
        from unnest(proconfig) cfg
        where cfg ilike 'row_security=off'
      )
  loop
    execute format(
      'alter function %I.%I(%s) reset row_security',
      f.schema_name,
      f.function_name,
      f.args
    );
  end loop;
end
$$;

-- enforce row_security=on for API roles
alter role anon set row_security = on;
alter role authenticated set row_security = on;
alter role service_role set row_security = on;

-- verify
select
  n.nspname as schemaname,
  c.relname as tablename,
  c.relrowsecurity as rowsecurity,
  c.relforcerowsecurity as forcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'control_plan_rows'
  and c.relkind = 'r';

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'control_plan_rows'
order by policyname;

show row_security;

select rolname, rolconfig
from pg_roles
where rolname in ('anon', 'authenticated', 'service_role')
order by rolname;

select
  d.datname,
  coalesce(r.rolname, 'ALL_ROLES') as role_name,
  s.setconfig
from pg_db_role_setting s
join pg_database d on d.oid = s.setdatabase
left join pg_roles r on r.oid = s.setrole
where d.datname = current_database()
order by role_name;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ilike '%control_plan_rows%'
order by schema_name, function_name;
