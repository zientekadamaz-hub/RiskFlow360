# Output C - Post-change application audit report

Data: 2026-05-02  
Repozytorium: `C:\Users\zieada\pfmea-app`  
Stan po wdrozeniu bezpiecznych poprawek z pierwszego audytu.

## Current architectural state

Aplikacja jest buildowalna i ma spojny kierunek produktowy: Projects, PFD, PFMEA, PCP, Actions, RPN Matrix, Progress Chart, Organizations, Invitations, Customer Access i Risk Matrix tworza jedna domenowa calosc. Najwiekszy postep po tej fazie to zielony quality gate (`lint`, `typecheck`, `build`) oraz formalny punkt importu dla RiskFlow UI Standard.

Aktualny model architektury:

- `app/*` nadal zawiera czesc duzych page-level komponentow.
- `src/features/*` zawiera juz wiele wydzielonych modulow: reports, projects, settings, pfd, tasks.
- `src/components/rf-ui` jest nowym kanonicznym wejsciem do standardu UI.
- Supabase jest uzywany przez klienta, serwerowe API routes i RPC. Ciezsza logika PFMEA nadal jest za blisko strony.

## Remaining technical debt

| Severity | Area | Finding | Location | Recommended action |
|---|---|---|---|---|
| High | Architecture | `PFMEA` nadal jest bardzo duzym modulem z UI, state, Supabase i business logic. | `app/pfmea/page.tsx` | Etapowo wydzielic service, hooks, calculations, table components. |
| High | App shell | Header laczy session cache, menu, routing, pomiary layoutu i UI. | `src/components/Layout/AppHeader.tsx` | Rozbic na session/navigation/user-menu/public-header. |
| High | Supabase | Migracje nie maja jednego kanonicznego zrodla. | `db/`, `supabase/migrations/` | Wykonac schema diff i uzgodnic Supabase CLI migrations. |
| Medium | UI standard | `invitation-shell.tsx` pozostaje zbyt duzym plikiem standardu. | `src/features/settings/invitation-shell.tsx` | Podzielic na tokens, surfaces, forms, tables, dialogs, report widgets. |
| Medium | React Compiler | ESLint zawiera targeted overrides dla legacy plikow. | `eslint.config.mjs` | Redukowac override per modul po refaktorach. |
| Medium | Tests | Brak uruchomionych regresji browserowych. | `scripts/regression/*` | Przygotowac dedicated regression project/env. |
| Medium | Error UX | Supabase errors nie sa jeszcze mapowane centralnie na domenowe komunikaty. | services/API routes | Dodac `AppError`/mapper dla validation/auth/conflict/unavailable. |

## Remaining inconsistencies

- UI standard jest importowany kanonicznie, ale nie jest jeszcze fizycznie rozbity na male komponenty.
- `Projects`, `Customer Access`, `Organizations`, `Reports` sa wizualnie najblizej standardu, ale PFMEA/PFD/PCP maja nadal duzo inline presentation logic.
- Raporty i PFMEA korzystaja z pokrewnych definicji RPN/risk color, lecz nadal warto miec jeden wspolny helper kalkulacji.
- Routing raportow jest poprawiony, ale istnieja nadal strony legacy `/reports` i `/reports/progress`, ktore trzeba swiadomie utrzymac albo usunac po migracji linkow.

## Security findings

| Severity | Finding | Risk | Recommendation |
|---|---|---|---|
| High | Sekrety byly recznie kopiowane poza manager sekretow. | Ujawnienie kluczy/hasel. | Rotowac ujawnione sekrety i trzymac je tylko w `.env.local`/hostingu. |
| High | Stan RLS live database niepotwierdzony automatycznie. | Repo moze roznic sie od bazy. | Dodac schema/RLS audit do release checklist. |
| Medium | Public request-access ma tylko process-local rate limit. | Slabsza ochrona w multi-instance. | Docelowo DB/edge/distributed rate limit. |
| Medium | Invite preview/activation sa publiczne token-based. | Brute force/token leakage. | Monitoring, expiry, rate limit, brak tokenow w logach. |

## Performance findings

- Potencjalnie gorace zapytania: PFMEA rows by revision/operation, reports by open revision/project/site, customer access lists.
- Build jest szybki i zielony, ale runtime performance dla duzych PFMEA zalezy od live dataset.
- Brakuje automatycznego pomiaru `EXPLAIN`/query time dla raportow.

## Accessibility findings

- Standard przyciskow, inputow i tabel jest coraz bardziej spojny.
- Nadal potrzebny audit keyboard/focus dla: PFMEA table, dropdowns/popovers, dialogs, chart tooltips.
- Czesci UI uzywaja ikon/przyciskow i popupow; trzeba potwierdzic accessible labels oraz focus trap dla modal/dialog.

## Type safety and validation

Po zmianach:

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS

Nie uruchomiono browser regression z powodu braku dedykowanego env i ryzyka mutacji aktywnych danych.

## Production readiness summary

Ocena: warunkowo gotowe do dalszego rozwoju i wewnetrznego rollout/staging, ale przed szerszym production release potrzebne sa:

1. Supabase schema/RLS diff z live database.
2. Dedicated regression environment.
3. E2E auth/invite/customer access.
4. Etapowy refactor PFMEA/AppHeader.
5. Distributed rate limiting dla publicznych endpointow.

## Recommended next-phase work

1. Przygotowac dedicated regression project w Supabase i uzupelnic env regresyjne.
2. Rozbic `src/features/settings/invitation-shell.tsx` na `rf-ui/tokens`, `rf-ui/forms`, `rf-ui/tables`, `rf-ui/dialogs`, `rf-ui/layout`.
3. Wydzielic z PFMEA najpierw czysta logike kalkulacji RPN/risk color i service do Supabase.
4. Uzgodnic migracje Supabase CLI i dodac release checklist.
5. Zastapic process-local rate limit trwalym mechanizmem.
