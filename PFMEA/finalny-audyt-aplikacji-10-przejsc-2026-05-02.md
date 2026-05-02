# Finalny audyt aplikacji RiskFlow 360 - 10 przejsc audytowych

Data audytu: 2026-05-02  
Zakres: repozytorium `C:\Users\zieada\pfmea-app`, aplikacja Next.js 16.1.1 / React 19.2.3 / Supabase.  
Dokument zrodlowy: `main/PFMEA_pakiet_audytowy.docx`.

## Metoda audytu

Audyt zostal wykonany w 10 niezaleznych przejsciach tematycznych, a nastepnie wyniki zostaly scalone i zweryfikowane pod katem powtarzalnych ryzyk. Przejscia:

1. Architektura repozytorium i routing aplikacji.
2. Warstwa UI, design system i spojnosci wizualnej.
3. Strony domenowe: Projects, PFD, PFMEA, PCP.
4. Raporty: RPN Matrix, Progress Chart oraz zarzadzanie akcjami.
5. Ustawienia: Organizations, Customer Access, Invitations, Risk Matrix, skale ocen.
6. Auth, publiczne strony i sesja uzytkownika.
7. Backend/API routes oraz integracja z Supabase.
8. Model danych, migracje, RLS i role organizacyjne.
9. Testy, CI, lint, typecheck i regresja przegladarkowa.
10. Produkcyjnosc, utrzymanie, wydajnosc i roadmapa refaktoryzacji.

Audyt bazuje na realnych plikach, konfiguracji i wynikach komend:

- `npm run typecheck` - nie przechodzi.
- `npx eslint app\pfmea\page.tsx app\pfd\page.tsx app\pcp\page.tsx src\features\reports\progress-chart\ProgressChartReportPage.tsx src\features\reports\rpn-matrix\RpnMatrixReportPage.tsx src\components\Layout\AppHeader.tsx` - 34 bledy.
- Analiza struktury `app`, `src`, `db`, `supabase/migrations`, `.github/workflows`, `package.json`, `next.config.ts`, `eslint.config.mjs`, `tsconfig.json`.

---

## 1. Executive summary

Aplikacja ma bardzo mocny fundament domenowy: widac spojny kierunek produktu, realna logike PFMEA/PFD/PCP, modul projektow, konfiguracje macierzy ryzyka, raport RPN Matrix, Progress Chart, organizacje, zaproszenia i model dostepu klientow. To nie jest prototyp statyczny, tylko funkcjonalna aplikacja z duza iloscia reguly biznesowej i realnym modelem danych w Supabase.

Najwieksze ryzyko nie lezy obecnie w braku funkcji, ale w sposobie utrzymania: kluczowe ekrany sa zbyt duze, czesc standardow UI zyje w jednym ogromnym pliku, a najwazniejsze komendy jakosciowe nie przechodza. `npm run typecheck` zwraca bledy w `src/features/settings/risk-matrix/risk-matrix-service.ts`, a ESLint/React Compiler wykrywa problemy w `app/pfmea/page.tsx`, `app/pfd/page.tsx`, `app/pcp/page.tsx` i `src/components/Layout/AppHeader.tsx`. To oznacza, ze dalszy rozwoj bez uporzadkowania bedzie coraz drozszy.

Aplikacja moze byc dalej rozwijana, ale nie powinna przechodzic w stabilna produkcje bez etapu technicznego utwardzenia. Rekomendowany kierunek to nie przebudowa od zera, tylko kontrolowany refaktor: najpierw przywrocic zielony `check`, potem wydzielic logike z najwiekszych stron, ujednolic design system jako jeden formalny kontrakt UI, uporzadkowac routing raportow i zamknac luki w testach regresyjnych.

---

## 2. Oceny 1-10

| Obszar | Ocena | Uzasadnienie |
|---|---:|---|
| Architektura | 5/10 | Dobry podzial zaczal powstawac w `src/features`, ale stare duze strony w `app/*/page.tsx` nadal lacza UI, stan, DB i reguly domenowe. |
| Jakosc frontendu | 5/10 | Funkcje sa zaawansowane, ale komponenty sa przeciazone, React Compiler wykrywa bledy purity/ref/memoization. |
| Jakosc backend/API | 6/10 | API routes maja sensowna walidacje i auth, ale zaleznosc od RPC/RLS jest bardzo duza i wymaga lepszej dokumentacji kontraktow. |
| Spojnosc UI | 6/10 | Standard ciemnego UI zostal wypracowany, ale nie jest jeszcze formalnym design systemem. Nadal istnieja stare jasne prymitywy i duzo inline styles. |
| Security | 6/10 | Widac duzo migracji hardening/RLS, ale nalezy zweryfikowac aktualny stan bazy, tokeny zaproszen, ekspozycje publicznych RPC i rotacje sekretow. |
| Performance | 5/10 | Najwieksze strony renderuja bardzo duze tabele i trzymaja rozbudowany stan po stronie klienta. Ryzyko rosnie wraz z liczba rekordow. |
| Maintainability | 4/10 | `app/pfmea/page.tsx` ma 6830 linii, `app/pfd/page.tsx` 2292, `app/pcp/page.tsx` 1502. To jest najwiekszy koszt utrzymania. |
| Production readiness | 4/10 | `typecheck` i wybrany `eslint` nie przechodza, `reactStrictMode` jest wylaczony, a routing raportow ma konflikt w `next.config.ts`. |

