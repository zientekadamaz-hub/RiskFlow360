# Supabase Audit - Preliminary

Data: 2026-04-22

## Scope

Ten raport obejmuje tylko to, co da się zweryfikować lokalnie z repo:
- pliki `db/*.sql`
- integrację aplikacji z Supabase
- dostępność lokalnego CLI

Nie obejmuje bezpośredniego stanu projektu Supabase w chmurze, bo w tym środowisku nie ma jeszcze aktywnego dostępu do projektu.

## Access status

### What is available
- lokalny folder `db/` z plikami SQL
- działający `supabase` CLI (`2.84.5`)

### What is missing for direct project audit
- `SUPABASE_ACCESS_TOKEN`
- `supabase login`
- linked project config (`supabase/config.toml` nie istnieje)
- `DATABASE_URL` / `POSTGRES_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Direct CLI result
- `npx supabase projects list` kończy się błędem:
  - `Access token not provided`

Wniosek:
Możemy zrobić **preliminary SQL/RLS audit z repo**, ale nie możemy jeszcze potwierdzić:
- realnych policy wdrożonych w projekcie
- aktualnych funkcji RPC
- Auth settings
- Storage policies
- secrets / config w projekcie

## Key findings

### CRITICAL - `control_plan_rows` jest jawnie otwarte dla `anon` i `authenticated`

Plik:
- `db/control_plan_rows_rls.sql`

Dowody:
- komentarz:
  - `temporary unblock`
  - `WARNING: this opens access broadly for anon/authenticated. Tighten later.`
- granty:
  - `grant select, insert, update, delete on table public.control_plan_rows to anon, authenticated, service_role;`
- policy:
  - select: `using (true)`
  - insert: `with check (true)`
  - update: `using (true) with check (true)`
  - delete: `using (true)`

Ryzyko:
- każdy anonimowy lub zalogowany klient może potencjalnie czytać i modyfikować `control_plan_rows`
- brak tenant isolation
- brak project/org scoping
- to jest niezgodne z produkcyjnym modelem bezpieczeństwa

Ocena:
- **CRITICAL**

### HIGH - PFMEA / PFD / PCP edit-history tables mają politykę „każdy zalogowany może wszystko”

Pliki:
- `db/pfmea_editing.sql`
- `db/pfd_editing.sql`
- `db/pcp_editing.sql`
- `db/pfmea_row_backups.sql`

Wzorzec policy:
- `for all`
- `using (auth.uid() is not null)`
- `with check (auth.uid() is not null)`

To nie jest wystarczające bezpieczeństwo dla aplikacji wieloorganizacyjnej.

Ryzyko:
- każdy zalogowany użytkownik może potencjalnie czytać / pisać rekordy innych organizacji lub projektów, jeśli nie ma dodatkowych zabezpieczeń poza tymi plikami
- dotyczy to m.in.:
  - `pfmea_change_history`
  - `pfmea_edit_sessions`
  - `pfd_edit_sessions`
  - `pfd_drafts`
  - `pfd_session_events`
  - `pfd_change_history`
  - `pcp_change_history`
  - `pcp_edit_sessions`
  - `pfmea_row_backups`

Ocena:
- **HIGH**

### HIGH - `security definer` na `auto_generate_pcp()` wymaga bardzo ostrożnej weryfikacji

Plik:
- `db/control_plan_rows_rls.sql`

Funkcja:
- `public.auto_generate_pcp()`
- `security definer`
- owner ustawiony na `postgres`

Sama funkcja nie musi być błędna, ale przy tak szerokich policy i grantach jest bardzo ryzykowna.

Ryzyko:
- funkcja wykonuje zapisy z podniesionymi uprawnieniami
- jeśli trigger/wywołanie nie ma poprawnych warunków domenowych, może tworzyć wpisy w sposób trudny do przewidzenia
- bez bezpośredniego audytu projektu nie da się potwierdzić pełnego kontekstu triggerów i call chain

Ocena:
- **HIGH**

### HIGH - aplikacja opiera bezpieczeństwo na Supabase, ale warstwa klienta używa anon key i bezpośrednich mutacji

W aplikacji główne moduły pracują z klientem Supabase po stronie przeglądarki:
- `app/pfmea/page.tsx`
- `app/pfd/page.tsx`
- `app/pcp/page.tsx`
- `app/projects/page.tsx`

To oznacza, że poprawność bezpieczeństwa zależy prawie całkowicie od:
- RLS
- funkcji RPC
- modelu membership / organization scoping po stronie bazy

Przy obecnych lokalnych SQL-ach nie ma podstaw, żeby uznać to za wystarczająco bezpieczne.

Ocena:
- **HIGH**

### MEDIUM - brak uporządkowanego systemu migracji Supabase

Stan repo:
- jest folder `db/*.sql`
- nie ma `supabase/config.toml`
- nie widać standardowego katalogu migracji CLI (`supabase/migrations`)

Ryzyko:
- drift między repo i realnym projektem
- trudniejszy rollback
- trudniejszy review zmian bazy
- brak pewności, które SQL-e są faktycznie wdrożone

Ocena:
- **MEDIUM**

### MEDIUM - nie można zweryfikować kluczowych RPC i policy referencjonowanych przez frontend

Frontend używa m.in.:
- `get_my_header`
- `ensure_process_draft`
- `publish_process_module_revision`
- `get_severity_effective`
- `get_occurrence_effective`
- `get_detection_effective`
- `create_org_invitation`
- `set_invitation_status`
- `accept_invitation`

Ich definicje nie są dostępne w lokalnym repo.

Ryzyko:
- nie wiemy, czy te funkcje:
  - respektują active organization
  - walidują membership
  - mają `security definer`
  - filtrują dane poprawnie

Ocena:
- **MEDIUM**

## Current risk summary

### Overall security status from local evidence

Na podstawie samych plików SQL i integracji aplikacyjnej ocena jest taka:

- bezpieczeństwo Supabase w obecnym, lokalnie widocznym modelu jest **niewystarczające do uznania za production-ready**
- największym problemem są polityki typu:
  - `using (true)`
  - `with check (true)`
  - `auth.uid() is not null` bez project/org scoping

## Recommended next steps

### 1. Direct project access - required

Żeby wejść w pełny audyt Supabase, potrzebuję jednego z tych wariantów:

- `supabase login` lub `SUPABASE_ACCESS_TOKEN`
- read-only `DATABASE_URL` / Postgres connection string
- eksportu:
  - schema
  - policies
  - functions
  - triggers

Najlepszy wariant:
- **read-only access do projektu lub token do CLI**

### 2. Immediate RLS remediation target

Najpierw trzeba zweryfikować i prawdopodobnie przebudować:

1. `control_plan_rows`
2. `pfmea_rows`
3. `pfd_drafts`
4. `pfmea_edit_sessions`
5. `pcp_edit_sessions`
6. history tables

Docelowy model policy powinien opierać się na:
- membership w organizacji
- powiązaniu projektu z organizacją
- aktywnym kontekście użytkownika
- ewentualnie roli `admin/champion` tam, gdzie to naprawdę potrzebne

### 3. Migration discipline

Po wejściu do projektu warto:
- zlinkować projekt do CLI
- wprowadzić standardowe migracje Supabase
- uporządkować SQL w wersjonowane pliki migracyjne

## Practical next move

Moja rekomendacja:

1. udostępnić dostęp do projektu Supabase
2. pobrać realny stan:
   - tables
   - policies
   - functions
   - triggers
3. porównać stan chmury z lokalnym `db/*.sql`
4. zrobić właściwy audyt bezpieczeństwa i plan naprawczy RLS

Bez kroku 1 możemy mówić tylko o **preliminary audit**. I już on pokazuje, że ryzyko jest wysokie.

