# Senior Full Stack Audit - RiskFlow 360 / PFMEA App

Data audytu: 2026-04-28  
Audytowany workspace: `C:\Users\zieada\OneDrive - Watlow\Pulpit\APP\pfmea-app`  
Folder zapisu raportu: `C:\Users\zieada\pfmea-app\PFMEA`

## Zakres i ograniczenia

Przeanalizowano strony w `app/**/page.tsx`, globalny layout, header, guardy auth, widoczne integracje Supabase oraz skrypty SQL w `db`. Uruchomiono też podstawową walidację techniczną:

- `npx tsc --noEmit --pretty false` - przechodzi.
- `npm run lint` - nie przechodzi: 306 problemów, w tym 236 błędów.
- Publiczne widoki sprawdzono Playwrightem na desktop/mobile.

Ograniczenie: brak danych konta testowego w `.env.local`, dlatego chronione widoki PFD/PFMEA/PCP/Settings oceniono głównie z kodu i struktury logiki. Dodatkowo wykryto dwie kopie repozytorium: bieżący workspace w OneDrive oraz `C:\Users\zieada\pfmea-app`. Lokalny render dev servera korzystał częściowo z artefaktów/ścieżek drugiej kopii, co ogranicza wiarygodność testu wizualnego bez uporządkowania środowiska.

## Najważniejsze problemy globalne

### 1. Krytyczny - zbyt szerokie RLS i uprawnienia Supabase

Plik `db/control_plan_rows_rls.sql` zawiera pełne uprawnienia dla `anon`, `authenticated` i `service_role`:

- `grant select, insert, update, delete on table public.control_plan_rows to anon, authenticated, service_role`
- polityki `using (true)` / `with check (true)`

W plikach `db/pfd_editing.sql`, `db/pfmea_editing.sql`, `db/pcp_editing.sql` wiele polityk ogranicza dostęp tylko do `auth.uid() is not null`, bez sprawdzenia organizacji, projektu, roli i członkostwa. Przy aplikacji wieloorganizacyjnej to jest najwyższe ryzyko bezpieczeństwa.

Rekomendacja: przenieść mutacje domenowe do RPC z walidacją `organization_members`, `project.organization_id`, roli i ownership locka. RLS powinno być least privilege, bez `anon` dla danych produkcyjnych.

### 2. Wysoki - niespójne środowisko i dwie kopie repozytorium

W systemie istnieją co najmniej dwie kopie:

- `C:\Users\zieada\OneDrive - Watlow\Pulpit\APP\pfmea-app`
- `C:\Users\zieada\pfmea-app`

Katalog `.next` w audytowanym workspace jest reparse point, a dev server renderował stack trace z `C:\Users\zieada\pfmea-app`. W praktyce można testować inną wersję kodu niż ta, którą się edytuje.

Rekomendacja: wybrać jedno repo jako źródło prawdy, usunąć albo odłączyć stare `.next`, zatrzymać stare procesy dev servera, uruchamiać `npm run dev` tylko z właściwego katalogu.

### 3. Wysoki - responsywność jest niespójna

Najbardziej widoczne przypadki:

- Home używa `grid-cols-6` dla modułów, co powoduje poziomy overflow na mobile.
- Login i Request Access mają formularze `gridTemplateColumns: '1fr 1fr'` bez breakpointów.
- PFMEA/PCP/PFD używają bardzo szerokich fixed-width tabel/canvasów bez pełnoprawnego mobile fallback.

Rekomendacja: dodać mobile layouts: single-column forms, card view dla tabel listowych, read-only/mobile viewer dla dużych arkuszy i canvasów.

### 4. Wysoki - nawigacja prowadzi do nieistniejących tras

Header linkuje do:

- `/task-management`
- `/reports/progress`

Home komunikuje moduły:

- `/actions`
- `/reports`

W bieżącym workspace nie ma odpowiadających im stron. To generuje 404 albo mylące redirecty.

Rekomendacja: ukryć niedostarczone moduły albo dodać placeholder route z jasnym komunikatem "Coming soon". Lepiej nie pokazywać modułów jako aktywnych funkcji, jeśli nie istnieją.

### 5. Średni - brak spójnego design systemu

Style są masowo inline, a `.rf-button`, card, modal, table, input i status states są definiowane wielokrotnie w różnych plikach. To utrudnia spójność, accessibility i utrzymanie.

