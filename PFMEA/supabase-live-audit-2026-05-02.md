# Supabase live audit - 2026-05-02

Repozytorium: `C:\Users\zieada\pfmea-app`  
Projekt Supabase: `piewgtoldsnyynueztos`  
Tryb: live audit + bezpieczne, inkrementalne remediation.

## Co zostalo wykonane

1. Sprawdzono lokalna konfiguracje Supabase CLI.
2. Uruchomiono `supabase db advisors --linked --level info --fail-on none`.
3. Pobrano snapshot metadanych live DB przez `supabase db query`, bez danych biznesowych.
4. Porownano stan live z ukladem migracji w repo.
5. Wdrożono pierwsza bezpieczna poprawke live: wlaczenie RLS na pustej tabeli testowej `public.codex_test_tmp`.
6. Wdrożono druga bezpieczna poprawke live: jawny `search_path` dla 21 funkcji raportowanych przez Supabase advisors.
7. Wdrożono trzecia bezpieczna poprawke live: 20 indeksow pokrywajacych foreign keys raportowane przez Supabase advisors.
8. Wdrożono czwarta bezpieczna poprawke live: optymalizacja 70 polityk RLS przez zastapienie `auth.uid()` forma `(select auth.uid())`.
9. Wdrożono piata bezpieczna poprawke live: scalenie 3 grup `multiple_permissive_policies`.
10. Usunieto pusty, nieuzywany artefakt testowy `public.codex_test_tmp`, ktory generowal falszywe findings.
11. Naprawiono bledy PL/pgSQL wykryte przez `supabase db lint` w funkcjach administracyjnych i rewizyjnych.
12. Naprawiono niespojnosc Early Access request: status `NEW` jest teraz traktowany jako aktywny request w logice antyduplikacyjnej.
13. Dodano partial unique index dla aktywnych requestow Early Access oraz indeks wspierajacy lookup po emailu i dacie.
14. Zawezono `EXECUTE` dla dwoch RPC, ktore nie wymagaja dostepu roli `authenticated`.
15. Dodano odpowiadajace migracje do `db/` i `supabase/migrations/`.
16. Ponownie uruchomiono platformowe security/performance advisors po poprawkach.
17. Ponownie uruchomiono `supabase db lint --linked`; wynik po zmianach funkcji i Early Access: `No schema errors found`.

## Artefakty