---

## 3. Kluczowe findings

| Severity | Area | Problem | Evidence | Impact | Recommendation | Fix cost |
|---|---|---|---|---|---|---|
| Krytyczny | Quality gate | `npm run typecheck` nie przechodzi. | `src/features/settings/risk-matrix/risk-matrix-service.ts:89,154,220,243` - typ `PostgrestError` wymaga `toJSON`. | Nie ma wiarygodnej bramki przed buildem/CI. Latwo przepchnac regresje. | Naprawic typ timeout error jako osobny typ aplikacyjny albo pelny `PostgrestError`; po tym uruchomic `npm run check`. | S |
| Krytyczny | React/Frontend | ESLint wykrywa 34 bledy na kluczowych stronach. | `app/pfmea/page.tsx`, `app/pfd/page.tsx`, `app/pcp/page.tsx`, `src/components/Layout/AppHeader.tsx`: `Date.now()` w renderze, refs during render, memoization mismatch, setState in effect. | Ryzyko niestabilnych renderow, trudne debugowanie, problemy po aktualizacjach React/Next. | Przeniesc czas/sesje do stanu/effectow, usunac odczyty ref w renderze, uproscic memoizacje. | M |
| Wysoki | Architektura | `PFMEA` jest monolitem 6830 linii. | `app/pfmea/page.tsx` zawiera UI, zapis do Supabase, drafty, edycje, tabele, hierarchie, liczenie RPN, modale. | Kazda zmiana PFMEA jest ryzykowna i trudna do testowania. | Wydzielic `usePfmeaRevision`, `usePfmeaRows`, `PfmeaTable`, `PfmeaToolbar`, `pfmea-service`, `pfmea-calculations`. | L |
| Wysoki | Architektura | `PFD` i `PCP` nadal sa za duze. | `app/pfd/page.tsx` 2292 linii, `app/pcp/page.tsx` 1502 linii. | Logika PFD/PFMEA/PCP jest powiazana, ale kontrakty modulow sa rozproszone. | Kontynuowac migracje do `src/features/pfd`, `src/features/pcp`, wspolny mechanizm draft/session/revision. | M/L |
| Wysoki | Routing | Konflikt redirectow dla raportow. | `next.config.ts` przekierowuje `/reports`, `/reports/progress` do `/projects`, mimo ze istnieja `app/reports/page.tsx`, `app/reports/progress/page.tsx`, `app/reports/progress-chart/page.tsx`, `app/reports/rpn-matrix/page.tsx`. | Uzytkownik moze trafic w inna strone niz oczekuje, linki raportow beda mylace. | Usunac stare redirecty lub zostawic tylko jawne legacy aliasy, np. `/reports/progress` -> `/reports/progress-chart`. | S |
| Wysoki | UI standard | Standard UI nie jest jeszcze formalny. | `src/features/settings/invitation-shell.tsx` ma 989 linii i zawiera style, tabele, popupy, layout, modal, tlo. `src/components/ui/primitives.tsx` nadal jest jasnym Tailwindowym standardem. | Dwie rownolegle filozofie UI; nowe strony latwo zrobic niespojnie. | Utworzyc `src/components/rf-ui/*` lub `src/features/ui-standard/*` z tokenami, layoutem, tabela, filtrami, modalem, form controls. | M |
| Wysoki | App shell/auth | Header jest bardzo zlozony i zarzadza wieloma odpowiedzialnosciami. | `src/components/Layout/AppHeader.tsx` ma 934 linie, session cache, idle, menu, routing, pomiary layoutu i UI. | Regresje typu: znikajace menu, zly stan login/logout, rozna wysokosc logo na stronach. | Rozbic na `HeaderSession`, `HeaderNavigation`, `HeaderUserMenu`, `HeaderIdleStatus`, `PublicHeader`. | M |
| Wysoki | Production config | `reactStrictMode` jest wylaczony. | `next.config.ts`: `reactStrictMode: false`. | Ukrywa czesc problemow renderowania i efektow. | Wlaczyc dopiero po naprawie lint/React Compiler; dodac test smoke dla glownego shell. | S/M |
| Sredni | UI/UX | Duza liczba inline styles utrudnia spojnosc. | 49 plikow zawiera `style={{` lub `React.CSSProperties`. | Reczne utrzymywanie marginesow, paddingow i kolorow prowadzi do roznic miedzy stronami. | Przenosic powtarzalne style do tokenow i komponentow standardu. | M |
| Sredni | Type policy | ESLint ma szerokie wyjatki. | `eslint.config.mjs` wylacza `no-explicit-any` dla kluczowych stron, `set-state-in-effect` dla PFMEA/PCP, `ban-ts-comment` dla risk-matrix. | Wyjatki maskuja realny dlug, a nie tylko pojedyncze przypadki. | Zmienic na lokalne, opisane wyjatki; redukowac liste przy kazdym refaktorze. | M |
| Sredni | TypeScript | `allowJs: true` i `skipLibCheck: true`. | `tsconfig.json`. | Slabsze gwarancje typow, szczegolnie przy skryptach regresyjnych i zaleznosciach. | Zostawic tymczasowo, ale dodac plan: JS skrypty do TS lub osobny tsconfig; docelowo ocenic `skipLibCheck`. | M |
| Sredni | Data model | Dwie lokalizacje migracji i duzo plikow SQL. | `db/*` oraz `supabase/migrations/*`. | Trudno potwierdzic, co jest juz zastosowane w bazie, a co jest archiwum/remediacja. | Zrobic jeden katalog migracji jako zrodlo prawdy i plik `schema-state.md`. | M |
| Sredni | Reports | Progress Chart liczy historycznie z `pfmea_change_history`, a aktualny punkt z `pfmea_rows`. | `src/features/reports/progress-chart/progress-chart-service.ts`. | Uzytkownik moze porownywac srednia z Projects z inna definicja danych historycznych. | Dodac jawny opis zrodla danych w tooltipie/legendzie oraz test zgodnosci z Projects dla aktualnego dnia. | S/M |
| Sredni | Reports | RPN Matrix i Progress Chart bazuja na aktywnych operacjach i current draft/open revision. | `rpn-matrix-service.ts`, `progress-chart-service.ts`. | Jesli projekt ma draft i open revision, definicja "aktualne" musi byc jedna dla calej aplikacji. | Wydzielic wspolny serwis `risk-scope-service` uzywany przez Projects/RPN Matrix/Progress Chart. | M |
| Sredni | API | Publiczny request access ma honeypot `companyWebsite`, ale brak rate limitu. | `app/api/request-access/route.ts`. | Mozliwe spamowanie endpointu/RPC. | Dodac rate limit po IP/email i logowanie naduzyc. | S/M |
| Sredni | Error handling | Bledy czesto sa tekstem z Supabase przekazywanym do UI. | `projects-service.ts`, `risk-matrix-service.ts`, API routes. | Komunikaty moga byc techniczne i niespojne. | Wprowadzic mapowanie bledow domenowych: validation/auth/conflict/db/unavailable. | M |
| Niski | Repo hygiene | Workspace zawiera duzo logow, obrazow i raportow w katalogu glownym. | `git status --short`, pliki `*.log`, `main/*`, `PDF/*`, `PFMEA/*`, obrazy w `app/`. | Latwo commitowac artefakty robocze; wiekszy szum w review. | Uporzadkowac `.gitignore`, przeniesc materialy marketingowe do `public/marketing` albo `main/`, rozdzielic raporty od kodu. | S |
| Niski | Accessibility | UI ma sporo customowych przyciskow, popupow i tabel. | `column-filter-header.tsx`, `column-menu.tsx`, `SettingsConfirmDialog`, custom style controls. | Ryzyko brakow keyboard/focus/ARIA, szczegolnie w dropdownach i modalu. | Audyt WCAG: focus trap w modalach, role menu/listbox, kontrast, etykiety formularzy, visible focus. | M |

