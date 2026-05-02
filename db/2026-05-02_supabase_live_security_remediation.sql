-- Live security remediation captured on 2026-05-02.
-- Non-destructive: enables RLS on an accidental empty test table if it exists.

do $$
begin
  if to_regclass('public.codex_test_tmp') is not null then
    alter table public.codex_test_tmp enable row level security;
  end if;
end $$;