Rekomendacja: utworzyć wspólne komponenty:

- `Button`
- `Input`
- `Select`
- `Modal`
- `ConfirmDialog`
- `DataTable`
- `StatusMessage`
- `PageShell`

## Audyt stron

## Home `/`

Cel strony: landing i wejście do modułów aplikacji.

### Ocena UI

Desktop wygląda atrakcyjnie i czytelnie, ale layout modułów jest zbyt sztywny. Hero ma mocny kontrast i realny obraz w tle, co działa dobrze dla strony wejściowej. Problemem jest mobile: karty modułów nie zawijają się do jednej kolumny.

### Ocena funkcjonalności

Strona komunikuje główne moduły, ale część linków prowadzi do nieistniejących funkcji. To obniża zaufanie użytkownika.

### Problemy

- Wysoki: `grid-cols-6` powoduje overflow na mobile.
- Wysoki: moduły Actions i Reporting są pokazane jak gotowe, ale brak routów.
- Niski: `<img>` zamiast `next/image`, co może pogorszyć LCP.
- Niski: `html lang="en"` przy mieszanym polsko-angielskim UI.

### Rekomendacje

- Zmienić moduły na `grid-cols-1 sm:grid-cols-2 xl:grid-cols-6`.
- Ukryć albo oznaczyć niedostępne moduły.
- Użyć `next/image` dla obrazów.
- Ustalić jeden język interfejsu lub przygotować i18n.

## Login `/login`

Cel strony: logowanie i tworzenie konta.

### Ocena UI

Prosty układ i czytelne pola, ale formularz dwukolumnowy jest nieergonomiczny na mobile. W widoku pojawia się techniczne "Redirect after success", co wygląda jak debug info.

### Ocena funkcjonalności

Logowanie używa `supabase.auth.signInWithPassword`, signup używa `supabase.auth.signUp`. Dla aplikacji invite-only publiczne tworzenie konta może być sprzeczne z modelem dostępu.

### Problemy

- Wysoki: `next` redirect jest używany w `window.location.assign` bez widocznej walidacji lokalnej ścieżki.
- Średni: publiczny signup może pozwalać tworzyć konta poza procesem zaproszeń.
- Średni: brak obsługi forgot/reset w bieżącym pliku audytowanego workspace.
- Średni: formularz nie przełącza się na jedną kolumnę na mobile.
- Niski: techniczne "Redirect after success".

### Rekomendacje

- Dodać helper `getSafeRedirectTarget`.
- Rozdzielić login od aktywacji zaproszenia.
- Usunąć debug copy z UI.
- Zastosować responsive grid.

## Request Access `/request-access`

Cel strony: zgłoszenie firmy i prośby o dostęp.

### Ocena UI

Na desktopie karta jest czytelna. Na mobile pola i przycisk są ucinane, bo formularz używa stałej dwukolumnowej siatki.

### Ocena funkcjonalności

Formularz insertuje dane do `access_requests`. Minimalna walidacja jest zbyt słaba.

### Problemy

- Wysoki: ucięty mobile layout.
- Średni: walidacja email to tylko `includes('@')`.
- Średni: brak widocznego rate limitu / ochrony przed spamem.
- Średni: `requestedInvites` przyjmuje dowolnie dużą liczbę i dopiero robi `Math.floor`.

### Rekomendacje

- Jedna kolumna na mobile.
- Walidacja schematem: email, company length, invite count min/max.
- Backend constraint i ewentualnie CAPTCHA/rate limit.
- Przyjazne komunikaty dla duplikatów.

## Waiting For Invite `/waiting-for-invite`

Cel strony: akceptacja zaproszenia dla zalogowanego użytkownika.

### Ocena UI

Prosta i zrozumiała karta, ale użytkownik nie widzi szczegółów zaproszenia ani organizacji.

### Ocena funkcjonalności

Wywołuje `accept_invitation`. Niespójność: `IdleLogout` traktuje stronę jako publiczną, ale `proxy.ts` nie ma jej na liście public paths.

### Problemy

- Wysoki: niespójna ochrona routingu między `proxy.ts` i `IdleLogout`.
- Średni: brak preview organizacji/roli z zaproszenia.
- Średni: brak tokenowego flow w bieżącej wersji pliku.

