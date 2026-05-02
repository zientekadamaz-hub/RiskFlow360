# Supabase operational check

Data: 2026-05-02

## Scope

This check covered the operational part of the next phase:

- confirm whether a schema dump can be created from the linked Supabase project,
- confirm current linked database lint status,
- keep migration source rules explicit.

## Results

| Check | Result |
|---|---|
| `npx supabase db dump --linked --schema public --file PFMEA/supabase-live-public-schema-dump-2026-05-02.sql` | BLOCKED |
| `npx supabase db lint --linked` | PASS |

## Dump blocker

The Supabase CLI attempted to use the Supabase Postgres Docker image and failed because Docker Desktop is not running/available in this environment. Local `pg_dump` was also not available on PATH.

The CLI created an empty dump file during the failed attempt. That empty file was removed.

## Safe next step for backup

Use one of these options before the next schema-changing migration:

1. Start Docker Desktop and re-run:

```powershell
npx supabase db dump --linked --schema public --file PFMEA/supabase-live-public-schema-dump-2026-05-02.sql
```

2. Or create a backup/snapshot from Supabase Dashboard.

3. Or install PostgreSQL client tools and use `pg_dump` directly with the database connection string in a secure shell.

## Migration source status

`supabase/migrations/` remains the canonical source for new migrations. `db/` remains an archive/manual SQL folder until schema dump/diff classification is finished.

## Current lint status

`supabase db lint --linked` returned:

```text
No schema errors found
```
