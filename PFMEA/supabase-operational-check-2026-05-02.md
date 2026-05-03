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
| PostgreSQL 17 client tools install | PASS |
| Logical public schema/data snapshot via Supabase Management API | PASS |
| Docker/WSL enablement | BLOCKED |
| Docker Desktop / WSL2 re-check on 2026-05-03 | PASS |
| Canonical Supabase CLI public schema dump on 2026-05-03 | PASS |
| Supabase CLI public data dump on 2026-05-03 | PASS with restore warning |

## Dump blocker

The Supabase CLI attempted to use the Supabase Postgres Docker image and failed because Docker Desktop is not running/available in this environment. Local `pg_dump` was initially not available on PATH.

The CLI created an empty dump file during the failed attempt. That empty file was removed.

PostgreSQL 17 client tools were installed successfully, including `pg_dump`. Direct access to the Supabase database host is still blocked by IPv4 availability, and the IPv4 pooler accepted the project host but rejected the provided database password. No database password was changed.

Windows WSL/Docker enablement is blocked by Windows component error `14098` while enabling `VirtualMachinePlatform` / `Microsoft-Windows-Subsystem-Linux`. `DISM /Online /Cleanup-Image /RestoreHealth` completed successfully and `sfc /scannow` reported no integrity violations, but WSL feature enablement still fails. This requires a Windows/WSL repair step outside the application repository.

Update 2026-05-03: Windows was repaired/updated, `VirtualMachinePlatform` and `Microsoft-Windows-Subsystem-Linux` were enabled successfully, WSL2 reports `Default Version: 2`, and Docker Desktop 4.71.0 is running.

## Logical backup created

A practical read-only snapshot was created here:

`PFMEA/supabase-backup-2026-05-02/`

Contents:

- `manifest.json` with table list, row counts and file mapping.
- `checksums.sha256.json` with SHA-256 checksums.
- `00-06` schema metadata JSON files for tables, columns, constraints, indexes, RLS policies, triggers and functions.
- `data_*.json` files for all public tables.

This is not a canonical `pg_dump` restore artifact. It is a safe logical snapshot of the `public` schema and table data created through Supabase Management API read-only queries while Docker/WSL and direct `pg_dump` remain blocked.

## Canonical CLI dumps created

After Docker Desktop became available on 2026-05-03, Supabase CLI dumps were created:

- `PFMEA/supabase-live-public-schema-dump-2026-05-03.sql`
- `PFMEA/supabase-live-public-data-dump-2026-05-03.sql`
- `PFMEA/supabase-live-public-pgdump-checksums-2026-05-03.json`

Verification:

- schema dump size: 186008 bytes
- data dump size: 905783 bytes
- schema dump contains `CREATE TABLE` statements
- data dump contains `INSERT INTO public...` statements
- SHA-256 checksums were generated

The data-only dump emitted PostgreSQL warnings about circular foreign-key constraints between `projects` and `process_revisions`. This does not invalidate the backup, but restore planning should account for it by using a controlled restore sequence, `--disable-triggers`, or a Supabase/Dashboard restore path.

The live backup files are ignored by `.gitignore` because they contain production data.

## Safe next step for backup

Use one of these options before the next schema-changing migration:

1. Use the existing 2026-05-03 Supabase CLI dumps for the current live state, or create a fresh dump before any new migration:

```powershell
npx supabase db dump --linked --schema public --file PFMEA/supabase-live-public-schema-dump-YYYY-MM-DD.sql
npx supabase db dump --linked --schema public --data-only --file PFMEA/supabase-live-public-data-dump-YYYY-MM-DD.sql
```

2. Or create a backup/snapshot from Supabase Dashboard.

3. Or use PostgreSQL client tools and `pg_dump` directly with the verified Supabase Session Pooler connection string in a secure shell.

## Migration source status

`supabase/migrations/` remains the canonical source for new migrations. `db/` remains an archive/manual SQL folder until schema dump/diff classification is finished.

## Current lint status

`supabase db lint --linked` returned:

```text
No schema errors found
```
