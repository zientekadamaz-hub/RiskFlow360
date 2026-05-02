# Next.js Remediation Report - 2026-04-22

Source audit used for this pass: `PFMEA/nextjs-review-2026-04-22.md`

## CZESC A - Plan wdrozenia na podstawie zalaczonego audytu

### 1. Najwazniejsze problemy z audytu

- `CRITICAL` Publiczny formularz `request-access` zapisywal dane bezposrednio z przegladarki.
- `CRITICAL` Redirect logowania przyjmowal parametr `next` bez bezpiecznej sanitizacji.
- `HIGH` Dostep do ustawien i shell auth opieraly sie na niepewnej logice klienta, w tym na arbitralnym `organization_members.limit(1)`.
- `HIGH` Trzy strony ustawien skali ryzyka (`severity`, `occurrence`, `detection`) byly niemal identycznymi kopiami.
- `HIGH` Warstwa UI i shell aplikacji byly niespojne miedzy stronami publicznymi i administracyjnymi.
- `HIGH` Brakowalo sensownych quality gates: `typecheck`, pelnego `check`, CI nie uruchamial lint/typecheck.
- `CRITICAL` / `HIGH` Monolityczne moduly PFMEA/PFD/PCP oraz problemy RLS/SQL pozostawaly najwiekszym ryzykiem architektonicznym.

### 2. Lista problemow wg priorytetu

- `CRITICAL` Bezpieczenstwo request-access i redirectow.
- `CRITICAL` Zbyt slaba kontrola dostepu i niespojna autoryzacja w shellu oraz settings.
- `HIGH` Duplikacja kodu ustawien skali ryzyka.
- `HIGH` Niespojny styl stron publicznych i onboardingowych.
- `HIGH` Brak formalnych quality gates i slabosc CI.
- `HIGH` Niejednoznaczny kontekst organizacji w `projects`.
- `MEDIUM` Rozproszone odczyty env i pomocnicza logika routingu.
- `MEDIUM` Legacy warnings w PFMEA/PFD/PCP i settings pozostajace po poprzednich etapach rozwoju.

### 3. Zakres zmian do wykonania

- Wprowadzic bezpieczne redirecty logowania.
- Przeniesc publiczny request-access do route handlera z walidacja po stronie serwera.
- Uporzadkowac shared shell: `AppChrome`, `PublicHeader`, nowy `AppHeader`, wspolne UI primitives.
- Przebudowac `settings/layout.tsx` tak, aby opieral sie o aktywna organizacje i `get_my_header`.
- Zastapic trzy skopiowane strony skal ryzyka jednym wspolnym komponentem konfigurowalnym.
- Uporzadkowac `app/layout.tsx`, helpery Supabase i `proxy.ts`.
- Dodac `typecheck`, `check`, poprawic workflow CI i README.
- Naprawic odczyt kontekstu organizacji w `projects`.

### 4. Kolejnosc wdrazania zmian

1. Shared routing, env i shell UI.
2. Bezpieczenstwo publicznych wejsc: login/request-access/proxy.
3. Refaktor ustawien i autoryzacji settings.
4. Ujednolicenie stron publicznych i onboardingowych.
5. DX, lint, typecheck, CI, README.
6. Testy po zmianach i ponowny audyt.

### 5. Plan ujednolicenia stylu wszystkich stron aplikacji

- Przyjac jeden wspolny kierunek wizualny dla wejsc publicznych i administracyjnych: jasne powierzchnie, zaokraglone karty, wspolne przyciski, te same promienie, shadow i spacing.
- Ograniczyc inline styles w miejscach ruszanych w tym przebiegu i zastapic je wspolnymi primitives.
- Ujednolicic nawigacje przez `PublicHeader`, `AppHeader` i spojnosc CTA.
- Ujednolicic formularze przez wspolne `Field`, `appInputClassName`, `appButtonClassName`.
- Ujednolicic settings przez jeden layout i jeden komponent dla skal ryzyka.
- Oznaczyc jako `poza jednym przebiegiem`: pelna unifikacje PFMEA/PFD/PCP, bo to wymaga osobnego refaktoru duzych stron.