- `PFMEA/supabase-live-advisors-2026-05-02.json` - advisors przed poprawka.
- `PFMEA/supabase-live-advisors-after-remediation-2026-05-02.json` - advisors po poprawce.
- `PFMEA/supabase-live-advisors-after-search-path-2026-05-02.json` - advisors po poprawce `search_path`.
- `PFMEA/supabase-live-advisors-after-fk-indexes-2026-05-02.json` - advisors po dodaniu indeksow FK.
- `PFMEA/supabase-live-advisors-after-rls-initplan-2026-05-02.json` - advisors po optymalizacji RLS initplan.
- `PFMEA/supabase-live-advisors-after-multiple-policies-2026-05-02.json` - finalny advisors po scaleniu polityk.
- `PFMEA/supabase-live-security-advisors-api-after-remediation-2026-05-02.json` - finalny security advisors z Management API.
- `PFMEA/supabase-live-performance-advisors-api-after-remediation-2026-05-02.json` - finalny performance advisors z Management API.
- `PFMEA/supabase-live-db-lint-after-function-remediation-2026-05-02.json` - finalny `supabase db lint`.
- `PFMEA/supabase-live-codex-test-cleanup-verification-2026-05-02.json` - potwierdzenie usuniecia tabeli testowej.
- `PFMEA/supabase-live-lint-function-definitions-query-2026-05-02.sql` - query pobierajace definicje funkcji z bledami lint.
- `PFMEA/supabase-live-lint-function-definitions-2026-05-02.json` - definicje funkcji naprawianych po lint.
- `PFMEA/supabase-live-rpc-execute-privileges-query-2026-05-02.sql` - query audytu uprawnien EXECUTE dla RPC.
- `PFMEA/supabase-live-rpc-execute-privileges-2026-05-02.json` - snapshot uprawnien EXECUTE dla RPC.
- `PFMEA/supabase-live-access-request-duplicates-2026-05-02.json` - potwierdzenie braku aktywnych duplikatow Early Access request.
- `PFMEA/supabase-live-access-request-status-remediation-verification-2026-05-02.json` - potwierdzenie wdrozenia obslugi statusu `NEW`.
- `PFMEA/supabase-live-access-request-index-verification-2026-05-02.json` - potwierdzenie utworzenia indeksow Early Access request.
- `PFMEA/supabase-live-db-lint-after-access-request-remediation-2026-05-02.json` - `db lint` po poprawkach Early Access.
- `PFMEA/supabase-live-security-advisors-api-after-access-request-remediation-2026-05-02.json` - security advisors po poprawkach Early Access.
- `PFMEA/supabase-live-performance-advisors-api-after-access-request-remediation-2026-05-02.json` - performance advisors po poprawkach Early Access.
- `PFMEA/supabase-live-rpc-execute-privileges-after-tightening-2026-05-02.json` - potwierdzenie zawezonych uprawnien RPC.
- `PFMEA/supabase-live-security-advisors-api-after-rpc-tightening-2026-05-02.json` - security advisors po zawezeniu RPC.
- `PFMEA/supabase-live-schema-audit-query-2026-05-02.sql` - query snapshotu.
- `PFMEA/supabase-live-schema-snapshot-2026-05-02.json` - snapshot metadanych public schema.
- `PFMEA/supabase-live-functions-without-search-path-query-2026-05-02.sql` - query do audytu funkcji bez `search_path`.
- `PFMEA/supabase-live-functions-without-search-path-2026-05-02.json` - funkcje przed poprawka `search_path`.
- `PFMEA/supabase-live-functions-without-search-path-after-2026-05-02.json` - funkcje po poprawce `search_path`.
- `PFMEA/supabase-live-unindexed-fk-query-2026-05-02.sql` - query mapujace FK advisors na kolumny.
- `PFMEA/supabase-live-unindexed-fk-columns-2026-05-02.json` - kolumny brakujacych indeksow FK.
- `PFMEA/supabase-live-index-target-sizes-query-2026-05-02.sql` - query rozmiarow tabel przed indeksowaniem.
- `PFMEA/supabase-live-index-target-sizes-2026-05-02.json` - rozmiary tabel przed indeksowaniem.
- `PFMEA/supabase-live-created-fk-indexes-2026-05-02.json` - potwierdzenie utworzenia 20 indeksow.
- `PFMEA/supabase-live-rls-initplan-policies-query-2026-05-02.sql` - query do pobrania 70 polityk RLS.
- `PFMEA/supabase-live-rls-initplan-policies-2026-05-02.json` - polityki RLS przed optymalizacja.
- `PFMEA/supabase-live-rls-initplan-policy-expressions-2026-05-02.txt` - czytelny zrzut wyrazen polityk.
- `PFMEA/supabase-generate-rls-initplan-remediation-query-2026-05-02.sql` - generator migracji RLS initplan.
- `PFMEA/supabase-generated-rls-initplan-remediation-2026-05-02.json` - output generatora.
- `PFMEA/supabase-rls-initplan-remediation-generated-2026-05-02.sql` - wygenerowana migracja RLS.
- `PFMEA/supabase-live-rls-initplan-policy-sanity-2026-05-02.json` - sanity check po RLS initplan.
- `PFMEA/supabase-live-multiple-permissive-policies-2026-05-02.json` - polityki przed scaleniem.
- `PFMEA/supabase-live-multiple-permissive-policy-sanity-2026-05-02.json` - sanity check po scaleniu polityk.
- `db/2026-05-02_supabase_live_security_remediation.sql` - zapis remediation w katalogu SQL.
- `supabase/migrations/20260502084500_live_security_remediation.sql` - zapis remediation w katalogu Supabase CLI.
- `db/2026-05-02_supabase_function_search_path_remediation.sql` - zapis remediation `search_path` w katalogu SQL.
- `supabase/migrations/20260502085500_function_search_path_remediation.sql` - zapis remediation `search_path` w katalogu Supabase CLI.
- `db/2026-05-02_supabase_unindexed_foreign_keys_remediation.sql` - zapis remediation indeksow FK w katalogu SQL.
- `supabase/migrations/20260502090500_unindexed_foreign_keys_remediation.sql` - zapis remediation indeksow FK w katalogu Supabase CLI.
- `db/2026-05-02_supabase_rls_initplan_remediation.sql` - zapis remediation RLS initplan w katalogu SQL.
- `supabase/migrations/20260502092000_rls_initplan_remediation.sql` - zapis remediation RLS initplan w katalogu Supabase CLI.
- `db/2026-05-02_supabase_multiple_permissive_policies_remediation.sql` - zapis remediation multiple permissive policies w katalogu SQL.
- `supabase/migrations/20260502093500_multiple_permissive_policies_remediation.sql` - zapis remediation multiple permissive policies w katalogu Supabase CLI.
- `db/2026-05-02_supabase_drop_codex_test_tmp.sql` - zapis usuniecia pustej tabeli testowej.
- `supabase/migrations/20260502094500_drop_codex_test_tmp.sql` - migracja usuniecia pustej tabeli testowej.
- `db/2026-05-02_supabase_function_lint_remediation.sql` - zapis poprawek funkcji po `db lint`.
- `supabase/migrations/20260502095000_function_lint_remediation.sql` - migracja poprawek funkcji po `db lint`.
- `db/2026-05-02_supabase_access_request_status_remediation.sql` - zapis poprawki statusu `NEW` w `submit_access_request`.
- `supabase/migrations/20260502100500_access_request_status_remediation.sql` - migracja poprawki statusu `NEW`.
- `db/2026-05-02_supabase_access_request_unique_active_index.sql` - zapis indeksow spojnosc/wydajnosc dla Early Access request.
- `supabase/migrations/20260502101000_access_request_unique_active_index.sql` - migracja indeksow Early Access request.
- `db/2026-05-02_supabase_rpc_execute_scope_tightening.sql` - zapis zawezenia `EXECUTE` dla RPC.
- `supabase/migrations/20260502101500_rpc_execute_scope_tightening.sql` - migracja zawezenia `EXECUTE` dla RPC.