### Rekomendacje

- Ujednolicić public/protected route list.
- Dodać preview zaproszenia.
- Obsłużyć wygasłe/zużyte zaproszenie osobnym stanem.

## Projects `/projects`

Cel strony: zarządzanie projektami, filtracja, wejście do PFD/PFMEA/PCP.

### Ocena UI

To najbardziej "dashboardowa" strona. Ma filtry, statystyki, tabelę i akcje. Wizualnie pasuje do reszty ciemnego motywu domenowego, ale jest mocno złożona i oparta na fixed table layout.

### Ocena funkcjonalności

CRUD projektów, statusy, delete confirmation i linki do modułów są obecne. Filtry zapisywane są w `localStorage`.

### Problemy

- Wysoki: mutacje są wykonywane po stronie klienta, więc bezpieczeństwo zależy od RLS.
- Średni: plik ma 2283 linie i miesza fetch, transformacje, filtry, UI, confirm modal.
- Średni: brak pełnego mobile table/card view.
- Średni: statusy i site/department są walidowane głównie w UI.
- Niski: filters storage nie ma wersjonowania schematu.

### Rekomendacje

- Wydzielić `ProjectsTable`, `ProjectFilters`, `ProjectForm`, `RevisionPopover`.
- Mutacje przenieść do RPC/server actions.
- Dodać paginację i/lub lazy stats dla dużej liczby projektów.
- Dodać mobile card list.

## PFD `/pfd`

Cel strony: edytor Process Flow Diagram na ReactFlow.

### Ocena UI

Canvasowy desktop UI ma sens: sidebar narzędzi, diagram i panele pomocnicze. Mobile nie jest realnie obsłużony, bo strona jest projektowana jako full-screen desktop tool.

### Ocena funkcjonalności

Obsługuje edit sessions, drafts, history, operacje ReactFlow, mini PFMEA i zapis rewizji. To dużo funkcji w jednym komponencie.

### Problemy

- Wysoki: usuwanie operacji może usuwać `pfmea_rows` po `operation_id` bez transakcyjnego procesu.
- Wysoki: lock edycji jest client-driven przez `pfd_edit_sessions`.
- Średni: sidebar ma stałą szerokość około 198 px i brak mobile fallback.
- Średni: PFD ma 2938 linii i miesza diagram, sesje, mini PFMEA, modale, historię.
- Średni: część operacji powinna być atomowa w DB.

### Rekomendacje

- Dodać RPC dla zmian diagramu i operacji.
- Lock egzekwować w DB.
- Rozbić plik na `PfdCanvas`, `PfdToolbar`, `PfdEditSession`, `PfdHistoryModal`, `PfdMiniPfmeaPanel`.
- Dodać read-only mobile viewer.

## PFMEA `/pfmea`

Cel strony: główna tabela PFMEA, ryzyka, akcje, rewizje, drafty, powiązanie PCP.

### Ocena UI

Najbardziej funkcjonalny ekran, ale bardzo ciężki. Tabela jest arkuszem o stałych szerokościach kolumn i rozbudowanych custom cell editors. Działa jako desktop spreadsheet, nie jako responsywny widok.

### Ocena funkcjonalności

Dużo logiki jest kompletnej: draft, publish, safety backup, revision history, dirty draft marker, continuation rows, wyliczenia RPN/OxD. Ryzykiem jest liczba ścieżek mutacji i brak jednej transakcyjnej warstwy domenowej.

### Problemy

- Wysoki: plik ma 7271 linii - bardzo wysoki koszt utrzymania.
- Wysoki: wiele `delete/insert/update` na `pfmea_rows` wykonywanych z klienta.
- Wysoki: publish revision składa się z wielu kroków, podatnych na częściowy zapis.
- Średni: tabela fixed-width, brak mobilnego UX.
- Średni: dirty state w `sessionStorage` nie rozwiązuje w pełni konfliktów między kartami.
- Średni: wiele custom popupów/selectów bez jednolitego accessibility contract.

### Rekomendacje

- Wydzielić warstwy: data access, row hierarchy, table model, cell editors, revision workflow.
- Publikację rewizji przenieść do RPC/transakcji.
- Dodać virtualization dla tabeli.
- Ujednolicić modal/dropdown/cell editor accessibility.

## PCP `/pcp`