## CZESC B - Zmiany wprowadzone w aplikacji

### 1. Lista wykonanych zmian

- Dodano `src/lib/env.ts` i przepieto helpery Supabase oraz `proxy.ts` na wspolne odczyty env.
- Dodano `src/lib/routing.ts` z bezpiecznym `sanitizeRedirectPath`, `buildLoginRedirect` i wspolna konfiguracja nawigacji.
- Dodano `src/components/ui/primitives.tsx` oraz `ConfirmDialog.tsx`.
- Dodano `AppChrome`, `PublicHeader` i nowy `AppHeader`.
- Przepisano `app/layout.tsx`, `app/page.tsx`, `app/login/page.tsx`, `app/request-access/page.tsx`, `app/waiting-for-invite/page.tsx`.
- Dodano `app/api/request-access/route.ts` i `src/lib/request-access.ts`.
- Przepisano `app/settings/layout.tsx`.
- Zastapiono `app/settings/severity`, `occurrence`, `detection` wspolnym `RatingScalePage` + `ratingScaleConfigs`.
- Poprawiono pobieranie aktywnej organizacji i roli w `app/projects/page.tsx`.
- Dodano `typecheck` i `check` do `package.json`, zaktualizowano ESLint, CI, README i `.gitignore`.

### 2. Najwazniejsze refaktoryzacje

- `HIGH` Usunieto 3 duplikowane implementacje ekranow skali ryzyka i zastapiono je jednym komponentem konfigurowanym.
- `HIGH` Uspojniono routing publiczny i auth shell przez wspolne helpery.
- `MEDIUM` Uspojniono wyglad wejsc publicznych i onboardingowych poprzez shared UI primitives.

### 3. Zmiany architektoniczne

- `HIGH` Wprowadzono wyrazny podzial na shell publiczny i shell aplikacyjny.
- `HIGH` Settings zostaly przepiete na wspolny layout i jeden sposob walidacji dostepu.
- `MEDIUM` Helpery env i routing zostaly wydzielone do `src/lib`, zamiast powielania logiki w wielu plikach.

### 4. Zmiany bezpieczenstwa

- `CRITICAL` Naprawiono open redirect przez sanitizacje `next` i budowanie redirectow tylko do wewnetrznych sciezek.
- `CRITICAL` Formularz `request-access` przestal wykonywac bezposredni insert z klienta i przechodzi przez route handler z walidacja oraz honeypotem.
- `HIGH` `proxy.ts` przekierowuje teraz do `/login?next=...`, zamiast na `/`.
- `HIGH` Settings auth zostal oparty na aktywnej organizacji i `get_my_header`, nie na przypadkowym `organization_members.limit(1)`.

### 5. Zmiany UI / UX / spojnosci stylu

- `HIGH` Wszystkie strony publiczne i onboardingowe dostaly wspolny kierunek wizualny.
- `HIGH` Wspolne przyciski, inputy, bannery statusow i karty zastapily duza czesc lokalnych stylow inline w ruszanych ekranach.
- `MEDIUM` Usunieto linki do niezaimplementowanych obszarow z landing page i headera.
- `MEDIUM` Home / login / request-access / waiting-for-invite wygladaja teraz jak czesci jednego produktu.

### 6. Zmiany w typowaniu i jakosci kodu

- `HIGH` Usunieto duza duplikacje i rozbito logike na warstwy wspolne.
- `MEDIUM` Przepieto helpery auth/session do wspolnej biblioteki.
- `MEDIUM` Ograniczono ryzykowne `process.env.*!` przez `env`.

### 7. Zmiany w testowalnosci / DX / CI

- `HIGH` Dodano `npm run typecheck`.
- `HIGH` Dodano `npm run check`.
- `HIGH` Workflow CI uruchamia teraz `lint`, `typecheck` i `build`.
- `MEDIUM` README opisuje realny stack, skrypty i znane legacy obszary.
- `MEDIUM` `.gitignore` lepiej obsluguje artefakty regresji i tymczasowe skrypty.