Uwaga: `supabase db dump --linked --schema public` nie zadzialal lokalnie, bo Supabase CLI wymaga Docker Desktop do `pg_dump`. Zastosowano `supabase db query` jako bezpieczne obejscie.

## Stan live schema

Snapshot public schema:

- Tables: 33
- Columns: 293
- Policies: 105
- Functions: 45
- Indexes: 70
- Constraints: 277
- Views: 1 (`projects_with_revision`)

Po remediation wszystkie tabele public maja wlaczone RLS albo advisors nie raportuje juz bledu `rls_disabled_in_public`.

## Advisors - przed poprawka

| Level | Count |
|---|---:|
| ERROR | 1 |
| WARN | 119 |
| INFO | 29 |

Jedyny blad:

- `rls_disabled_in_public`: `public.codex_test_tmp` byla publiczna i bez RLS.

Zweryfikowano:

- `public.codex_test_tmp` miala 0 rekordow.
- Kod aplikacji nie referencjonuje tej tabeli.

## Wdrożona poprawka live

Wykonano nie-destrukcyjnie:

```sql
do $$
begin
  if to_regclass('public.codex_test_tmp') is not null then
    alter table public.codex_test_tmp enable row level security;
  end if;
end $$;
```

Potwierdzenie po wykonaniu:

- `public.codex_test_tmp.relrowsecurity = true`
- advisors po remediation: brak `ERROR`

## Advisors - po pierwszej poprawce RLS

| Level | Count |
|---|---:|
| ERROR | 0 |
| WARN | 119 |
| INFO | 30 |