Cel strony: Process Control Plan powiązany z PFMEA.

### Ocena UI

Spójna wizualnie z PFMEA, choć mniej rozbudowana. Nadal jest to fixed-width arkusz desktopowy.

### Ocena funkcjonalności

Obsługuje edit sessions, generowanie/ładowanie control plan rows, save revision i history. Wykryto nieużywany `deleteRow`, mimo że istnieje implementacja.

### Problemy

- Wysoki: operacje na `control_plan_rows` są szczególnie ryzykowne przy obecnym RLS.
- Średni: `deleteRow` jest zgłaszany przez lint jako nieużyty.
- Średni: `window.confirm` jest niespójny z resztą modal UX.
- Średni: React lint zgłasza synchroniczne `setVal(props.value)` w efekcie komórki.
- Średni: nieużywane zmienne (`loading`, `ops`, `useRef`) wskazują na niedokończony refactor.

### Rekomendacje

- Naprawić/wyjaśnić delete UX.
- Zastąpić `window.confirm` wspólnym `ConfirmDialog`.
- Przenieść mutacje do RPC.
- Refactor cell editors, aby spełniały reguły React Compiler.

## Settings: Sites & Departments

Cel strony: zarządzanie site/department w organizacji.

### Ocena UI

Prosta tabela i karta organizacji. Desktop OK, mobile słaby.

### Ocena funkcjonalności

Pozwala dodać, edytować, usunąć site i toggle active. Edycja site robi delete wszystkich starych rekordów i insert nowych.

### Problemy

- Wysoki: delete + insert bez transakcji może zostawić dane częściowo skasowane.
- Średni: mobile table brak.
- Niski: uszkodzone polskie znaki w kilku komunikatach.

### Rekomendacje

- RPC `replace_site_departments`.
- Optimistic rollback.
- Walidacja unikalności site/department w DB.
- Naprawić encoding.

## Settings: Risk Matrix

Cel strony: konfiguracja macierzy ryzyka manual/RPN.

### Ocena UI

Matrix jest czytelny na desktopie, choć ma dużo małych pól. Na mobile wymaga scrolla poziomego.

### Ocena funkcjonalności

Auto-save manual cells i config działa koncepcyjnie, ale brakuje wyraźnego statusu zapisu.

### Problemy

- Średni: brak statusu `saving/saved/failed`.
- Średni: progi RPN są auto-korygowane bez jasnego feedbacku.
- Niski: nieużywane style/zmienne.
- Niski: uszkodzony tekst `Loadingâ€¦`.

### Rekomendacje

- Dodać save status i retry.
- Walidować progi przed zapisem i pokazywać korekty.
- Wydzielić `RiskMatrixGrid` i `RiskThresholdEditor`.

## Settings: Severity / Occurrence / Detection

Cel stron: konfiguracja skali S/O/D.

### Ocena UI

Strony są spójne między sobą, ale to głównie efekt kopiowania. Tabele są czytelne na desktopie.

### Ocena funkcjonalności

Każda strona ładuje defaulty, pozwala upsertować override i usuwać override. Timeout query to 1800 ms.

### Problemy

- Wysoki: trzy prawie identyczne pliki po około 834 linie.
- Średni: timeout 1800 ms może powodować fałszywe błędy.
- Średni: reset/delete override nie ma pełnego kontekstu audytowego.
- Niski: powtarzane style i logika cache/session.

### Rekomendacje

- Jeden komponent `ScaleSettingsPage`.
- Konfiguracja per scale: table, defaults, labels, RPC/table names.
- Dłuższy timeout lub retry state.
- Historia zmian dla audit trail.

## Settings: Invitations

Cel strony: zarządzanie zaproszeniami, rolami i limitem licencji.

### Ocena UI

Funkcjonalnie kompletna strona administracyjna. Kodowo duży monolit.

### Ocena funkcjonalności

Obsługuje licencję, liczbę miejsc, filtry, zapraszanie, edycję, dezaktywację/usuwanie. Kluczowe walidacje muszą być po stronie DB.

### Problemy

- Wysoki: limity licencji i role nie mogą polegać na UI.
- Średni: wiele mutacji klient -> Supabase bez jednej warstwy domenowej.
- Średni: plik ma 1117 linii.
- Średni: cache sessionStorage może pokazać chwilowo stare dane.