---

## 4. Audyt stron i widokow

### Strona glowna `/`

Cel: marketingowe przedstawienie RiskFlow 360, workflow PFD/PFMEA/PCP, raportow, akcji i ustawien.

Ocena UI: kierunek jest dobry: ciemne tlo i screeny aplikacji sa spojne z produktem. Strona jednak nadal jest tworzona jako osobny layout, nie jako czesc wspolnego marketingowego design systemu.

Ocena funkcjonalna: strona powinna byc informacyjna, bez linkow do modulow roboczych. Aktualny kierunek jest poprawny, ale materialy graficzne powinny byc uporzadkowane w stale assety.

Problemy:

- Sredni: assety marketingowe sa w `main/` i importowane bez formalnej struktury zasobow.
- Sredni: strona jest oddzielnie stylowana, wiec moze znowu rozjechac sie z reszta aplikacji.
- Niski: brak systematycznych breakpointow/QA dla marketingowych ramek ze screenami.

Rekomendacje:

- Przeniesc finalne screeny do `public/marketing` albo utrzymac jeden jawny katalog `main` jako source assets.
- Dodac komponent `MarketingProductFrame`.
- Zrobic Playwright screenshot na desktop/tablet/mobile.

### Login `/login` i Signup `/signup`

Cel: logowanie i request zalozenia konta Early Access.

Ocena UI: formularze zostaly dopasowane do ciemnego standardu, ale nadal maja duzo inline stylingu. Autofill jest nadpisywany globalnym CSS, co rozwiazuje aktualny problem, ale jest podatne na roznice przegladarek.

Ocena funkcjonalna: login i signup maja jasna role. Signup powinien tworzyc request w `organizations/access_requests`, a nie realne konto Supabase, co jest dobrym modelem dla Early Access.

Problemy:

- Wysoki: nalezy potwierdzic caly przeplyw signup -> request -> Organizations NEW -> akceptacja -> zaproszenie -> aktywacja konta testem e2e.
- Sredni: komunikaty i stany formularzy sa lokalne, a nie wspolne.
- Sredni: publiczny request nie ma rate limitu.
- Niski: etykiety i focus states wymagaja audytu accessibility.

Rekomendacje:

- Dodac regresje Playwright dla Early Access request.
- Wydzielic `AuthFormShell`, `AuthInput`, `AuthActionRow`, `EarlyAccessAcknowledgement`.
- Dodac rate limiting i antyspam po stronie API/RPC.

### Projects `/projects`

Cel: glowny operacyjny widok projektow/procesow, statusow, rewizji, ryzyka i wejsc do modulow.