Nowe `INFO` wynika z faktu, ze tabela testowa ma wlaczone RLS, ale nie ma polityk. To jest akceptowalne dla tabeli nieuzywanej i pustej; docelowo lepsze bedzie usuniecie tabeli po swiadomej decyzji.

## Advisors - po poprawce search_path

| Level | Count |
|---|---:|
| ERROR | 0 |
| WARN | 98 |
| INFO | 30 |

Zmiana:

- `function_search_path_mutable`: 21 -> 0
- `functions_without_search_path_after`: 0

Wdrożono jawny `search_path = public, auth, extensions` dla:

- `calculate_rpn`
- `can_edit`
- `can_read`
- `create_org_invitation_as`
- `create_process_revision_and_tag_changes`
- `current_profile_role`
- `get_detection_effective`
- `get_occurrence_effective`
- `get_severity_effective`
- `handle_new_user`
- `has_org_role`
- `is_admin`
- `is_org_admin_or_champion`
- `is_org_member`
- `is_owner_of_edge`
- `is_owner_of_operation`
- `pfmea_calc_scores`
- `set_detection_override_audit`
- `set_occurrence_override_audit`
- `set_severity_override_audit`
- `set_updated_at`

## Advisors - po dodaniu indeksow FK

| Level | Count |
|---|---:|
| ERROR | 0 |
| WARN | 98 |
| INFO | 30 |

Zmiana:

- `unindexed_foreign_keys`: 20 -> 0
- Potwierdzone utworzone indeksy: 20

Przed indeksowaniem sprawdzono rozmiary tabel. Najwieksze tabele docelowe byly male:

- `pfmea_rows`: ok. 953 rekordy, 400 kB
- `control_plan_rows`: ok. 144 rekordy, 136 kB
- `organization_invitations`: ok. 48 rekordow, 128 kB
- `projects`: ok. 46 rekordow, 120 kB

Dlatego migracje wykonano jako zwykle `CREATE INDEX IF NOT EXISTS`, kompatybilne z transakcyjnym `supabase db query`. Pierwsza proba z `CREATE INDEX CONCURRENTLY` zostala odrzucona przez Management API, bo query jest wykonywane w transakcji.

Supabase advisors raportuje teraz wiecej `unused_index` jako `INFO`. To jest oczekiwane bezposrednio po utworzeniu indeksow i nie jest rekomendacja do usuwania.

## Advisors - po optymalizacji RLS initplan

| Level | Count |
|---|---:|
| ERROR | 0 |
| WARN | 28 |
| INFO | 27 |

Zmiana:

- `auth_rls_initplan`: 70 -> 0
- Liczba polityk public pozostal bez zmian: 105

Technika:

- 70 polityk zostalo odtworzonych z tym samym `USING`/`WITH CHECK`.
- Jedyna semantyczna zmiana w wyrazeniach: `auth.uid()` -> `(select auth.uid())`.
- Migracja zostala wygenerowana z live `pg_policies`, sprawdzona liczbowo i wykonana w jednej transakcji.

## Advisors - po scaleniu multiple permissive policies

| Level | Count |
|---|---:|
| ERROR | 0 |
| WARN | 23 |
| INFO | 27 |

Zmiana:

- `multiple_permissive_policies`: 3 -> 0

Scalone obszary:

- `organization_invitations`: usunieto redundantne `org_invites_select`; pozostawiono szersza polityke `org_invites_select_org`, ktora zawierala warunek admin/champion oraz access po email.
- `risk_matrix_cells`: scalono admin/champion access i system default access do jednej polityki `risk_matrix_cells_select`.
- `risk_matrix_config`: scalono admin/champion access i system default access do jednej polityki `risk_matrix_config_select`.

## Cleanup pustej tabeli testowej

`public.codex_test_tmp` zostala usunieta po weryfikacji, ze:

- tabela byla pusta,
- nazwa wskazywala na artefakt testowy,
- kod aplikacji nie zawieral referencji do tej tabeli,
- tabela generowala tylko falszywe findings (`rls_enabled_no_policy`, `no_primary_key`).