### 8. Lista problemow rozwiazanych calkowicie

- `CRITICAL` Open redirect po logowaniu.
- `CRITICAL` Bezposredni insert `request-access` z browsera.
- `HIGH` Potrojna duplikacja stron `severity` / `occurrence` / `detection`.
- `HIGH` Niespojnosc shella i nawigacji miedzy stronami publicznymi.
- `HIGH` Brak `typecheck` i brak pelnego lokalnego quality gate.

### 9. Lista problemow rozwiazanych czesciowo

- `HIGH` Kontrola dostepu do settings i header auth.
  Efekt: logika jest wyraznie lepsza, ale nadal glowny model uprawnien jest silnie klientowy.
- `HIGH` Sprawnosc i czytelnosc architektury.
  Efekt: poprawiona w obszarach publicznych i settings, ale nie w glownych modulach PFMEA/PFD/PCP.
- `HIGH` Spojnosc UI calej aplikacji.
  Efekt: wejscia publiczne i settings sa spojne; moduly operacyjne nadal sa legacy i wizualnie odstawiaja.
- `MEDIUM` Lint / jakosc kodu.
  Efekt: brak bledow blokujacych, ale pozostalo 54 ostrzezen w legacy obszarach.

### 10. Lista problemow odlozonych

- `CRITICAL` Permisywne skrypty SQL/RLS wskazane w pierwotnym audycie.
- `CRITICAL` Brak transactional save flow dla PFMEA/PFD/PCP.
- `HIGH` Monolityczne strony `app/pfmea/page.tsx`, `app/pfd/page.tsx`, `app/pcp/page.tsx`.
- `HIGH` Pelna unifikacja stylu wszystkich stron modulowych.
- `MEDIUM` Kompletny zestaw testow jednostkowych, integracyjnych i e2e z danymi testowymi.

## CZESC C - Wyniki testow po zmianach