Ocena UI: Projects jest obecnie najblizej ustalonego standardu tabelowego. Korzysta z `SettingsPageShell`, summary tiles, wspolnych styli z `invitation-shell` i `view-styles`.

Ocena funkcjonalna: widok ma sensowny podzial na hooki i komponenty (`useProjectsData`, `useProjectsEditor`, `ProjectsTable`, `ProjectsToolbar`). To powinien byc wzorzec dla kolejnych refaktorow.

Problemy:

- Sredni: serwis projektow laczy wiele obszarow: projekty, site/dept, risk matrix, popup rewizji, open risk summary.
- Sredni: srednie RPN i kolory ryzyka powinny miec jeden wspolny kalkulator z raportami.
- Niski: tabela jest bardzo zależna od inline style i procentowych szerokosci.

Rekomendacje:

- Wydzielic `risk-summary-service` wspolny dla Projects, RPN Matrix i Progress Chart.
- Utrzymac Projects jako referencyjny standard UI dla pozostalych tabel.
- Dodac test regresyjny zgodnosci sredniej RPN Projects vs raporty.

### PFD `/pfd`

Cel: modelowanie przeplywu procesu i operacji, powiazane z PFMEA/PCP.

Ocena UI: PFD wykorzystuje React Flow i customowe wezly. UI jest funkcjonalny, ale kod strony jest nadal duzy.

Ocena funkcjonalna: istnieja wydzielone elementy `src/features/pfd/*`, co jest dobrym kierunkiem. Nadal jednak `app/pfd/page.tsx` ma 2292 linie i ESLint pokazuje bledy purity/setState in effect.

Problemy:

- Wysoki: `Date.now()` w renderowej logice wygasania sesji edycji.
- Wysoki: wiele efektow laduje dane i ustawia stan synchronicznie, co React Compiler oznacza jako problem.
- Sredni: zdublowane struktury `app/pfd/_lib` i `src/app/pfd/_lib`.

Rekomendacje:

- Przeniesc edit lock timer do hooka `useEditSessionClock`.
- Dalsze wydzielanie logiki do `src/features/pfd`.
- Usunac duplikaty lub jasno oznaczyc, ktora sciezka jest aktywna.

### PFMEA `/pfmea`

Cel: glowna analiza ryzyka procesu, kaskadowa tabela failure mode / effect / cause / action / PCP.

Ocena UI: funkcjonalnie bardzo bogata, dobrze odpowiada domenie PFMEA. Jednoczesnie to najwiekszy punkt ryzyka technicznego calej aplikacji.

Ocena funkcjonalna: obsluguje drafty, publikacje rewizji, scalanie blokow, RPN, hierarchie i zaleznosci z PFD/PCP. Te funkcje sa wartosciowe, ale sa zbyt mocno sklejone w jednym komponencie.

Problemy:

- Krytyczny: ESLint/React Compiler wykrywa `Date.now()` w renderze, ref reads during render i memoization mismatch.
- Wysoki: 6830 linii w jednym pliku.
- Wysoki: wiele bezposrednich operacji Supabase w page component.
- Sredni: tabela moze miec problemy wydajnosciowe przy duzej liczbie rekordow.

Rekomendacje:

- Etapowy refaktor bez zmiany UX: `pfmea-service.ts`, `pfmea-row-model.ts`, `pfmea-calculations.ts`, `usePfmeaTableState`, `PfmeaTable`.
- Dodac testy jednostkowe dla liczenia RPN/kolorow/scalania hierarchii.
- Rozwazyc wirtualizacje tabeli przy wiekszych projektach.

### PCP `/pcp`

Cel: plan kontroli powiazany z PFMEA i PFD.

Ocena UI: wyglad jest bliski obecnej aplikacji, ale kod strony nadal laczy wiele odpowiedzialnosci.

Ocena funkcjonalna: dobrze widac integracje z PFMEA, bo dane kontrolne wynikaja z ryzyk i akcji. ESLint wykrywa jednak problemy podobne do PFD/PFMEA.

Problemy:

- Wysoki: `Date.now()` w renderze i memoization mismatch.
- Sredni: serwis/logika PCP nie sa jeszcze tak dobrze rozdzielone jak Projects.
- Sredni: potencjalna rozbieznosc definicji draft/open revision z PFMEA.

Rekomendacje:

- Wspolny mechanizm draft/edit-session/revision dla PFD/PFMEA/PCP.
- Wydzielic tabele i akcje PCP do komponentow.
- Test regresyjny: PFMEA row -> PCP row -> save -> publish.

### Task Management `/task-management`

Cel: zarzadzanie akcjami z PFMEA, odpowiedzialnoscia, terminami i statusem.

Ocena UI: modul jest wazny domenowo, ale jest jednym z wiekszych plikow (`1121` linii).

Ocena funkcjonalna: `src/features/tasks/task-service.ts` istnieje, co jest dobrym krokiem. Wymaga jednak pelniejszej integracji ze standardem UI i testow.

Problemy:

- Sredni: duza strona bez pelnego rozbicia na komponenty.
- Sredni: aktualizacja statusow PFMEA musi byc testowana razem z raportami.

Rekomendacje:

- Wydzielic `TasksTable`, `TasksFilters`, `TaskEditDialog`.
- Dodac test przeplywu: akcja rekomendowana w PFMEA -> widoczna w Actions -> zmiana statusu -> PFMEA/raporty.

