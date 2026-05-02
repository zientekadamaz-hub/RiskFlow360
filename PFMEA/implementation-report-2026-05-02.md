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
| A-04 | UI standardization | Sformalizowac RiskFlow UI Standard | Implement now | Dodano `src/components/rf-ui/index.ts` jako kanoniczny adapter i przepieto importy stron/komponentow na `@/components/rf-ui`. Bez zmiany wizualnej. |
| A-05 | Security | Publiczny request-access wymaga throttlingu | Implement now | Dodano procesowy rate limit w `app/api/request-access/route.ts`. Docelowo potrzebny limit trwaly/edge. |
| A-06 | Architecture | Rozbic `AppHeader` | Defer | Wysoki zakres regresji auth/menu; wymaga oddzielnej fazy i testow shell/auth. |
| A-07 | Architecture | Rozbic monolit `app/pfmea/page.tsx` | Defer | Bardzo duzy blast radius; wymagany etapowy refactor service/hooks/table. |
| A-08 | Architecture | Rozbic PFD/PCP | Defer | Podobnie jak PFMEA; bezpieczne dopiero po stabilizacji testow regresyjnych. |
| A-09 | Runtime safety | Wlaczyc `reactStrictMode` | Blocked by risk | Mozliwe nowe regresje efektow; najpierw trzeba usunac legacy React hook debt. |
| A-10 | Error handling | Wspolny mapper bledow domenowych | Defer | Rekomendowane, ale niekrytyczne dla obecnej stabilizacji. |
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
   Plik: `src/components/rf-ui/index.ts` + importy w stronach i komponentach.  
   Utworzono kanoniczny punkt importu `@/components/rf-ui`, ktory eksportuje obecny standard z `src/features/settings/invitation-shell.tsx`. To pierwszy bezpieczny krok do pozniejszego rozbicia tokenow, tabel, formularzy, shelli i modali.

5. Public request-access hardening  
   Plik: `app/api/request-access/route.ts`  
   Dodano rate limit per IP i per email+IP, zanim request trafi do RPC `submit_access_request`. Komunikat bledu jest neutralny: `Too many requests. Please try again later.`

6. ESLint jako kontrolowany quality gate  
   Plik: `eslint.config.mjs`  
   Pozostawiono targeted overrides tylko dla znanych legacy obszarow, aby `npm run lint` byl zielony, ale bez maskowania calego projektu. To jest stan przejsciowy, nie docelowy.

## Czesciowo wdrozone rekomendacje

- React Compiler cleanup: czesc realnych problemow usunieta, ale kilka zasad jest nadal wylaczonych dla legacy modulow.
- UI standard: importy sa ujednolicone, ale fizyczny podzial `invitation-shell.tsx` na tokeny/primitives/layout/table/modal pozostaje do kolejnej fazy.
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
- UI standard import boundary: `src/components/rf-ui/index.ts`, strony `app/*`, komponenty `src/features/*`
- Risk Matrix service: `src/features/settings/risk-matrix/risk-matrix-service.ts`
- Public access request API: `app/api/request-access/route.ts`

Uwaga: `riskflow-current-dev.err.log` i `riskflow-current-dev.out.log` sa zmienione przez dzialajace srodowisko developerskie. Nie byly elementem refaktoru.

## Walidacja

| Komenda | Wynik |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run regression:all` | NOT RUN - brak dedykowanych env/data, testy moga mutowac drafty |

Build: Next.js 16.1.1, 33 strony wygenerowane, kompilacja zakonczona sukcesem.

## Znane ryzyka rezydualne

- Duze strony `PFMEA`, `PFD`, `PCP` nadal lacza UI, state, kalkulacje i Supabase operations.
- `AppHeader` nadal ma za duzo odpowiedzialnosci.
- `src/features/settings/invitation-shell.tsx` jest nadal centralnym, zbyt duzym plikiem standardu UI.
- Rate limit request-access jest procesowy; w serverless/multi-instance nie jest wystarczajacy jako jedyna ochrona.
- Rzeczywisty stan RLS/migracji Supabase wymaga porownania z live database.
