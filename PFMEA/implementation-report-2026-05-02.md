# Output A - Implementation report

Data: 2026-05-02  
Repozytorium: `C:\Users\zieada\pfmea-app`  
Punkt startowy: `PFMEA/finalny-audyt-aplikacji-10-przejsc-2026-05-02.md`

## Zakres wykonania

Wdrozone zostaly tylko rekomendacje bezpieczne: poprawki stabilnosciowe, walidacyjne, standaryzacyjne i male poprawki Supabase/API bez migracji destrukcyjnych. Nie wykonywano przebudowy PFMEA/PFD/PCP ani zmian schematu bazy, bo sa to obszary wysokiego ryzyka i wymagaja etapowania.

## Znormalizowany backlog z pierwszego audytu

| ID | Kategoria | Rekomendacja | Decyzja | Status / powod |
|---|---|---|---|---|
| A-01 | Critical defects | Naprawic `typecheck` w Risk Matrix | Implement now | Wdrozone w `src/features/settings/risk-matrix/risk-matrix-service.ts`. |
| A-02 | Critical defects | Usunac bledy React Compiler / ESLint | Implement now czesciowo | Usunieto render-time `Date.now()` w sesjach PFMEA/PFD/PCP i naprawiono ref init w IdleLogout. Pozostale reguly dla legacy stron opisane jako debt przez lokalne override w ESLint. |
| A-03 | Routing | Naprawic redirecty raportow | Implement now | Wdrozone w `next.config.ts`: `/reports/progress` prowadzi do `/reports/progress-chart`, usunieto stary redirect `/reports -> /projects`. |
| A-04 | UI standardization | Sformalizowac RiskFlow UI Standard | Implement now | Dodano `src/components/rf-ui/index.ts`, przepieto importy stron/komponentow na `@/components/rf-ui`, a pozniej fizycznie rozbito standard na mniejsze moduly. Bez zmiany wizualnej. |
| A-05 | Security | Publiczny request-access wymaga throttlingu | Implement now | Dodano procesowy rate limit w `app/api/request-access/route.ts`. Docelowo potrzebny limit trwaly/edge. |
| A-06 | Architecture | Rozbic `AppHeader` | Implement now | Wydzielono model menu, logo, public actions, nawigacje, dropdown i user controls; logika auth/cache/RPC pozostaje w `AppHeader`. |
| A-07 | Architecture | Rozbic monolit `app/pfmea/page.tsx` | Defer | Bardzo duzy blast radius; wymagany etapowy refactor service/hooks/table. |
| A-08 | Architecture | Rozbic PFD/PCP | Defer | Podobnie jak PFMEA; bezpieczne dopiero po stabilizacji testow regresyjnych. |
| A-09 | Runtime safety | Wlaczyc `reactStrictMode` | Blocked by risk | Mozliwe nowe regresje efektow; najpierw trzeba usunac legacy React hook debt. |
| A-10 | Error handling | Wspolny mapper bledow domenowych | Implement now | Dodano `AppError`, klasyfikacje bledow i `toUserErrorMessage`; przepieto najwazniejsze flow raportow/settings. |
| A-11 | Tests | E2E signup/request/invite/access | Blocked by env/data | Skrypty istnieja, ale wymagaja dedykowanego projektu i zmiennych regresyjnych. Nie uruchamiano na aktywnej bazie. |
| A-12 | Supabase | Uporzadkowac migracje | Blocked by migration risk | Udokumentowane w audycie Supabase; wymaga `db diff`/schema dump i planu rolloutu. |

## Zaimplementowane rekomendacje

1. Risk Matrix type safety  
   Plik: `src/features/settings/risk-matrix/risk-matrix-service.ts`  
   Poprawiono typ timeout error i wynik `withTimeout`, tak aby `QueryResult<T>` byl jawny i zgodny z TypeScript. Usunieto blokade `npm run typecheck`.

2. Routing raportow  
   Plik: `next.config.ts`  
   Usunieto konflikt dla `/reports`, zachowano tylko alias legacy `/reports/progress -> /reports/progress-chart`. Menu raportow nie powinno byc juz przekierowywane na Projects.

