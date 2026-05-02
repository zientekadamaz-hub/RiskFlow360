# Output B - Supabase audit report

Data: 2026-05-02  
Zakres: statyczny audyt repozytorium, migracji SQL, warstwy API, klienta Supabase i integracji Next.js.  
Ograniczenie: nie wykonywano destrukcyjnych migracji ani bezposredniego `db diff` na produkcyjnej bazie. Wnioski dotycza stanu repo i widocznych kontraktow.

## Executive summary

Supabase jest juz potraktowany powaznie: widac RLS hardening, RPC z `security definer`, jawne `search_path`, revoke/grant dla funkcji, model organizacji, zaproszen i customer access. Najwiekszy problem produkcyjny to nie brak zabezpieczen w kodzie, ale brak jednego zaufanego zrodla prawdy dla migracji: `db/` ma 31 plikow SQL, a `supabase/migrations/` tylko 4. Bez schema dump/diff nie da sie bezpiecznie potwierdzic, czy live database odpowiada repozytorium.

## Schema findings

| ID | Severity | Location | Finding | Risk | Recommended fix | Safe now | Requires migration | Staged rollout |
|---|---|---|---|---|---|---|---|---|
| S-01 | High | `db/`, `supabase/migrations/` | Dwa zrodla migracji: 31 plikow w `db`, 4 w `supabase/migrations`. | Nowe srodowisko moze nie odtworzyc faktycznego schematu; latwo pominac hardening. | Wykonac `supabase db dump`/`db diff`, ustalic kanoniczny katalog migracji, dodac checklist deployment. | No | Yes | Yes |
| S-02 | Medium | `db/2026-04-26_supabase_risk_matrix_system_defaults.sql` | Istnieje kompatybilnosc `risk_matrix_config.id = 1` i `project_id`. | Legacy fallback moze utrudniac czytelnosc i RLS, jezeli stare ekrany oczekuja global config. | W kolejnej fazie zmapowac wszystkie odczyty Risk Matrix i usunac legacy tylko po migracji. | No | Yes | Yes |
| S-03 | Medium | `pfmea_rows`, `process_revisions`, `projects_with_revision` usage | Duza liczba zapytan bezposrednio z page-level PFMEA/PCP. | Trudniej utrzymac spojnosc revision/draft i autoryzacji. | Wydzielic `pfmea-service`, wspolne transakcje/RPC dla operacji draft/publish/delete. | No | Maybe | Yes |
| S-04 | Medium | Queries on `pfmea_rows` by `revision_id`, `operation_id`, reports | Repo nie potwierdza jednoznacznie indeksow pod wszystkie gorace sciezki raportow i PFMEA. | Przy wiekszych organizacjach raporty i zapis PFMEA moga zwalniac. | Zweryfikowac live indexes przez `pg_indexes` i `EXPLAIN`; dodac indeksy tylko po pomiarze. | No | Yes | Yes |

## Auth / RLS findings

| ID | Severity | Location | Finding | Risk | Recommended fix | Safe now | Requires migration | Staged rollout |
|---|---|---|---|---|---|---|---|---|
| R-01 | Medium | `db/*hardening*.sql`, `supabase/migrations/*` | Funkcje `security definer` maja jawny `search_path`, a revoke/grant sa szeroko stosowane. | Pozytywne; wymaga tylko potwierdzenia, ze migracje sa applied. | Dodac audyt deploy: lista funkcji bez `search_path`, granty anon/public, tabele bez RLS. | No | No | Yes |
| R-02 | Medium | `get_invitation_preview`, `activate_invited_user` | Wybrane RPC sa dostepne dla `anon`, bo invite flow musi dzialac publicznie. | Token-based endpointy sa wrazliwe na brute force i log leakage. | Utrzymac krotki expiry tokenow, nie logowac tokenow, monitorowac 4xx, opcjonalnie rate limit. | Partial | Maybe | Yes |
| R-03 | High | `access_requests` / `submit_access_request` | Publiczny request-access byl endpointem bez aplikacyjnego throttlingu. | Spam requestow i wypelnienie tabeli access_requests. | Wdrozone: procesowy rate limit w API route. Docelowo trwaly limit w DB/edge. | Yes | No for current fix | Yes for final fix |
| R-04 | Medium | `organization_members`, `organization_invitations` | Role i zaproszenia sa pilnowane przez RPC, ale pelna pewnosc wymaga live RLS audit. | Nadanie zlej roli moze dac za szeroki dostep. | Dodac e2e invite/viewer/customer regression na dedykowanej bazie. | No | No | Yes |