Potwierdzenie po wykonaniu:

- `to_regclass('public.codex_test_tmp') = null`

## PL/pgSQL lint remediation

Po remediation Supabase `db lint` wykryl 4 problemy:

- `ensure_process_draft`: nieuzywany parametr `p_user_id`.
- `publish_process_module_revision`: nieuzywany parametr `p_user_id`.
- `admin_create_organization_with_champion`: niejednoznaczne `organization_id` w `on conflict`.
- `create_process_revision_and_tag_changes`: odwolanie do usunietej kolumny `projects.current_revision_id`.

Wdrozone poprawki:

- `p_user_id` jest teraz walidowany przeciwko `auth.uid()` w funkcjach rewizji.
- `admin_create_organization_with_champion` uzywa jawnego `on conflict on constraint organization_members_user_org_unique`.
- `create_process_revision_and_tag_changes` korzysta z obecnego modelu `current_draft_revision_id` / `current_open_revision_id`.
- Funkcja legacy przy publikacji ustawia `current_open_revision_id`, czysci `current_draft_revision_id` i aktualizuje status projektu.

Wynik koncowy:

- `supabase db lint --linked --level warning --fail-on none`: `No schema errors found`.

## Finalny stan platformowych advisors

Security advisors:

| Level | Count |
|---|---:|
| WARN | 25 |

Pozostale security warnings:

- `authenticated_security_definer_function_executable`: 19
- `anon_security_definer_function_executable`: 3
- `auth_leaked_password_protection`: 1

Performance advisors:

| Level | Count |
|---|---:|
| INFO | 26 |

Pozostale performance info:

- `unused_index`: 26

Brak pozostalych `ERROR`. Wczesniejsze `rls_disabled_in_public`, `function_search_path_mutable`, `unindexed_foreign_keys`, `auth_rls_initplan`, `multiple_permissive_policies`, `rls_enabled_no_policy` i `no_primary_key` zostaly wyczyszczone albo usuniete razem z artefaktem testowym.

## Early Access request remediation

Wykryty problem:

- `access_requests.status` ma domyslna wartosc `NEW`.
- Funkcja `submit_access_request` traktowala jako aktywne tylko `PENDING` i `IN_REVIEW`.
- Skutek: aplikacja mogla przyjac ponowny request dla tej samej pary firma + email, jesli poprzedni mial status `NEW`.

Wdrozone poprawki:

- `submit_access_request` sprawdza teraz aktywne statusy `NEW`, `PENDING`, `IN_REVIEW`.
- Przed dodaniem ograniczenia sprawdzono duplikaty aktywnych requestow: brak duplikatow.
- Dodano `access_requests_active_company_email_unique`, partial unique index dla `lower(company_name), lower(requester_email)` przy aktywnych statusach.
- Dodano `access_requests_requester_email_created_at_idx`, indeks wspierajacy ograniczenie jednego requestu per email w 24h.

Wynik:

- `supabase db lint --linked`: `No schema errors found`.
- Indeksy potwierdzone w `pg_indexes`.

## RPC execute scope tightening

Zawezono `EXECUTE` dla:

- `accept_invitation()` bez parametrow: nieuzywana przez aktywny kod aplikacji; tokenowy flow korzysta z `accept_invitation(uuid)`.
- `submit_access_request(...)`: formularz Early Access korzysta z anonimowego endpointu, wiec rola `authenticated` nie potrzebuje bezposredniego RPC access.

Potwierdzenie:

- `accept_invitation()` ma `authenticated_can_execute = false`, `service_role_can_execute = true`.
- `submit_access_request(...)` ma `anon_can_execute = true`, `authenticated_can_execute = false`, `service_role_can_execute = true`.
- Security advisors po zmianie: 25 -> 23 warnings.