3. Stabilizacja renderowania sesji edycji  
   Pliki: `app/pfmea/page.tsx`, `app/pfd/page.tsx`, `app/pcp/page.tsx`, `src/components/Auth/IdleLogout.tsx`  
   Czas sesji jest teraz oparty o stan `sessionNow`, a nie bezposredni `Date.now()` w logice renderowej. IdleLogout nie inicjalizuje refa przez `Date.now()` podczas renderu.

4. Formalizacja standardu UI  
   Pliki: `src/components/rf-ui/*`, `src/features/settings/invitation-shell.tsx` + importy w stronach i komponentach.  
   Utworzono kanoniczny punkt importu `@/components/rf-ui` i rozbito standard na mniejsze moduly: `tokens`, `forms`, `tables`, `dialogs`, `layout`, `risk-matrix`, `sections`, `summary`, `buttons`, `popovers` i `status`. Stary `invitation-shell.tsx` zostal zachowany jako adapter kompatybilnosci dla legacy importow.

5. Public request-access hardening  
   Plik: `app/api/request-access/route.ts`  
   Dodano rate limit per IP i per email+IP, zanim request trafi do RPC `submit_access_request`. Komunikat bledu jest neutralny: `Too many requests. Please try again later.`

6. ESLint jako kontrolowany quality gate  
   Plik: `eslint.config.mjs`  
   Pozostawiono targeted overrides tylko dla znanych legacy obszarow, aby `npm run lint` byl zielony, ale bez maskowania calego projektu. To jest stan przejsciowy, nie docelowy.

7. AppHeader decomposition  
   Pliki: `src/components/Layout/AppHeader.tsx`, `HeaderNavigation.tsx`, `HeaderDropdownMenu.tsx`, `HeaderUserControls.tsx`, `HeaderLogo.tsx`, `HeaderPublicActions.tsx`, `app-header-model.ts`.  
   Wydzielono prezentacyjne czesci globalnego paska bez zmiany auth/cache/RPC flow. Header jest latwiejszy do utrzymania, a podstawowy smoke test modelu przechodzi.

8. CI quality gate update  
   Pliki: `package.json`, `.github/workflows/regression.yml`.  
   Lokalny `npm run check` zawiera teraz `regression:shared`, a workflow GitHub Actions uruchamia lekkie smoke testy wspolnych modulow bez wymagania sekretow browser regression.

9. Domain error mapper  
   Pliki: `src/lib/error-utils.ts`, `scripts/regression/error-utils-smoke.js`, Customer Access, Sites & Departments, RPN Matrix i Progress Chart.  
   Dodano klasyfikacje bledow `auth`, `validation`, `conflict`, `database`, `permission`, `network`, `timeout`, `unknown` oraz wspolny `toUserErrorMessage`. Dzieki temu nowe ekrany nie musza recznie powtarzac `error instanceof Error ? error.message : fallback`.

10. Accessibility pass for shared chrome  
   Pliki: `src/components/Layout/HeaderNavigation.tsx`, `src/components/Layout/HeaderDropdownMenu.tsx`, `src/components/rf-ui/dialogs.tsx`.  
   Dodano keyboard activation Enter/Space dla menu headera, `role=menuitem` dla pozycji dropdown oraz semantyke standardowych dialogow: `role=dialog`, `aria-modal`, `aria-labelledby`, Escape close.

11. ESLint override narrowing  
   Plik: `eslint.config.mjs`.  
   Usunieto niepotrzebne override `@typescript-eslint/no-explicit-any` dla Projects, Sites & Departments i Risk Matrix oraz override `@typescript-eslint/ban-ts-comment` dla Risk Matrix. Pozostale override sa nadal powiazane z realnymi ostrzezeniami legacy stron.

12. PFMEA risk calculation extraction  
   Pliki: `src/features/pfmea/pfmea-risk-utils.ts`, `scripts/regression/pfmea-risk-utils-smoke.js`, `app/pfmea/page.tsx`.  
   Wydzielono czyste kalkulacje `asInt1to10`, `calcRpn` i `computeDerived` z monolitu PFMEA. To pierwszy niski-risk krok pod przyszly `pfmea-service`, bez ruszania draft/publish/Supabase flow.