## Storage findings

| ID | Severity | Location | Finding | Risk | Recommended fix | Safe now | Requires migration | Staged rollout |
|---|---|---|---|---|---|---|---|---|
| ST-01 | Low | `app/`, `src/` | Nie znaleziono aktywnego uzycia Supabase Storage (`storage.`). | Brak bezposredniego ryzyka storage; brak tez polityk do audytu. | Jesli storage zostanie dodany, zaczac od prywatnych bucketow i signed URLs. | Yes | No | No |

## Query / performance findings

| ID | Severity | Location | Finding | Risk | Recommended fix | Safe now | Requires migration | Staged rollout |
|---|---|---|---|---|---|---|---|---|
| Q-01 | High | `app/pfmea/page.tsx` | Wiele operacji delete/insert/update `pfmea_rows` jest wykonywane z klienta i page component. | Wieksze ryzyko czesciowego zapisu, race condition i niespojnego draftu. | Przeniesc krytyczne operacje do RPC albo service layer z jasnymi transakcjami. | No | Maybe | Yes |
| Q-02 | Medium | Reports: `progress-chart-service`, `rpn-matrix-service` | Raporty agreguja dane z PFMEA i konfiguracji Risk Matrix. | Rozjazd z UI PFMEA, jesli definicja open/current revision nie bedzie wspolna. | Wspolny query/helper dla open revision, risk color i RPN thresholds. | Yes as refactor | No | No |
| Q-03 | Medium | `projects_with_revision` | Widok jest centralny dla wielu ekranow. | Niespojna polityka security invoker/definer moze zmienic dostep do projektow. | Potwierdzic live definition widoku i RLS bazowych tabel w schema dump. | No | No | Yes |

## Integration findings

| ID | Severity | Location | Finding | Risk | Recommended fix | Safe now | Requires migration | Staged rollout |
|---|---|---|---|---|---|---|---|---|
| I-01 | Medium | `src/lib/env.ts` | Env vars sa centralizowane; brak service role w runtime app. | Pozytywne. Ryzyko tylko przy zlym deployment env. | Dodac deployment checklist dla `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, email env. | Yes | No | No |
| I-02 | High | Public secrets shared outside secure storage | W historii rozmowy pojawily sie wkladane recznie sekrety. | Sekret mogl zostac ujawniony poza docelowym sekretnym magazynem. | Rotowac hasla/klucze, ktore byly kopiowane do czatu lub screenow. | Yes | No | No |
| I-03 | Medium | `scripts/seed/watlow-demo-data.mjs` | Seed uzywa `SERVICE_ROLE_KEY` i moze kasowac dane projektu demo. | Niebezpieczne przy uruchomieniu na produkcyjnej organizacji. | Oznaczyc jako tylko dedicated demo/regression env; dodac guard nazwy organizacji/projektu. | Partial | No | No |

## Fixes implemented

- `app/api/request-access/route.ts`: procesowy rate limit dla publicznego request-access.
- `src/features/settings/risk-matrix/risk-matrix-service.ts`: poprawiony typ timeout result, co odblokowuje typecheck i zmniejsza ryzyko ukrytych bledow integracji Supabase.

## Fixes deferred

- Konsolidacja migracji `db/` vs `supabase/migrations/`.
- Indeksy performance bez `EXPLAIN`/live schema.
- Przeniesienie krytycznych operacji PFMEA draft/publish/delete do RPC/transakcji.
- Trwaly rate limit dla request-access po stronie DB/edge.
- Pelne e2e invite/customer/org access regression.

## Migration-required items

1. Kanoniczny zestaw migracji Supabase CLI.
2. Ewentualne indeksy dla `pfmea_rows(revision_id)`, `pfmea_rows(operation_id)`, `process_revisions(project_id,module,status)` i zaproszen, po potwierdzeniu live schema.
3. Opcjonalny DB-backed rate limiting/access request deduplication hardening.
4. Ewentualne RPC transakcyjne dla PFMEA draft/publish.

## Remaining risks

- Nie da sie z repo potwierdzic, ze wszystkie SQL hardening migrations sa faktycznie applied na produkcji.
- Procesowy rate limit nie chroni w pelni w multi-instance/serverless.
- Duze page components nadal moga omijac wspolne kontrakty Supabase.
- Brak uruchomionej regresji auth/invite na dedykowanym projekcie.
