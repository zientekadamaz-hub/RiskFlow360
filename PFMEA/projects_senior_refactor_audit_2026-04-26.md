# Projects senior refactor audit - 2026-04-26

## Executive summary

Strona `Projects` została przepisana z dużego, monolitycznego komponentu strony do układu warstwowego zgodnego z kierunkiem senior full-stack:

- `app/projects/page.tsx` jest teraz koordynatorem widoku.
- Pobieranie danych, stan tabeli, edycja rekordów, metryki PFMEA i popupy rewizji są wydzielone do hooków domenowych.
- Render tabeli jest wydzielony do komponentów `ProjectsTable` i `ProjectsTableHeader`.
- Style przycisków, hover wierszy, selectów i delete buttona zostały przeniesione do wspólnej warstwy `app/globals.css`, zamiast pozostawać lokalnym wyjątkiem w stronie.
- Loading strony nie zmienia już całego shellu strony na osobny ekran `Loading projects...`; tabela pokazuje stan ładowania wewnątrz stabilnego layoutu.

Ocena pilota `Projects` po zmianach: **8/10**.

To jest już dobry referencyjny kierunek dla kolejnych ekranów, ale jeszcze nie pełna finalna architektura całej aplikacji.

## Zmiany wykonane

### HIGH - architektura strony

Problem: `Projects` było komponentem łączącym dane, typy, fetchowanie, filtry, edycję, style, popupy i rendering tabeli.

Zmiana:

- Utworzono `src/features/projects/use-projects-data.ts`.
- Utworzono `src/features/projects/use-projects-editor.ts`.
- Utworzono `src/features/projects/use-projects-table-state.ts`.
- Utworzono `src/features/projects/use-projects-risk-summary.ts`.
- Utworzono `src/features/projects/use-projects-pfmea-stats.ts`.
- Utworzono `src/features/projects/use-projects-revision-popups.ts`.
- Utworzono `src/features/projects/ProjectsTable.tsx`.
- Utworzono `src/features/projects/ProjectsTableHeader.tsx`.

Efekt: odpowiedzialności są rozdzielone, a `page.tsx` nie zawiera już całej logiki domenowej i setek linii JSX tabeli.

Status: **rozwiązane częściowo dla modułu Projects, do powtórzenia na PFMEA/PFD/PCP i settings**.

### HIGH - bezpieczeństwo i kontrola organizacji

Problem: operacje na projektach mogły być zbyt łatwo wykonywane bez jednoznacznego ograniczenia po `organization_id`.

Zmiana:

- `createProjectRecord` wymaga aktywnej organizacji.
- `updateProjectRecord` filtruje po `id` oraz `organization_id`.
- `deleteProjectRecord` filtruje po `id` oraz `organization_id`.
- status projektu jest normalizowany przez wspólną ścieżkę.
- statystyki PFMEA są ograniczane do aktualnych projektów.

Efekt: mniejsze ryzyko operacji cross-organization i lepsza zgodność z modelem ról.

Status: **rozwiązane dla Projects po stronie aplikacji; nadal wymagane pełne potwierdzenie RLS w Supabase**.

### MEDIUM - UI standard

Problem: `Projects` miało lokalne definicje stylu przycisków i zachowań tabeli.

Zmiana:

- `.rf-button`, `.rowHover`, `.rowOpen`, `.projectSelect` i `.settings-trash-btn` są teraz w `app/globals.css`.
- tabela korzysta z centralnych stylów settings/project.
- nagłówki tabeli z menu kolumn są wydzielone do `ProjectsTableHeader`.

Efekt: standard jest łatwiejszy do ponownego użycia na kolejnych ekranach.

Status: **rozwiązane częściowo; docelowo warto utworzyć generyczny `SettingsDataTable`**.

### MEDIUM - niezawodność UX

Problem: ekran `Projects` chwilowo pokazywał osobny loading shell z innym stanem nagłówka.

Zmiana:

- usunięto osobny early return dla `uiLoading`.
- stabilny shell strony renderuje się zawsze.
- stan ładowania jest obsługiwany wewnątrz tabeli.

Efekt: mniej layout shift i bardziej profesjonalny start strony.

Status: **rozwiązane dla Projects**.

## Wyniki kontroli jakości

Uruchomiono:

- `npm run typecheck` - PASS
- `npm run lint` - PASS
- `npm run build` - PASS
- HTTP smoke `http://127.0.0.1:3000/projects` - 200
- HTTP smoke `http://127.0.0.1:3000/settings/ui-preview` - 200

Nie uruchomiono:

- pełnych regresji Playwright, bo wymagają przygotowanego scenariusza danych i mogą tworzyć organizacje/użytkowników w Supabase.

## Audyt po zmianach

### Architektura

Ocena: **8/10**

`Projects` ma już sensowny podział na warstwy. Pozostały długie komponenty `ProjectsTable` i `ProjectsTableHeader`, ale nie są już połączone z fetchowaniem, auth i mutacjami. Następny krok to generyczny komponent tabeli dla całej aplikacji.

### TypeScript

Ocena: **8/10**

Brak `any` w obszarze `app/projects` i `src/features/projects` po aktualnym przeglądzie. Typy są przeniesione do `types.ts`, a hooki mają jawne kontrakty.

### Bezpieczeństwo

Ocena: **7/10**

Warstwa aplikacji dla `Projects` lepiej pilnuje organizacji i statusów. Nadal konieczny jest osobny audyt Supabase RLS po stronie bazy, szczególnie dla powiązanych tabel PFD/PFMEA/PCP.

### UI / UX

Ocena: **8/10**

`Projects` jest obecnie najlepszym kandydatem na ekran referencyjny. Standardy są bliżej `ui-preview`, ale część standardu nadal jest specyficzna dla projektu zamiast generyczna.

### Testowalność

Ocena: **7/10**

Kod jest dużo łatwiejszy do testowania po wyjęciu hooków. Brakuje jednak unit/integration tests dla `useProjectsEditor`, sortowania/filtrowania i zabezpieczeń statusów.

## Pozostałe ryzyka

- `ProjectsTable` nadal jest duży i powinien zostać rozbity na `CreateRow`, `EditRow`, `DisplayRow` oraz docelowo wspólny data-table primitive.
- `projects-service.ts` jest nadal duży i warto go podzielić na query/mutation/mapper modules.
- Globalna klasa `.rf-button` porządkuje standard, ale może ujawnić niespójności na starszych stronach, które miały własne lokalne nadpisania.
- Pełny poziom senior dla całej aplikacji wymaga powtórzenia tego wzorca na PFMEA, PFD, PCP i settings.
- Supabase RLS musi zostać zweryfikowane osobnym etapem przed uznaniem aplikacji za produkcyjnie zabezpieczoną.

## Rekomendowane kolejne kroki

1. Rozbić `ProjectsTable` na komponenty wierszy i zbudować wspólny `SettingsDataTable`.
2. Podzielić `projects-service.ts` na `queries`, `mutations`, `mappers`, `validators`.
3. Dodać testy dla `useProjectsTableState`, `useProjectsEditor` i `projects-service`.
4. Przenieść ten sam model architektoniczny na `Severity`, `Occurrence`, `Detection`.
5. Po ekranach settings przejść do PFMEA/PFD/PCP, gdzie ryzyko regresji jest większe.
6. Po domknięciu frontendu wykonać pełny audyt Supabase RLS i funkcji RPC.

## Werdykt

`Projects` po tym przebiegu jest **na poziomie dobrego pilota senior-level**, ale **cała aplikacja nie powinna jeszcze być uznana za w pełni senior full-stack / production-ready**.

Najważniejsza zmiana jakościowa została wykonana: przestaliśmy poprawiać `Projects` ad hoc i zaczęliśmy budować powtarzalny wzorzec dla kolejnych ekranów.