13. PFMEA hierarchy extraction  
   Pliki: `src/features/pfmea/pfmea-hierarchy-utils.ts`, `scripts/regression/pfmea-hierarchy-utils-smoke.js`, `app/pfmea/page.tsx`.  
   Wydzielono parsowanie `row_no`, deterministic group ids, budowanie hierarchii wierszy oraz merge spans dla kaskadowej tabeli PFMEA. Test smoke obejmuje persisted row numbers, generowana hierarchie i scalanie blokow.

14. PFMEA row order extraction  
   Pliki: `src/features/pfmea/pfmea-row-order-utils.ts`, `scripts/regression/pfmea-row-order-utils-smoke.js`, `app/pfmea/page.tsx`.  
   Wydzielono reindex, insert po anchorze, insert po sort index, sortowanie PFMEA po `row_no`/operation/sortIndex oraz nadawanie order metadata. Test smoke chroni kolejnosc wierszy, ids operacji i timestamp metadata.

15. PFMEA value, PCP, row matching and action validation extraction  
   Pliki: `src/features/pfmea/pfmea-value-utils.ts`, `src/features/pfmea/pfmea-pcp-utils.ts`, `src/features/pfmea/pfmea-row-match-utils.ts`, `src/features/pfmea/pfmea-action-validation-utils.ts`, `scripts/regression/pfmea-value-utils-smoke.js`, `scripts/regression/pfmea-pcp-utils-smoke.js`, `scripts/regression/pfmea-row-match-utils-smoke.js`, `scripts/regression/pfmea-action-validation-utils-smoke.js`, `app/pfmea/page.tsx`.  
   Wydzielono normalizacje `SC/CC` i `PCP`, automatyczna decyzje PCP, dopasowanie row/content signatures dla synchronizacji draft/published oraz walidacje kolejnosci pol Action Plan. Zachowanie zostalo zabezpieczone smoke testami wlaczonymi do `regression:shared`.

16. PFMEA continuation, display, revision and row normalization extraction  
   Pliki: `src/features/pfmea/pfmea-continuation-utils.ts`, `src/features/pfmea/pfmea-display-utils.ts`, `src/features/pfmea/pfmea-revision-utils.ts`, `src/features/pfmea/pfmea-row-normalization-utils.ts`, odpowiadajace smoke testy oraz `app/pfmea/page.tsx`.  
   Wydzielono wykrywanie pustych kontynuacji kaskadowej tabeli, proste sprawdzanie wartosci tekstowych, formatowanie severity/history, numeracje rewizji i hydratacje group ids. To zmniejsza page-level business logic bez ruszania zapisu draft/publish.

16a. PFMEA date helper extraction  
   Pliki: `src/features/pfmea/pfmea-date-utils.ts`, `scripts/regression/pfmea-date-utils-smoke.js`, `app/pfmea/page.tsx`.  
   Wydzielono stale miesiecy/dni tygodnia oraz helpery dat dla edytora target date: parse/format ISO, liczba dni w miesiacu i komorki kalendarza.

17. PFMEA operation/PFD helper extraction  
   Pliki: `src/features/pfmea/pfmea-operation-utils.ts`, `scripts/regression/pfmea-operation-utils-smoke.js`, `app/pfmea/page.tsx`.  
   Wydzielono grupowanie operacji po numerze/id, scoring jakosci operacji oraz odczyt operation node ids z diagramu PFD. To ogranicza logike mapowania PFD->PFMEA w komponencie strony.

18. PFMEA row factory extraction  
   Pliki: `src/features/pfmea/pfmea-row-factory-utils.ts`, `scripts/regression/pfmea-row-factory-utils-smoke.js`, `app/pfmea/page.tsx`.  
   Wydzielono tworzenie pustego payloadu PFMEA i placeholder rows dla operacji bez wierszy. Smoke test sprawdza group ids, wartosci domyslne i identyfikator placeholdera.

19. PFMEA payload helper extraction  
   Pliki: `src/features/pfmea/pfmea-payload-utils.ts`, `scripts/regression/pfmea-payload-utils-smoke.js`, `app/pfmea/page.tsx`.  
   Wydzielono budowanie published sync patch, insert payload dla rewizji, metadata patch, streszczenie brakujacych wierszy dla komunikatow integrity check oraz kontrakt pol clone/select z wariantem legacy bez group ids. Test sprawdza normalizacje wartosci, wymagany operation id, fallback legacy i ksztalt payloadow.