### RPN Matrix `/reports/rpn-matrix`

Cel: pokazanie rozkladu ryzyk na macierzy RPN oraz zliczenia kolorow per projekt.

Ocena UI: po ostatnich zmianach kierunek jest dobry: filtry, macierz, osobna ramka wykresu. Nadal bazuje mocno na stylach inline.

Ocena funkcjonalna: dane sa liczone z aktualnych rewizji otwartych projektow i aktywnych operacji. Kolor jest zgodny z `Risk Matrix` przez `risk_matrix_cells`/thresholds.

Problemy:

- Sredni: brak jednego wspolnego zrodla prawdy dla kalkulacji ryzyka z Projects i Progress Chart.
- Sredni: jesli uzytkownik nie rozumie draft/open revision, wynik moze wygladac "inaczej" niz na PFMEA.

Rekomendacje:

- Dodac tooltip/metainfo: zrodlo danych, statusy projektow, uzyta rewizja.
- Wydzielic wspolny `risk-color-service`.
- Dodac test dla projektu z 5 ryzykami i oczekiwanym rozkladem kolorow.

### Progress Chart `/reports/progress-chart`

Cel: trend sredniego RPN w czasie, z filtrami site/department/project/agregacja.

Ocena UI: wykres zostal mocno dopasowany wizualnie do standardu aplikacji. Obecnie jest bardziej czytelny jako trend niz poprzedni slupkowy wariant.

Ocena funkcjonalna: aktualny punkt jest liczony z `pfmea_rows`, a historia z `pfmea_change_history`. To jest logiczne, ale musi byc bardzo jasno opisane.

Problemy:

- Wysoki: `next.config.ts` przekierowuje `/reports/progress` do `/projects`, mimo istnienia strony `app/reports/progress/page.tsx`.
- Sredni: historia i aktualny punkt maja inne zrodla danych.
- Sredni: w razie braku historii wykres moze sugerowac brak danych mimo obecnego PFMEA.

Rekomendacje:

- Poprawic routing.
- Dodac opis w tooltipie: "history from PFMEA change history, current from open project rows".
- Dodac snapshot historii przy publikacji oraz opcjonalnie przy zapisie, jesli taki ma byc biznesowy standard.

### Reports root `/reports` i `/reports/progress`

Cel: wejscie do raportow / alias progresu.

Ocena UI/funkcjonalna: istnieja pliki stron, ale konfiguracja redirectow wskazuje na stary model.

Problemy:

- Wysoki: konflikt miedzy fizycznymi stronami a redirectami.

Rekomendacje:

- Zdecydowac: albo `/reports` jest indexem raportow, albo redirectem. Obecnie repo ma oba kierunki naraz.

### Organizations `/settings/organizations`

Cel: administracja organizacjami, championami, requestami i statusem.

Ocena UI: po zmianach jest blisko standardu Customer Access, ale plik ma 779 linii i laczy sporo odpowiedzialnosci.

Ocena funkcjonalna: requesty powinny byc w glownej tabeli jako `NEW` z data zgloszenia. To jest dobry model UX, bo usuwa druga tabele.

Problemy:

- Sredni: logika admin RPC i UI requestow jest w page component.
- Sredni: trzeba dopilnowac testu: signup/request -> Organizations NEW.

Rekomendacje:

- Wydzielic `organizations-service.ts`, `OrganizationsTable`, `AccessRequestRow`.
- Test regresyjny z requestem i zmiana statusu.

### Customer Access `/settings/customer-access`

Cel: nadawanie dostepu klientom per projekt i modul PFMEA/PFD/PCP.

Ocena UI: jest jednym z najwazniejszych wzorcow po standaryzacji: tabela bez dodatkowej ramki, wartosci project/customer na pomaranczowo, kolumny modulow, usuwanie uprawnien, status i data nadania.

Ocena funkcjonalna: model jednej linii na klienta/projekt/moduly jest poprawny i bardziej skalowalny niz osobne tabele.

Problemy:

- Sredni: duzy komponent `src/features/settings/CustomerAccessPanel.tsx` ma 771 linii.
- Sredni: trzeba testowac cofanie uprawnien i multi-grant.

Rekomendacje:

- Utrzymac jako wzorzec UI dla Organizations.
- Rozbic panel na table/form/hooks.
- Utrzymac regresje `customer-flow`, `customer-revoke-flow`, `customer-multi-grant-flow`.

### Invitations `/settings/invitations`

Cel: zapraszanie uzytkownikow do organizacji.

Ocena UI: duzy zakres, sporo standardowych elementow tabeli i popupow.

Ocena funkcjonalna: API route sprawdza auth, aktywna organizacje i role admin/champion. To jest dobry kierunek.

Problemy:

- Sredni: `app/settings/invitations/page.tsx` ma 1012 linii, a `src/features/settings/invitation-shell.tsx` 989 linii.
- Sredni: resend/send maja podobna logike origin/basePath/error mapping.

Rekomendacje:

- Wydzielic wspolne helpers dla invitation API.
- Rozbic shell UI na mniejsze komponenty standardu.

### Risk Matrix `/settings/risk-matrix`

Cel: konfiguracja macierzy i progow RPN.

Ocena UI: funkcjonalnie wazny modul, bo zasila raporty. UI jest obecnie zgodny z ciemnym standardem, ale typecheck wskazuje bledy w serwisie.

