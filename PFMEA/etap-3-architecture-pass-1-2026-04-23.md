# Etap 3 - Architecture Pass 1

Data: 2026-04-23

## Cel

Rozpoczec Etap 3 od realnego rozbijania monolitow, ale bez ruszania UI i bez przepisywania wszystkiego naraz. Pierwszy kandydat: `Projects`.

## Co zostalo zrobione

### 1. Wyodrebnienie typow domenowych

Dodano:

- [src/features/projects/types.ts](</c:/Users/zieada/pfmea-app/src/features/projects/types.ts>)

Przeniesiono tam:

- typy wierszy DB
- typy UI
- typy revision popup
- `UserCtx`
- typy risk matrix
- typ `SiteDepartmentOption`

Efekt:

- `app/projects/page.tsx` nie trzyma juz definicji wszystkich struktur domenowych lokalnie
- latwiej wspoldzielic kontrakty miedzy widokiem a warstwa danych

### 2. Wyodrebnienie helperow i mapperow

Dodano:

- [src/features/projects/utils.ts](</c:/Users/zieada/pfmea-app/src/features/projects/utils.ts>)

Przeniesiono tam:

- `errText`
- formatowanie dat i RPN
- normalizacje tekstu i produktow
- `cellKey`, `clampInt`
- `sectionRevisionFromLabel`
- `emptyRevisionRows`
- `mapProjectsToUiRows`

Efekt:

- logika transformacji i formatowania nie siedzi juz w route page
- mapper UI dla projektow jest osobnym kontraktem, nie przypadkowym kodem wewnatrz komponentu

### 3. Wyodrebnienie warstwy danych

Dodano:

- [src/features/projects/projects-service.ts](</c:/Users/zieada/pfmea-app/src/features/projects/projects-service.ts>)

Przeniesiono tam:

- `fetchProjectsUserContext(...)`
- `fetchProjectSiteDepartments(...)`
- `fetchProjectsWithRevision(...)`
- `createProjectRecord(...)`
- `updateProjectRecord(...)`
- `deleteProjectRecord(...)`
- `fetchRiskMatrixConfig(...)`
- `fetchRiskMatrixCells(...)`

Efekt:

- `app/projects/page.tsx` nie wykonuje juz bezposrednio wszystkich podstawowych operacji Supabase
- warstwa widoku zaczela rozmawiac z service layer zamiast bezposrednio z tabelami w kazdym miejscu

### 4. Przepiecie widoku

Zmieniono:

- [app/projects/page.tsx](</c:/Users/zieada/pfmea-app/app/projects/page.tsx>)

Najwazniejsze efekty:

- widok korzysta z nowych `types`, `utils` i `projects-service`
- zostaly usuniete lokalne definicje typow i czesc lokalnych helperow
- create/update/delete/load dla podstawowych danych projektu sa wyprowadzone poza komponent

## Co to rozwiazuje z audytu

Ten pass odpowiada bezposrednio na:

- monolityczne moduly biznesowe
- rozlana warstwe danych w komponentach
- brak separacji miedzy UI a logika danych
- niski poziom standaryzacji w modulach core

## Czego jeszcze ten pass nie robi

- `Projects` nadal nie jest malym komponentem
- w page nadal siedzi sporo logiki:
  - filtry
  - popup rewizji
  - agregacja PFMEA stats
  - local state dla create/edit
- to jest celowe: ten pass mial byc bezpieczny i niskiego ryzyka

## Walidacja

- `npm run typecheck` - OK
- `npm run lint` - OK
- `npm run build` - OK
- `npm run regression:org:customer-flow` - OK

## Ocena

To jest dobry poczatek Etapu 3, bo:

- zmiana jest realna architektonicznie
- nie jest kosmetyczna
- nie rusza wygladu
- nie rozwala flow organizacyjnych

## Nastepny sensowny krok

Kontynuowac Etap 3 w tej samej strategii:

1. dokonczyc `Projects`
   - wyciagnac PFMEA stats i revision history queries
   - wyciagnac create/edit state do osobnego hooka
2. potem wejsc w `PFD`
   - najpierw session/auth/data bootstrap
   - dopiero pozniej edytor i node handlers

## Decyzja o warstwie UI

Sprawa spojnego stylu calej aplikacji zostaje formalnie wlaczona do Etapu 3.

Decyzja:

- nie robimy tego teraz, w trakcie najciezszych poprawek funkcjonalnych
- najpierw wykonujemy jeszcze 1-2 bezpieczne passy architektoniczne dla duzych modulow
- dopiero potem wchodzimy w osobny strumien:
  - `design tokens`
  - `UI primitives`
  - stopniowa migracja stron do wspolnego systemu

Powod:

- mieszanie duzych zmian funkcjonalnych i duzych zmian wizualnych w jednej iteracji podnosi ryzyko regresji
- po ustabilizowaniu architektury latwiej wyciagac wspolne przyciski, inputy, tabele, bannery i shell sections
- wtedy da sie zrobic to raz i porzadnie, a nie poprawiac kilka razy te same strony

Rekomendowany moment wdrozenia:

- srodek Etapu 3, po ustabilizowaniu `Projects` i pierwszym passsie `PFD`