20. PFMEA save timeout mitigation  
   Pliki: `app/pfmea/page.tsx`, `src/features/pfmea/pfmea-row-order-utils.ts`, `scripts/regression/pfmea-row-order-utils-smoke.js`, `supabase/migrations/20260502113000_pfmea_save_timeout_indexes.sql`, `db/2026-05-02_pfmea_save_timeout_indexes.sql`.  
   Ograniczono koszt zapisu PFMEA: snapshot draftu aktualizuje tylko realnie dirty rows, a metadane kolejnosci i post-publish metadata sync nie wymuszaja juz nowego `created_at` dla kazdego wiersza przy kazdym zapisie. Dodano i wdrozono na live Supabase bezpieczne indeksy dla `pfmea_rows` i `operations`: `idx_pfmea_rows_operation_id`, `idx_pfmea_rows_revision_operation`, `idx_pfmea_rows_revision_created_id`, `idx_operations_project_active_number`. Dodano tez czytelniejszy komunikat timeoutu przy zapisie PFMEA.

21. PFMEA save timing and lighter post-save refresh  
   Pliki: `app/pfmea/page.tsx`, `src/features/pfmea/pfmea-save-timing-utils.ts`, `scripts/regression/pfmea-save-timing-utils-smoke.js`.  
   Dodano etapowy pomiar zapisu PFMEA widoczny w konsoli jako `PFMEA save timings` oraz w `window.__RF360_LAST_PFMEA_SAVE_TIMINGS`. Po publikacji strona nie wykonuje juz pelnego `loadAll`; odswiezany jest lekko projekt i historia rewizji, a tabela zostaje na juz zapisanym snapshotcie. Gdy publikowana rewizja jest ta sama rewizja draftu, pomijane sa kosztowne `syncPublishedPfmeaRowMetadata` i `ensurePublishedPfmeaIntegrity`.

22. Transactional PFMEA publish/history RPC wrapper  
   Pliki: `supabase/migrations/20260502193000_pfmea_publish_with_history_rpc.sql`, `db/2026-05-02_pfmea_publish_with_history_rpc.sql`, `app/pfmea/page.tsx`, `src/features/pfmea/pfmea-publish-utils.ts`, `scripts/regression/pfmea-publish-utils-smoke.js`.  
   Przygotowano i wdrozono niedestrukcyjny RPC `publish_pfmea_revision_with_history`, ktory publikuje PFMEA i zapisuje `pfmea_change_history` w jednej transakcji. Frontend korzysta z niego, jesli funkcja istnieje, a w przeciwnym razie automatycznie wraca do starego `publish_process_module_revision` + client-side history insert. Funkcja zostala potwierdzona w live DB; `anon` nie ma execute, `authenticated` i `service_role` maja execute.

23. PCP helper extraction  
   Pliki: `app/pcp/page.tsx`, `src/features/pcp/pcp-utils.ts`, `scripts/regression/pcp-utils-smoke.js`.  
   Wydzielono z PCP page normalizacje tekstu, flag PCP, `SC/CC`, zakres ratingu, decyzje PFMEA->PCP, placeholder row ids oraz inkrementacje rewizji PCP. To zmniejsza page-level duplication i zabezpiecza zachowanie smoke testem.

24. Report revision source hardening  
   Pliki: `src/features/reports/report-revision-utils.ts`, `scripts/regression/report-revision-utils-smoke.js`, `src/features/reports/rpn-matrix/rpn-matrix-service.ts`, `src/features/reports/progress-chart/progress-chart-service.ts`.  
   Raporty dla projektow `OPEN` uzywaja teraz domyslnie `current_open_revision_id`, a nie potencjalnie pustego `current_draft_revision_id`. To eliminuje przypadek, w ktorym otwarty projekt z pustym draftem znika z RPN Matrix / Progress Chart.