### Rekomendacje

- RPC `send_invitation`, `update_invitation`, `revoke_invitation`.
- DB constraints na email/org/status.
- Wydzielić komponenty: summary cards, invite form, filters, table, confirm modal.

## Header / Layout / Auth

### Problemy

- Wysoki: linki do niedostarczonych tras.
- Średni: menu dropdown używa `span role="button"` bez pełnej obsługi Enter/Space.
- Średni: header ma globalną klasę `.rf-button`, która może kolidować z lokalnymi definicjami stron.
- Średni: `BrowserSessionGuard` może wylogować użytkownika przy odtworzeniu sesji, jeśli nie widzi aktywnych kart.
- Niski: `AuthGuard` nic nie robi i może mylić przyszłych developerów.

### Rekomendacje

- Używać prawdziwych `<button>` dla menu.
- Ujednolicić route registry.
- Zastąpić globalne `.rf-button` komponentem.
- Dopisać testy dla session guard / idle logout.

## Jakość implementacji

### Wyniki narzędzi

- TypeScript: OK.
- ESLint: FAIL, 306 problemów.

Najważniejsze kategorie lint:

- `@typescript-eslint/no-explicit-any` w wielu stronach domenowych.
- `@typescript-eslint/no-require-imports` w skryptach regresji i plikach tmp.
- `react-hooks/exhaustive-deps` w headerze.
- React Compiler warning: synchroniczne setState w efektach komórek.
- `@next/next/no-img-element`.

### Ryzyka architektoniczne

- Duże pliki stron: PFMEA 7271 linii, PFD 2938, Projects 2283, PCP 1526.
- Brak warstwy domenowej między UI a Supabase.
- Mutacje rozproszone po komponentach.
- Brak spójnego design systemu.
- Brak spójnego wzorca loading/empty/error/save states.
- Brak pełnych testów E2E dostępnych bez specjalnego środowiska.

## Quick Wins

1. Naprawić RLS dla `control_plan_rows` i polityki `*_all_auth`.
2. Usunąć/ukryć martwe linki do `/actions`, `/reports`, `/reports/progress`, `/task-management`.
3. Naprawić mobile layout Home, Login, Request Access.
4. Uporządkować dwie kopie repo i `.next`.
5. Skonfigurować ESLint overrides dla `scripts/**/*.js` i `tmp-*.js`.
6. Naprawić uszkodzone znaki w plikach settings i matrix config.
7. Dodać wspólny `ConfirmDialog`.
8. Dodać status auto-save do Risk Matrix.
9. Usunąć debug copy z Login.
10. Wprowadzić wspólny `Button/Input/Modal`.

## Rekomendacje strategiczne

### Etap 1 - bezpieczeństwo i stabilność

- Least privilege RLS.
- RPC dla krytycznych mutacji PFD/PFMEA/PCP/PCP rows/invitations.
- Uporządkowanie środowiska repo.
- Naprawa lint baseline.

### Etap 2 - UX i design system

- Wspólne komponenty UI.
- Jedna definicja tokenów: kolory, radius, spacing, font sizes.
- Responsive layouts dla stron publicznych i listowych.
- Spójne loading/empty/error/saved states.

### Etap 3 - refactor domenowy

- PFMEA: wydzielić row hierarchy, cell editors, revision workflow, persistence.
- PFD: wydzielić canvas, toolbar, edit session, mini PFMEA.
- Projects: wydzielić filtry, table, form, revision tooltip.
- Settings S/O/D: zastąpić 3 kopie jednym komponentem konfigurowalnym.

### Etap 4 - testy i wydajność

- Playwright smoke dla public routes, auth redirect, projects, PFD/PFMEA/PCP save.
- Testy RPC z RLS.
- Virtualizacja PFMEA/PCP.
- Monitoring błędów Supabase i partial save failures.

## Priorytet końcowy

Najpierw naprawić bezpieczeństwo Supabase i środowisko dwóch repozytoriów. Potem usunąć martwe linki i problemy mobile na publicznych stronach. Dopiero po tym warto zacząć większy refactor PFMEA/PFD/PCP, bo obecnie największe ryzyko nie jest wizualne, tylko pełnostackowe: uprawnienia, atomowość zapisów i utrzymywalność bardzo dużych komponentów.
