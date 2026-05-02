# Etap 2 - Customer Revoke + View Hardening

Data: 2026-04-23

## Cel

Domkniecie Etapu 2 przez sprawdzenie i utwardzenie scenariusza cofania dostepu `customer`, nie tylko samego nadawania grantow.

## Co zostalo zmienione

### Regresja

- dodano helper revoke do [scripts/regression/_shared/invitationFlow.js](</c:/Users/zieada/pfmea-app/scripts/regression/_shared/invitationFlow.js>)
- dodano nowy scenariusz:
  - [scripts/regression/org/customer-revoke-flow.js](</c:/Users/zieada/pfmea-app/scripts/regression/org/customer-revoke-flow.js>)
- dodano skrypt npm:
  - `npm run regression:org:customer-revoke-flow`

### Supabase

- dodano live migracje:
  - [db/2026-04-23_supabase_projects_with_revision_security_invoker.sql](</c:/Users/zieada/pfmea-app/db/2026-04-23_supabase_projects_with_revision_security_invoker.sql>)
  - [db/2026-04-23_supabase_process_revisions_customer_select.sql](</c:/Users/zieada/pfmea-app/db/2026-04-23_supabase_process_revisions_customer_select.sql>)

## Realny problem znaleziony podczas testu

### Problem 1

- `customer-revoke-flow` ujawnil, ze po cofnieciu grantu `customer` nadal widzial projekt na liscie

### Przyczyna

- view `public.projects_with_revision` byl wlasnoscia `postgres`
- nie mial `security_invoker = true`
- przez to nie respektowal docelowego modelu RLS tak, jak zakladalismy dla `customer`

### Naprawa

- `projects_with_revision` zostal przelaczony na `security_invoker = true`

### Problem 2

- po poprawce view `customer` przestal widziec nawet poprawnie grantowany projekt

### Przyczyna

- `public.process_revisions` nie mial juz `SELECT` dla `authenticated`
- dodatkowo polityka `process_revisions_select` nie byla dopasowana do modelu `customer_access_grants`

### Naprawa

- przywrocono minimalny `SELECT` dla `authenticated`
- polityka `process_revisions_select` zostala zawzona:
  - `admin` globalny
  - normalny czlonek organizacji niebedacy `customer`
  - `customer` tylko gdy istnieje aktywny grant na projekt

## Co zostalo potwierdzone po naprawie

### Grant

- `npm run regression:org:customer-flow` - OK
- customer po nadaniu grantu `PFD`:
  - widzi projekt
  - widzi tylko `PFD`
  - nie widzi `PFMEA` ani `PCP`
  - nie ma dostepu do `settings`
  - reczne wejscie na niegrantowane moduly konczy sie redirectem do `/projects`

### Revoke

- `npm run regression:org:customer-revoke-flow` - OK
- po cofnieciu `PFD`:
  - customer nie widzi juz projektu na liscie
  - customer wraca do stanu `No granted modules yet`
  - reczne wejscie na `/pfd`, `/pfmea`, `/pcp` dla tego projektu jest blokowane

## Walidacja

- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run build` - OK
- `npm run regression:org:customer-flow` - OK
- `npm run regression:org:customer-revoke-flow` - OK

## Stan po tej iteracji

- model `customer` jest juz nie tylko funkcjonalny, ale tez odporny na revoke
- wyciek przez `projects_with_revision` zostal zamkniety
- view i tabela rewizji sa teraz zgodne z modelem least-privilege dla klienta

## Co dalej po Etapie 2

- jesli chcemy domknac stabilizacje w 100%:
  - dodac scenariusz `customer` z wieloma grantami naraz
  - sprawdzic zachowanie customera dla zmian grantow podczas aktywnej sesji na otwartym module
  - zdecydowac, czy customer ma widziec tylko aktualny stan czy tez kontrolowane rewizje historyczne