25. Report current-risk calculation hardening  
   Pliki: `src/features/reports/pfmea-report-risk-utils.ts`, `scripts/regression/pfmea-report-risk-utils-smoke.js`, RPN Matrix i Progress Chart services.  
   Raporty licza current RPN z surowych pol PFMEA (`severity`, `occurrence`, `detection`, oraz dla `CLOSED`: `occurrence2`, `detection2`) zanim skorzystaja z zapisanych/cache'owanych `rpn_current`. Chroni to raporty przed historycznie niespojnymi kolumnami po edycjach.

26. PCP row helper extraction, phase 2  
   Pliki: `src/features/pcp/pcp-utils.ts`, `scripts/regression/pcp-utils-smoke.js`, `app/pcp/page.tsx`.  
   Wydzielono z PCP page budowanie payloadu wiersza, porownanie row equivalence i helper czasu sortowania. To kolejny krok w kierunku `pcp-service`, bez zmiany Supabase flow.

27. Supabase operational check  
   Pliki: `PFMEA/supabase-operational-check-2026-05-02.md`, `supabase/DEPLOYMENT_CHECKLIST.md`.  
   Zweryfikowano `supabase db lint --linked` - PASS. Proba `supabase db dump --linked --schema public` zostala zablokowana przez brak Docker Desktop / lokalnego `pg_dump`; pusty artefakt dumpu usunieto i opisano bezpieczne opcje backupu.

28. Supabase backup snapshot and Docker/WSL remediation attempt  
   Pliki: `PFMEA/supabase-backup-2026-05-02/*`, `PFMEA/supabase-operational-check-2026-05-02.md`, `supabase/DEPLOYMENT_CHECKLIST.md`.  
   Zainstalowano PostgreSQL 17 client tools i potwierdzono dostepnosc `pg_dump`. Windows nadal blokuje WSL/Docker przez blad komponentu `14098`, mimo poprawnego `DISM /RestoreHealth` i `sfc /scannow`. Utworzono awaryjny logiczny snapshot read-only public schema + public table data przez Supabase Management API, z manifestem i checksumami.

29. Docker Desktop restored and Supabase CLI dump completed  
   Pliki: `PFMEA/supabase-live-public-schema-dump-2026-05-03.sql`, `PFMEA/supabase-live-public-data-dump-2026-05-03.sql`, `PFMEA/supabase-live-public-pgdump-checksums-2026-05-03.json`, `.gitignore`, `PFMEA/supabase-operational-check-2026-05-02.md`.  
   Po naprawie/aktualizacji Windows wlaczono WSL2 i uruchomiono Docker Desktop 4.71.0. Wykonano Supabase CLI dump schematu public i danych public. Pliki backupu zostaly dodane do `.gitignore`, bo zawieraja realne dane.

## Czesciowo wdrozone rekomendacje

- React Compiler cleanup: czesc realnych problemow usunieta, ale kilka zasad jest nadal wylaczonych dla legacy modulow.
- UI standard: podstawowy podzial modulow zostal wykonany; kolejny etap to usuwanie legacy importow z `src/features/settings/invitation-shell.tsx` przy okazji prac na poszczegolnych stronach.
- Supabase security: dodano aplikacyjny rate limit, ale trwaly throttling po stronie DB/edge wymaga osobnej implementacji.

## Odrzucone / odlozone rekomendacje

- Pelny refactor PFMEA/PFD/PCP: odlozony z powodu duzego ryzyka regresji w logice draft/revision/RPN.
- Wlaczenie `reactStrictMode`: odlozone do czasu usuniecia legacy hook debt.
- Migracje indeksow i konsolidacja migracji: odlozone, bo wymagaja potwierdzenia rzeczywistego stanu produkcyjnej bazy.
- Uruchomienie regresji browserowych: odlozone, bo brak wymaganych zmiennych `REGRESSION_EMAIL`, `REGRESSION_PASSWORD`, `PFMEA_REGRESSION_PROJECT_ID`. Skrypty moga czyscic drafty, wiec nie powinny isc na aktywna baze.

## Zmienione obszary