Uwaga: proba ponownego `supabase db lint` po samej zmianie grantow zostala zablokowana przez chwilowy `ECIRCUITBREAKER` poolera Supabase. Ostatni pelny lint po zmianach funkcji i Early Access byl czysty, a zmiana grantow nie modyfikuje kodu PL/pgSQL ani schematu tabel.

## Najwazniejsze pozostale findings

### 1. SECURITY DEFINER executable by anon/authenticated

Severity: Medium / expected-by-design for selected flows

Anon callable:

- `activate_invited_user(p_token uuid, p_password text)`
- `get_invitation_preview(p_token uuid)`
- `submit_access_request(...)`

Ocena: to jest intencjonalne dla invite flow i Early Access request flow, ale wymaga ochron dodatkowych: expiry tokenow, brak logowania tokenow, throttling i monitoring. Aplikacyjny rate limit dla `request-access` zostal juz dodany w poprzednim etapie.

Authenticated callable security definer functions: 21. Wymagaja przegladu per function, ale nie sa automatycznie bledem, bo aplikacja korzysta z RPC jako kontrolowanej granicy uprawnien.

### 2. Auth leaked password protection

Severity: Medium

Supabase advisors raportuje `auth_leaked_password_protection`. To ustawienie jest po stronie Supabase Auth, nie w kodzie repo.

Rekomendacja: wlaczyc leaked password protection w Supabase Dashboard/Auth settings, jesli plan pozwala.

## Migracje repo vs live

Stan repo po remediation:

- `db/`: 41 plikow SQL
- `supabase/migrations/`: 14 plikow SQL

Wniosek: nadal istnieja dwa zrodla migracji. Dodana poprawka zostala zapisana w obu miejscach, aby nie zgubic kontekstu, ale docelowo trzeba wybrac jedno kanoniczne zrodlo, najlepiej `supabase/migrations/`, i odtworzyc pelna historie przez schema diff.

## Rekomendowany nastepny krok

1. Utworzyc backup/dump przez Supabase Dashboard albo uruchomic `supabase db dump` na maszynie z Docker Desktop.
2. Przejrzec `SECURITY DEFINER` RPC pod katem minimalnego `EXECUTE` i zdecydowac, ktore moga zostac przeniesione za server route/service role albo ograniczone do wezszych rol.
3. Wlaczyc leaked password protection w Supabase Dashboard/Auth settings, jesli plan pozwala.
4. Po pewnym czasie ruchu przejrzec `unused_index`; nie usuwac nowo dodanych indeksow od razu.

## Update - PFMEA publish performance pass

Data: 2026-05-02 19:45

Nowa poprawka repo:

- Dodano migracje `supabase/migrations/20260502193000_pfmea_publish_with_history_rpc.sql`.
- Funkcja `publish_pfmea_revision_with_history(...)` opakowuje istniejacy `publish_process_module_revision(...)` i zapisuje `pfmea_change_history` w tej samej transakcji.
- Funkcja nie usuwa ani nie zmienia istniejacego kontraktu RPC, wiec jest bezpieczna dla staged rollout.
- Frontend ma fallback do starej sciezki, jesli PostgREST nie zna jeszcze nowej funkcji.

Status live apply:

- `npx supabase db query --linked --file supabase/migrations/20260502193000_pfmea_publish_with_history_rpc.sql` zostal wykonany po dostarczeniu aktywnego tokenu Supabase CLI.
- Funkcja zostala potwierdzona w `pg_proc`.
- Granty: `anon_can_execute = false`, `authenticated_can_execute = true`, `service_role_can_execute = true`.

Ryzyko:

- Niskie dla kodu aplikacji, bo fallback utrzymuje dotychczasowy sposob publikacji.
- Pozostale ryzyko: PostgREST schema cache moze czasem wymagac chwili po dodaniu nowej funkcji; fallback obsluguje ten przypadek.

## Bezpieczenstwo sekretow

Do wykonania audytu uzyto tokenu Supabase i hasla DB w zmiennych procesu. Nie zapisano ich do repo. Poniewaz sekrety byly recznie przekazywane w rozmowie, rekomendowana jest ich rotacja po zakonczeniu prac.