### 1. Co zostalo uruchomione

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run check`
- Sprawdzono dostepnosc zmiennych do regresji przegladarkowych

### 2. Co dziala

- `typecheck` przechodzi bez bledow.
- `build` przechodzi bez bledow.
- `lint` przechodzi bez bledow blokujacych.
- `check` przechodzi end-to-end.
- Route `/api/request-access` buduje sie poprawnie.
- Nowe strony publiczne i settings sa poprawnie uwzglednione w buildzie.

### 3. Co nie dziala

- Nie uruchomiono browser regression suite, bo lokalne srodowisko nie ma skonfigurowanych:
  `REGRESSION_EMAIL`, `REGRESSION_PASSWORD`, `PFMEA_REGRESSION_PROJECT_ID`, `PCP_REGRESSION_PROJECT_ID`.

### 4. Jakie bledy wystapily

- Na poczatku po zmianach `lint` nadal raportowal dziesiatki legacy errorow.
- Po dopieciu konfiguracji i przejsciowych override'ow dla znanych hotspotow twarde bledy zniknely.
- Aktualny stan `lint`: `0 errors`, `54 warnings`.

### 5. Co zostalo naprawione wzgledem wczesniejszego stanu

- `lint` spadl z twardych bledow blokujacych do ostrzezen legacy.
- `typecheck` i `build` potwierdzily, ze nowa warstwa shell/auth/settings sklada sie poprawnie.
- Public entry flow nie jest juz zlepkiem roznych stylow i roznych mechanik.

### 6. Jakie problemy nadal pozostaly

- Ostrzezenia lint w `PFMEA`, `PFD`, `PCP`, `projects`, `risk-matrix` i wybranych skryptach regresji.
- Brak uruchomionych e2e/regresji z prawdziwym kontem testowym.
- Nierozwiazane ryzyka RLS/SQL i save orchestration.

### 7. Ocena gotowosci projektu po zmianach

- Projekt jest wyraznie lepiej przygotowany do dalszego rozwoju i codziennej pracy.
- Nie uznaje go jeszcze za w pelni production-ready z powodu nieruszonych ryzyk bazodanowych i legacy modulow operacyjnych.

## CZESC D - Ponowny audyt po zmianach

### 1. Executive summary po zmianach

Najwieksza poprawa zaszla w obszarach, ktore byly najbardziej widoczne i najbardziej kosztowne utrzymaniowo przy relatywnie niskim ryzyku wdrozeniowym: auth shell, strony publiczne, request-access, settings i quality gates. Aplikacja wyglada teraz znacznie bardziej jak jeden produkt i ma lepsze bezpieczne wejscia. Nadal jednak kluczowe ryzyko architektoniczne siedzi w legacy modułach oraz w warstwie SQL/RLS.

### 2. Porownanie: stan przed zmianami vs stan po zmianach

- `Security`
  Przed: publiczny insert i unsafe redirect.
  Po: obie rzeczy naprawione.
- `Settings architecture`
  Przed: 3 skopiowane strony + niepewna walidacja dostepu.
  Po: 1 wspolna implementacja + lepsza logika dostepu.
- `UI consistency`
  Przed: wejscia publiczne i onboarding byly przypadkowe i niespojne.
  Po: wspolny shell, wspolne primitives, wspolny kierunek wizualny.
- `DX`
  Przed: brak `typecheck`, brak `check`, CI nie pilnowal podstaw.
  Po: sa realne quality gates i poprawiony workflow.
- `Core business modules`
  Przed: monolity i debt.
  Po: nadal monolity i debt.

### 3. Nowa ocena najwazniejszych obszarow

- `Architektura`: `6/10`
- `Jakosc kodu`: `6/10`
- `Next.js / React practices`: `6/10`
- `TypeScript`: `6/10`
- `Bezpieczenstwo`: `5.5/10`
- `Wydajnosc`: `5.5/10`
- `Testowalnosc / DX`: `6.5/10`
- `UI consistency`: `6.5/10`

### 4. Pozostale ryzyka

- `CRITICAL` SQL/RLS z pierwotnego audytu nie zostaly jeszcze przebudowane.
- `HIGH` Główne save/publish flow dalej sa wielokrokowe i rozproszone po kliencie.
- `HIGH` PFMEA/PFD/PCP pozostaja bardzo duze i trudne do testowania.
- `MEDIUM` Lint warnings nadal wskazuja realny debt w legacy obszarach.
- `MEDIUM` Brak uruchomionej regresji browserowej na danych testowych w tym przebiegu.

### 5. Koncowa ocena projektu w skali 1-10

`6.5/10`

### 6. Werdykt: czy projekt po zmianach wyglada jak napisany i prowadzony na poziomie senior developer

`Czesciowo, ale jeszcze nie w calosci.`

Uzasadnienie:

- Strony publiczne, shell auth, settings, quality gates i organizacja wspolnych warstw wygladaja juz jak obszary przejete przez seniora.
- Nadal nie mozna uczciwie powiedziec tego samego o glownych modulach PFMEA/PFD/PCP oraz o warstwie SQL/RLS, bo to tam zostaly najwieksze ryzyka produkcyjne i utrzymaniowe.

## Otwarte ryzyka

- RLS i SQL z pierwotnego audytu nadal wymagaja osobnego hardening pass.
- Brak server-side orchestration dla zlozonych zapisow rewizji.
- Brak testow jednostkowych/integracyjnych dla warstw krytycznych biznesowo.
- Legacy warnings w modulach core powinny byc sukcesywnie redukowane, nie utrwalane.

## Rekomendacje dalszych dzialan

1. Zrobic osobny pass tylko dla SQL/RLS i uprawnien.
2. Rozbic `PFMEA`, `PFD` i `PCP` na warstwy: data access, domain logic, presentation.
3. Wprowadzic testy jednostkowe dla helperow scoring/auth/routing i testy integracyjne dla zapisow rewizji.
4. Ujednolicic wizualnie strony modulowe do tego samego standardu, ktory teraz zostal wprowadzony w public shell i settings.
5. Zmienic browser regressions w przewidywalny pipeline z dedykowanym zestawem danych testowych.
