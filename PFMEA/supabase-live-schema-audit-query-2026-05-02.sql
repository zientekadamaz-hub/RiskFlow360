select jsonb_pretty(
  jsonb_build_object(
    'generated_at', now(),
    'tables', (
      select jsonb_agg(
        jsonb_build_object(
          'schema', schemaname,
          'table', tablename,
          'owner', tableowner,
          'rls_enabled', rowsecurity
        )
        order by schemaname, tablename
      )
      from pg_tables
      join pg_class on pg_class.relname = pg_tables.tablename
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace and pg_namespace.nspname = pg_tables.schemaname
      where schemaname = 'public'
    ),
    'columns', (
      select jsonb_agg(
        jsonb_build_object(
          'table', table_name,
          'column', column_name,
          'type', data_type,
          'udt_name', udt_name,
          'is_nullable', is_nullable,
          'default', column_default
        )
        order by table_name, ordinal_position
      )
      from information_schema.columns
      where table_schema = 'public'
    ),
    'policies', (
      select jsonb_agg(
        jsonb_build_object(
          'table', tablename,
          'policy', policyname,
          'roles', roles,
          'cmd', cmd,
          'permissive', permissive,
          'qual', qual,
          'with_check', with_check
        )
        order by tablename, policyname
      )
      from pg_policies
      where schemaname = 'public'
    ),
    'functions', (
      select jsonb_agg(
        jsonb_build_object(
          'name', p.proname,
          'args', pg_get_function_identity_arguments(p.oid),
          'returns', pg_get_function_result(p.oid),
          'security_definer', p.prosecdef,
          'config', p.proconfig,
          'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
          'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE')
        )
        order by p.proname, pg_get_function_identity_arguments(p.oid)
      )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
    ),
    'indexes', (
      select jsonb_agg(
        jsonb_build_object(
          'table', tablename,
          'index', indexname,
          'definition', indexdef
        )
        order by tablename, indexname
      )
      from pg_indexes
      where schemaname = 'public'
    ),
    'constraints', (
      select jsonb_agg(
        jsonb_build_object(
          'table', tc.table_name,
          'constraint', tc.constraint_name,
          'type', tc.constraint_type
        )
        order by tc.table_name, tc.constraint_name
      )
      from information_schema.table_constraints tc
      where tc.table_schema = 'public'
    ),
    'views', (
      select jsonb_agg(
        jsonb_build_object(
          'view', viewname,
          'definition', definition
        )
        order by viewname
      )
      from pg_views
      where schemaname = 'public'
    )
  )
) as schema_snapshot;