Ocena funkcjonalna: po zmianach `organization_id` jest wymagany dla zapisu. Kod juz probuje dzialac organizacyjnie, ale typy timeout error sa bledne.

Problemy:

- Krytyczny: `risk-matrix-service.ts` blokuje `typecheck`.
- Sredni: istnieja stare `_lib/matrixConfig.ts`, `_lib/matrixColors.ts` oraz nowe `src/features/settings/risk-matrix/*`.

Rekomendacje:

- Naprawic typy.
- Usunac lub oznaczyc legacy `_lib`.
- Dodac test: zmiana progow -> RPN Matrix i Progress Chart uzywaja tych samych progow.

### Severity / Occurrence / Detection

Cel: konfiguracja skal ocen.

Ocena UI: uzywaja wspolnego `RatingScalePage`, co jest dobrym przykladem reuzywalnosci.

Ocena funkcjonalna: skale sa domenowo krytyczne, bo wplywaja na RPN.

Problemy:

- Sredni: potrzebne testy migracji i nadpisan organizacyjnych.
- Niski: warto dodac jasne empty/error states dla braku organizacji.

Rekomendacje:

- Test: zmiana opisu/poziomu -> PFMEA popup/selector pokazuje aktualna wartosc.

### Sites & Departments

Cel: zarzadzanie struktura organizacji uzywana w projektach i filtrach raportow.

Ocena UI: blisko standardu settings.

Ocena funkcjonalna: serwis ma logike ochrony uzywanych site/dept. To jest dobre.

Problemy:

- Sredni: page ma 769 linii i lokalna obsluge wielu stanow.
- Sredni: zaleznosc filtracji raportow od aktywnosci site/dept powinna byc testowana.

Rekomendacje:

- Wydzielic table/form/hooks.
- Test: dezaktywacja site/dept nie psuje projektow historycznych.

### UI Preview `/settings/ui-preview`

Cel: laboratorium standardu UI.

Ocena UI: przydatne jako plac testowy, ale nie powinno byc traktowane jako produkcyjny design system.

Problemy:

- Sredni: 1094 linie i wiele kandydatow styli w jednym miejscu.
- Niski: moze byc dostepne w produkcji bez potrzeby.

Rekomendacje:

- Zamienic na dokumentacje komponentow lub ukryc dla admin/dev.
- Przeniesc finalne elementy do biblioteki UI.

### Waiting for invite `/waiting-for-invite` i Request Access `/request-access`

Cel: aktywacja zaproszenia i publiczne zgloszenie dostepu.

Ocena UI: czesc publicznych stron nadal ma stare/jasne style lub osobne style.

Problemy:

- Sredni: publiczne strony nie sa w pelni zunifikowane z login/signup.
- Sredni: request access powinien byc czescia tego samego flow co signup Early Access.

Rekomendacje:

- Jeden `PublicAuthShell`.
- Testy dla token invalid/expired/accepted.

---

## 5. Technical debt

Najwiekszy dlug techniczny:

1. Monolityczne strony: `PFMEA`, `PFD`, `PCP`, `Task Management`.
2. Niezielony `typecheck` i `eslint`.
3. Rozproszony design system: `invitation-shell`, `view-styles`, global CSS, jasne `primitives.tsx`, inline styles.
4. Konflikt routingowy raportow w `next.config.ts`.
5. Duplikaty/legacy struktury: `app/pfd/_lib` vs `src/app/pfd/_lib`, risk-matrix `_lib` vs `src/features/settings/risk-matrix`.
6. Brak jednego kontraktu dla "aktualnej rewizji", "otwartych projektow", "aktywnych operacji" i kalkulacji RPN.
7. Brak kompletnej warstwy testow dla najwazniejszych przeplywow biznesowych.
8. Mieszanie plikow roboczych, raportow, logow i assetow z kodem aplikacji.

---

## 6. Ocena UI / Design System

Aktualny standard wizualny aplikacji jest juz czytelny:

- tlo ciemnogranatowe z kontrolowana brazowa nakladka,
- glowna szerokosc robocza `96%`,
- radius `8px`,
- ramki `rgba(255,255,255,0.16)`,
- powierzchnie `rgba(255,255,255,0.08)` / `rgb(40,39,47)`,
- tekst akcentowy `#d9a86c`,
- tabele bez nadmiarowych tytulow nad tabela,
- komunikaty bledow jako modal/popup albo dyskretny tekst wedlug ustalonego kontekstu,
- summary tiles w gornej ramce,
- filtrowanie i dropdowny w ciemnym standardzie.

Problem: ten standard nie jest jeszcze "produktem technicznym". Jest zestawem styli w `src/features/settings/invitation-shell.tsx`, czesciowo powielanym i nadpisywanym. Starszy `src/components/ui/primitives.tsx` nadal definiuje jasne karty, jasne inputy i Tailwindowe style, czyli nie reprezentuje aktualnego RiskFlow 360.

Rekomendacja: stworzyc formalna warstwe `rf-ui`:

- `RfPageShell`
- `RfHeaderFrame`
- `RfSummaryTile`
- `RfTable`
- `RfToolbar`
- `RfSelect`
- `RfInput`
- `RfModal`
- `RfStatusText`
- `RfIconButton`
- `RfChartFrame`

Po tym wszystkie strony settings/projects/reports powinny uzywac tych komponentow, a nie kopiowanych obiektow `CSSProperties`.

