-- PCP backend update: add Sample Size to control_plan_rows
-- Run in Supabase SQL editor.

alter table if exists public.control_plan_rows
  add column if not exists sample_size text null;

comment on column public.control_plan_rows.sample_size
  is 'PCP sample size / inspection sample definition.';