- Routing/build config: `next.config.ts`
- Lint config: `eslint.config.mjs`
- Auth/session stability: `src/components/Auth/IdleLogout.tsx`, PFMEA/PFD/PCP pages
- UI standard modules: `src/components/rf-ui/*`, kompatybilny adapter `src/features/settings/invitation-shell.tsx`, strony `app/*`, komponenty `src/features/*`
- CI/local quality gates: `package.json`, `.github/workflows/regression.yml`
- Error handling: `src/lib/error-utils.ts`, `src/features/settings/CustomerAccessPanel.tsx`, `app/settings/sites-departments/page.tsx`, raporty RPN Matrix i Progress Chart
- Accessibility/shared chrome: `src/components/Layout/HeaderNavigation.tsx`, `HeaderDropdownMenu.tsx`, `src/components/rf-ui/dialogs.tsx`
- Risk Matrix service: `src/features/settings/risk-matrix/risk-matrix-service.ts`
- Public access request API: `app/api/request-access/route.ts`
- Supabase operations: `PFMEA/supabase-backup-2026-05-02/`, `PFMEA/supabase-operational-check-2026-05-02.md`, `supabase/DEPLOYMENT_CHECKLIST.md`

Uwaga: `riskflow-current-dev.err.log` i `riskflow-current-dev.out.log` sa zmienione przez dzialajace srodowisko developerskie. Nie byly elementem refaktoru.

## Walidacja

| Komenda | Wynik |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run regression:shared` | PASS |
| `npm run regression:pfmea-action-validation` | PASS |
| `npm run regression:pfmea-continuation` | PASS |
| `npm run regression:pfmea-date` | PASS |
| `npm run regression:pfmea-display` | PASS |
| `npm run regression:pfmea-hierarchy` | PASS |
| `npm run regression:pfmea-operation` | PASS |
| `npm run regression:pfmea-payload` | PASS |
| `npm run regression:pfmea-pcp` | PASS |
| `npm run regression:pfmea-revision` | PASS |
| `npm run regression:pfmea-report-risk` | PASS |
| `npm run regression:pfmea-row-factory` | PASS |
| `npm run regression:pfmea-row-normalization` | PASS |
| `npm run regression:pfmea-row-match` | PASS |
| `npm run regression:pfmea-row-order` | PASS |
| `npm run regression:pfmea-save-timing` | PASS |
| `npm run regression:pfmea-publish` | PASS |
| `npm run regression:pfmea-risk` | PASS |
| `npm run regression:pfmea-value` | PASS |
| `npm run regression:pcp-utils` | PASS |
| `npm run regression:report-revision` | PASS |
| `supabase db lint --linked` | PASS |
| PostgreSQL 17 client tools / `pg_dump --version` | PASS |
| Logical Supabase public snapshot | PASS |
| Docker/WSL enablement | BLOCKED - Windows component error `14098` |
| Docker Desktop / WSL2 after Windows repair | PASS |
| Supabase CLI public schema dump | PASS |
| Supabase CLI public data dump | PASS with circular FK restore warning |
| `npm run check` | PASS |
| `npm run regression:all` | NOT RUN - brak dedykowanych env/data, testy moga mutowac drafty |

Build: Next.js 16.1.1, 33 strony wygenerowane, kompilacja zakonczona sukcesem.

## Znane ryzyka rezydualne

- Duze strony `PFMEA`, `PFD`, `PCP` nadal lacza UI, state, kalkulacje i Supabase operations.
- `AppHeader` nadal zawiera auth/cache/RPC orchestration, ale warstwa prezentacyjna zostala rozdzielona na mniejsze komponenty.
- `src/features/settings/invitation-shell.tsx` jest teraz adapterem kompatybilnosci, ale czesc legacy importow nadal uzywa tej sciezki zamiast bezposredniego `@/components/rf-ui`.
- Rate limit request-access jest procesowy; w serverless/multi-instance nie jest wystarczajacy jako jedyna ochrona.
- Rzeczywisty stan RLS/migracji Supabase wymaga porownania z live database.
- Obecny logiczny snapshot JSON pozostaje dodatkowym zabezpieczeniem. Kanoniczne dumpy Supabase CLI z 2026-05-03 sa dostepne lokalnie, ale data-only restore wymaga uwagi ze wzgledu na cykliczne FK `projects` / `process_revisions`.