---

## 7. Quick wins

### 1-3 dni

1. Naprawic `risk-matrix-service.ts`, aby `npm run typecheck` przechodzil.
2. Usunac lub poprawic redirecty `/reports`, `/reports/progress` w `next.config.ts`.
3. Naprawic `Date.now()` w renderze dla PFD/PFMEA/PCP przez hook zegara sesji.
4. Dodac jeden opis zrodla danych w Progress Chart i RPN Matrix.
5. Przeniesc assety marketingowe do jednego katalogu i usunac robocze obrazy z `app/`.
6. Dopisac `.gitignore` dla logow dev i testowych artefaktow.
7. Dodac test smoke: login -> projects -> reports/progress-chart -> reports/rpn-matrix.

### 1-2 tygodnie

1. Wydzielic `rf-ui` z `invitation-shell`.
2. Rozbic `AppHeader` na mniejsze komponenty.
3. Wydzielic wspolny `risk-summary-service` dla Projects/RPN Matrix/Progress Chart.
4. Zrobic pierwszy kontrolowany refaktor PFMEA: serwis DB + kalkulacje + table component.
5. Dodac testy domenowe dla RPN, kolorow, progow i rozkladu na macierzy.
6. Uporzadkowac migracje: jedno zrodlo prawdy + opis zastosowanego stanu.
7. Wlaczyc `reactStrictMode` po usunieciu bledow React Compiler.

---

## 8. Remediation plan

### Etap 0 - Stabilizacja bramki jakosci

Cel: `npm run check` ma przechodzic lokalnie i w CI.

Zakres:

- naprawa typecheck,
- naprawa krytycznych bledow ESLint w PFMEA/PFD/PCP/Header,
- usuniecie konfliktow routingowych raportow,
- przeglad `.gitignore`.

Artefakty:

- zielony `npm run typecheck`,
- zielony `npm run lint` albo jawna lista tymczasowych, lokalnych wyjatkow,
- poprawiony `next.config.ts`.

Ryzyka:

- czesc bledow ESLint dotyczy realnej logiki sesji edycji, wiec trzeba zachowac aktualny UX lockow.

Definition of Done:

- `npm run check` przechodzi,
- `/reports/progress-chart` i `/reports/rpn-matrix` dzialaja bez redirect conflict,
- nie ma nowych regresji w Projects/PFMEA.

### Etap 1 - Formalizacja UI standardu

Cel: jeden standard UI jako reusable komponenty.

Zakres:

- wydzielenie tokenow,
- komponenty shell/table/input/select/modal/chart,
- migracja Projects, Customer Access, Organizations jako pierwsza fala.

Artefakty:

- `src/components/rf-ui/*` albo `src/features/ui-standard/*`,
- dokument `PFMEA/riskflow-ui-standard.md`,
- screenshot smoke dla kluczowych stron.

Ryzyka:

- mozliwe drobne roznice wizualne po migracji; nalezy migrowac strona po stronie.

DoD:

- nowe strony nie importuja styli z `invitation-shell` bezposrednio,
- `primitives.tsx` nie reprezentuje juz starego jasnego standardu albo zostaje usuniety.

### Etap 2 - Wspolny model ryzyka i raportow

Cel: Projects, PFMEA, RPN Matrix i Progress Chart licza te same rzeczy w ten sam sposob.

Zakres:

- wspolny serwis: open projects, eligible revisions, active operations, current RPN,
- definicja historycznych snapshotow,
- testy porownujace srednie.

Artefakty:

- `risk-scope-service`,
- `risk-calculation-service`,
- testy jednostkowe i regresyjne.

Ryzyka:

- zmiana definicji aktualnych danych moze zmienic widoczne srednie RPN.

DoD:

- Projects average RPN = Progress current average RPN dla tych samych filtrow,
- RPN Matrix count = liczba aktywnych ryzyk w tym samym scope.

### Etap 3 - Refaktor modulow PFD/PFMEA/PCP

Cel: ograniczyc ryzyko zmian w najwazniejszych ekranach domenowych.

Zakres:

- PFMEA: serwis DB, hooki, tabela, kalkulacje, modale,
- PFD: edit session i flow helpers,
- PCP: table + save/publish flow,
- wspolny revision/draft/edit lock.

Artefakty:

- mniejsze komponenty po 100-400 linii,
- testy dla draft/publish/merge/save.

Ryzyka:

- PFMEA jest krytyczny biznesowo; refaktor musi byc etapowy, z testami po kazdym kroku.

DoD:

- brak pojedynczego page component powyzej 1500 linii dla modulow domenowych,
- regresje PFMEA/PFD/PCP przechodza.

### Etap 4 - Produkcyjne utwardzenie

Cel: przygotowanie aplikacji do stabilnego rollout.

Zakres:

- `reactStrictMode: true`,
- rate limiting public API,
- monitoring bledow,
- RLS verification checklist,
- accessibility pass,
- wydajnosciowy test duzych tabel.

Artefakty:

- checklist produkcyjny,
- raport security/RLS,
- testy e2e krytycznych flow.

Ryzyka:

- ujawnia sie ukryte problemy po wlaczeniu Strict Mode.

DoD:

- zielony CI,
- zdefiniowane sekrety i rotacja,
- brak publicznych endpointow bez rate limitu tam, gdzie przyjmuja dane.

---

## 9. Backlog techniczny

### [Krytyczny] Naprawic typecheck Risk Matrix

Zakres: poprawic `timeoutError` i typy `QueryResult` w `src/features/settings/risk-matrix/risk-matrix-service.ts`.  
Pliki/moduly: `risk-matrix-service.ts`, `risk-matrix-utils.ts`.  
Efekt finalny: `npm run typecheck` przechodzi.

### [Krytyczny] Usunac bledy React Compiler z PFMEA/PFD/PCP/Header

Zakres: przeniesc `Date.now()` z renderu, nie czytac refow w renderze, poprawic zaleznosci `useMemo/useCallback`.  
Pliki/moduly: `app/pfmea/page.tsx`, `app/pfd/page.tsx`, `app/pcp/page.tsx`, `src/components/Layout/AppHeader.tsx`.  
Efekt finalny: ESLint przechodzi na kluczowych stronach.

### [Wysoki] Poprawic routing raportow

Zakres: usunac stare redirecty albo zmienic je na poprawne aliasy.  
Pliki/moduly: `next.config.ts`, `app/reports/*`.  
Efekt finalny: `/reports`, `/reports/progress-chart`, `/reports/rpn-matrix` sa przewidywalne.

### [Wysoki] Wydzielic RiskFlow UI Standard

Zakres: przeniesc standard z `invitation-shell` do formalnej biblioteki.  
Pliki/moduly: `src/components/rf-ui/*`, `src/features/settings/invitation-shell.tsx`.  
Efekt finalny: nowe strony uzywaja tych samych komponentow UI.

### [Wysoki] Rozbic AppHeader

Zakres: oddzielic auth/session, menu, user info, idle timer i public/private state.  
Pliki/moduly: `src/components/Layout/AppHeader.tsx`, `PublicHeader.tsx`, `AppChrome.tsx`.  
Efekt finalny: jeden pasek aplikacji bez regresji login/logout/menu.

### [Wysoki] Wspolny model kalkulacji RPN

Zakres: jeden kalkulator dla Projects, RPN Matrix, Progress Chart i PFMEA.  
Pliki/moduly: `src/features/projects/projects-service.ts`, `src/features/reports/*`, `app/pfmea/page.tsx`.  
Efekt finalny: te same filtry daja te same srednie/liczniki.

### [Wysoki] Pierwszy etap refaktoru PFMEA

Zakres: wydzielic Supabase service, kalkulacje i table state.  
Pliki/moduly: `app/pfmea/page.tsx`, nowe `src/features/pfmea/*`.  
Efekt finalny: mniej logiki w page component, latwiejsze testy.

### [Sredni] Testy Early Access / Organizations

Zakres: signup request -> Organizations NEW -> approve/invite.  
Pliki/moduly: `app/signup/page.tsx`, `app/api/request-access/route.ts`, `app/settings/organizations/page.tsx`, `scripts/regression/org/*`.  
Efekt finalny: potwierdzony przeplyw rejestracji.

### [Sredni] Test zgodnosci raportow z Projects

Zakres: projekt testowy z ustalonymi RPN i kolorami.  
Pliki/moduly: `scripts/regression/reports/*`, `src/features/reports/*`.  
Efekt finalny: wykrywanie rozjazdow typu "Projects 144, Progress 154".

### [Sredni] Uporzadkowac migracje Supabase

Zakres: wskazac jedno zrodlo prawdy migracji i opis aktualnego stanu bazy.  
Pliki/moduly: `db/*`, `supabase/migrations/*`, `PFMEA/schema-state.md`.  
Efekt finalny: wiadomo, ktore migracje sa aplikowane i w jakiej kolejnosci.

### [Sredni] Rate limiting public endpoints

Zakres: request access, invitation preview/activation jesli publicznie dostepne.  
Pliki/moduly: `app/api/request-access/route.ts`, RPC `submit_access_request`.  
Efekt finalny: mniejsze ryzyko spamu/naduzyc.

### [Niski] Repo hygiene

Zakres: logi, screenshoty, pliki robocze i raporty poza kodem aplikacji.  
Pliki/moduly: `.gitignore`, `main/*`, `PFMEA/*`, `app/*.png`, `*.log`.  
Efekt finalny: czystsze PR-y i mniejszy szum.

---

## 10. Final verdict

RiskFlow 360 ma wartosciowy, dobrze ukierunkowany produktowo fundament i coraz bardziej spojny standard wizualny. Najwazniejsze funkcje domenowe istnieja i sa ze soba logicznie powiazane: Projects -> PFD -> PFMEA -> PCP -> Actions -> Reports -> Settings.

Stan techniczny wymaga jednak przerwy na stabilizacje. W obecnej formie aplikacja jest ryzykowna do szybkiego dalszego rozwoju, bo kluczowe ekrany sa zbyt duze, design system nie jest sformalizowany, a komendy jakosciowe nie przechodza.

Rekomendacja senior full stack: kontynuowac rozwoj, ale najpierw wykonac Etap 0 i Etap 1. Nie przepisywac aplikacji od zera. Najwieksza wartosc da kontrolowany refaktor wokol istniejacego produktu, z utrzymaniem obecnego UX, ale z twardymi bramkami: zielony typecheck, zielony lint, jeden standard UI i jeden model liczenia ryzyka.

