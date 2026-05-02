# PFMEA App - pelny krytyczny review

Data review: 2026-04-22

Zakres: analiza kodu frontendowego, konfiguracji projektu, workflow CI oraz dostepnych skryptow SQL/Supabase. Review obejmuje tez wynik `npm run lint` i `npm run build`.

## Executive Verdict

To rozwiazanie nie jest obecnie gotowe na poziom produkcyjny rozumiany jako bezpieczny, skalowalny i zespolowo utrzymywalny produkt SaaS.

Najmocniejsza strona projektu to wiedza domenowa i determinacja w dostarczeniu realnych przeplywow PFD / PFMEA / PCP. Najslabsze strony to model bezpieczenstwa, skrajnie client-heavy architektura, ogromne pliki laczace wiele odpowiedzialnosci oraz slabe bramki jakosci.

Stan na teraz:

- `npm run build` przechodzi.
- `npm run lint` nie przechodzi: 306 problemow, w tym 236 bledow i 70 ostrzezen.
- Prawie caly biznes aplikacji siedzi w duzych client components i uderza bezposrednio do Supabase z przegladarki.
- Dostepne skrypty SQL sugeruja bardzo ryzykowny model RLS.

## Najwazniejsze findings

1. `[CRITICAL]` Warstwa danych ma otwarty lub prawie otwarty model autoryzacji. `db/control_plan_rows_rls.sql:3` wprost ostrzega, ze skrypt szeroko otwiera dostep dla `anon/authenticated`. Dalej `db/control_plan_rows_rls.sql:9,47-66` grantuje `select/insert/update/delete` oraz ustawia polityki `using (true)` i `with check (true)`. Dodatkowo `db/pfd_editing.sql:60-82`, `db/pfmea_editing.sql:54-62`, `db/pcp_editing.sql:53-61` i `db/pfmea_row_backups.sql:28-29` wpuszczaja kazdego zalogowanego uzytkownika bez scoping-u do organizacji czy projektu. W praktyce oznacza to ryzyko cross-tenant read/write i bardzo slaba ochrone danych.

2. `[CRITICAL]` Autoryzacja ekranow jest robiona glownie po stronie klienta, a nie po stronie serwera. `proxy.ts:40-44` sprawdza tylko istnienie sesji i nie waliduje roli ani organizacji. `app/settings/layout.tsx:68-102` pobiera role z `organization_members`, a `app/projects/page.tsx:412-415` wybiera po prostu pierwsze dopasowanie `organization_members` przez `limit(1)`, bez oparcia o `profiles.active_organization_id`, ktore w innych miejscach jest traktowane jako zrodlo prawdy (`app/settings/severity/page.tsx:281-295`). Przy wielu organizacjach to moze dawac bledny kontekst, bledne uprawnienia i nieprzewidywalne zachowanie.

3. `[HIGH]` Krytyczne save/publish flows sa skladane z wielu krokow wykonywanych z przegladarki, bez transakcji i bez spójnej kompensacji bledu. Przyklady: `app/pfd/page.tsx:812-850`, `app/pcp/page.tsx:1083-1100`, `app/pfmea/page.tsx:3848-3984`. W takich przeplywach czesc zmian moze zapisac sie do bazy, a czesc nie, co grozi pol-zapisanym draftem, zla historia zmian, osieroconym lockiem albo niespojnym open revision.

4. `[HIGH]` Architektura podstawowych modulow jest monolityczna i ciasno sprzezona. `app/pfmea/page.tsx` ma 7271 linii, `app/pfd/page.tsx` 2938, `app/projects/page.tsx` 2283, `app/pcp/page.tsx` 1526, a `src/components/Layout/AppHeader.tsx` 862. Same metryki hookow sa alarmowe: `app/pfmea/page.tsx` ma 60 `useState`, 33 `useEffect`, 55 `useCallback`; `app/pfd/page.tsx` ma 28 `useState`, 18 `useEffect`, 52 `useCallback`. To nie jest naturalna zlozonosc dobrze podzielonego UI, tylko sygnal braku granic miedzy warstwa widoku, stanem, orkiestracja zapisow i logika domenowa.

5. `[HIGH]` Logika domenowa jest bezposrednio przyklejona do komponentow React i Supabase browser client. Liczba bezposrednich wywolan jest bardzo duza: `app/pfmea/page.tsx` ma 22 wywolania `supabase.from(...)` i 6 `supabase.rpc(...)`, `app/pfd/page.tsx` ma 25 `from`, `app/pcp/page.tsx` 17 `from`, `app/projects/page.tsx` 7 `from`. To utrudnia testowanie, reuzycie, walidacje i kontrolowanie side effectow.

6. `[HIGH]` Projekt nie ma dzisiaj skutecznej bramki jakosci. `package.json:6-15` nie definiuje `test`, `typecheck`, `format`, `check` ani nic w stylu `lint:fix`. Workflow `.github/workflows/regression.yml:31-68` buduje aplikacje, ale nie odpala linta; osobny job robi tylko browser regression przy obecnosci sekretow (`.github/workflows/regression.yml:137-220`). Efekt jest taki, ze repo moze byc "zielone" mimo setek bledow statycznych.

7. `[MEDIUM/HIGH]` App Router jest uzyty formalnie, ale nie architektonicznie. Kluczowe ekrany sa `use client` od pierwszej linii: `app/login/page.tsx:1`, `app/projects/page.tsx:1`, `app/pfd/page.tsx:1`, `app/pfmea/page.tsx:1`, `app/pcp/page.tsx:2`, praktycznie wszystkie ustawienia tez. `next build` pokazuje, ze wiekszosc tras jest prerenderowana statycznie jako skorupa `○`, a personalizacja i dane laduja sie potem po stronie klienta. Server Components, Server Actions i route handlers sa prawie niewykorzystane.

8. `[MEDIUM]` TypeScript jest obchodzony zamiast wykorzystywany. W projekcie jest masa `any`, `@ts-ignore`, `eslint-disable`, a backup pliku PFMEA ma `// @ts-nocheck` juz w pierwszej linii (`app/pfmea/pageBackup.tsx:1`). `tsconfig.json:9-11` ma `allowJs`, `skipLibCheck` i `strict`, ale brak wygenerowanych typow Supabase powoduje, ze "strict" ma bardzo ograniczona wartosc praktyczna.

9. `[MEDIUM]` W repo widac mocny debt zwiazany z duplikacja i artefaktami. `app/settings/severity/page.tsx`, `app/settings/occurrence/page.tsx` i `app/settings/detection/page.tsx` sa niemal kopiami tego samego modulu; diff miedzy nimi to tylko ok. 79 insertions / 81 deletions. Dodatkowo istnieja martwe lub mylace pozostalosci jak `src/components/AuthGuard.tsx:1-5`, `src/app/pfd/_lib/nodes/index.ts:3-5`, `app/pfmea/pageBackup.tsx` oraz pusty katalog `app/strategy`.

10. `[MEDIUM]` UX i a11y sa nierowne i maja konkretne regresje. Linki prowadza do nieistniejacych tras: `app/page.tsx:65,75`, `src/components/Layout/AppHeader.tsx:643,850`, a `next build` nie generuje takich route'ow. Menu w naglowku uzywa `span role="button"` (`src/components/Layout/AppHeader.tsx:627-660`) zamiast natywnych przyciskow, pola logowania sa opisane przez `div`, a nie semantyczne `label` (`app/login/page.tsx:181,192,219,247`), `app/layout.tsx:9` ustawia `lang="en"` mimo przewazajacego polskiego UI, a w wielu miejscach sa popsute znaki (`app/page.tsx:89,148,175,205`, `app/settings/sites-departments/page.tsx:119,144,360`, `app/settings/risk-matrix/page.tsx:329`).

11. `[MEDIUM]` Jest co najmniej jeden realny problem bezpieczenstwa w UI: open redirect na logowaniu. `app/login/page.tsx:17` bierze `next` z query stringa i `app/login/page.tsx:49,87` przekazuje to wprost do `window.location.assign(redirectTo)`. To daje mozliwosc przekierowania uzytkownika na dowolny URL po poprawnym logowaniu, jesli ktos poda spreparowany link.

12. `[MEDIUM]` Publiczny formularz request access zapisuje dane bezposrednio do bazy z przegladarki. `app/request-access/page.tsx:28,37` sklada payload po stronie klienta i robi `insert` do `access_requests`. Bez dedykowanego backendu, rate limiting, CAPTCHA i server-side walidacji to proszenie sie o spam i naduzycia.

## Ocena obszarow

| Obszar | Ocena | Komentarz |
|---|---:|---|
| Architektura aplikacji | 3/10 | Funkcjonalnie dziala, ale glowna architektura jest monolityczna, silnie client-side i bardzo slabo wydziela odpowiedzialnosci. |
| Jakosc kodu | 3/10 | Wiele miejsc jest czytelnych lokalnie, ale globalnie projekt ma duzo code smells, copy-paste i obejsc typowania. |
| Standardy Next.js | 2/10 | App Router jest uzyty glownie jako obudowa dla CSR; brak praktycznego wykorzystania server features. |
| TypeScript | 2/10 | Strict mode istnieje na papierze, ale jest podkopywany przez `any`, `@ts-ignore`, `@ts-nocheck` i brak typow backendu. |
| React best practices | 3/10 | Komponenty sa przeladowane stanem, efektami i side effectami; prawie brak custom hookow i warstw posrednich. |
| Bezpieczenstwo | 1/10 | Najwiekszy problem calego rozwiazania. Aktualne skrypty RLS i client-side authorization sa nieakceptowalne dla multi-tenant production. |
| Wydajnosc | 3/10 | Duzy JS po stronie klienta, brak dynamic import, slabe wykorzystanie Next image/server rendering. |
| Bledy i niezawodnosc | 3/10 | Sporo `try/catch`, ale brak transakcyjnosci, error boundaries i przewidywalnych flow recovery. |
| Testowalnosc | 2/10 | Jest custom browser regression, ale brak testow jednostkowych, integracyjnych i e2e frameworka. |
| DX i utrzymanie | 2/10 | Lint nie przechodzi, README jest szablonowe, brak Husky/Prettier/lint-staged i sensownego CI quality gate. |
| UX / dostepnosc | 4/10 | Da sie korzystac, ale sa broken links, focus issues, zla semantyka i niespojne teksty. |

## 1. Architektura aplikacji

Glowne problemy:

- Kluczowe moduly sa implementowane jako ogromne strony z pelna logika aplikacyjna w jednym pliku. To widac szczegolnie w `app/pfmea/page.tsx`, `app/pfd/page.tsx`, `app/pcp/page.tsx`, `app/projects/page.tsx`.
- Root layout zawsze laduje globalne client components `BrowserSessionGuard`, `AppHeader`, `IdleLogout` (`app/layout.tsx:10-14`), wiec nawet publiczne lub proste strony placa koszt hydratacji i logiki sesyjnej.
- Projekt miesza `app/` i `src/` w sposob mylacy. Aktywne route'y sa w `app/`, ale istnieja tez pozostalosci w `src/app/...`, w tym stub `src/app/pfd/_lib/nodes/index.ts:3-5`.
- Separacja odpowiedzialnosci jest slaba: widok, session management, uprawnienia, fetchowanie, walidacja, mapping danych i logika publikacji sa zlane razem.
- Nie ma warstwy `domain/service/repository`. Supabase browser client jest praktycznie data access layer, mutation layer i orchestration layer jednoczesnie.

Metryki zlozonosci:

| Plik | LOC | useState | useEffect | useMemo | useCallback | supabase.from | supabase.rpc |
|---|---:|---:|---:|---:|---:|---:|---:|
| `app/pfmea/page.tsx` | 7271 | 60 | 33 | 20 | 55 | 22 | 6 |
| `app/pfd/page.tsx` | 2938 | 28 | 18 | 8 | 52 | 25 | 1 |
| `app/pcp/page.tsx` | 1526 | 30 | 10 | 6 | 22 | 17 | 2 |
| `app/projects/page.tsx` | 2283 | 41 | 13 | 13 | 0 | 7 | 1 |
| `src/components/Layout/AppHeader.tsx` | 862 | 13 | 8 | 3 | 2 | 0 | 1 |

Wniosek: architektura nie skaluje sie dobrze. Kazda wieksza zmiana w PFMEA/PFD/PCP zwieksza ryzyko regresji, bo zmieniamy "system" zamiast jednego modulu.

## 2. Jakosc kodu

Plusy:

- Widac realna znajomosc procesu produkcyjnego i FMEA.
- W wielu miejscach sa sensowne nazwy biznesowe.
- Jest konsekwencja w tym, ze kazdy modul ma podobny UX edycji draftow i publikacji.

Problemy:

- Styl kodowania jest niespojny. Landing page uzywa Tailwind, ale glowne moduly opieraja sie na ogromnej liczbie inline styles. Same referencje `style={{...}}` / `React.CSSProperties` sa bardzo wysokie: PFMEA 187, Projects 167, PFD 101, PCP 89.
- Jest duzo kodu "ponizej seniora" w sensie maintainability: `any`, casty, fallbacki bez modelu typow, kopiowanie calej logiki miedzy ekranami.
- W repo zostal backup produkcyjnego ekranu z `@ts-nocheck` (`app/pfmea/pageBackup.tsx:1`) oraz pusty `AuthGuard` (`src/components/AuthGuard.tsx:1-5`), co jest oznaka braku hygiene.
- Wystepuja uszkodzone stringi i mojibake, np. `app/page.tsx:89,148,175,205`, `app/settings/sites-departments/page.tsx:119,144,360`, `app/settings/risk-matrix/page.tsx:329`.

## 3. Standardy Next.js

Co jest poprawne:

- Projekt jest formalnie postawiony na App Router.
- Jest `proxy.ts`, jest root layout, sa route handlers dla sign-out.

Co jest niepoprawne lub slabe:

- App Router praktycznie nie daje wartosci architektonicznej, bo niemal wszystko jest client-side.
- Nie ma sensownego wykorzystania Server Components dla ekranow zalogowanych, mimo ze uprawnienia i dane sa krytyczne.
- Nie ma Server Actions dla mutacji; krytyczne zapisy ida z browsera wprost do bazy.
- Nie ma `loading.tsx` ani `error.tsx` dla glownych tras. Wyszukiwanie po `app/` pokazuje tylko jeden route handler: `app/api/auth/signout/route.ts`.
- `next build` oznacza prawie wszystkie strony jako statyczne `○`, wiec spersonalizowane dane nie korzystaja z server-side renderingu, cache policy ani centralnej kontroli dostepu.

Ocena senior: App Router jest tu glownie "opakowaniem", a nie dobrze wykorzystana platforma.

## 4. TypeScript

Problemy:

- Brak wygenerowanych typow Supabase i kontraktow backendowych.
- Duza skala `any`: przyklady z `app/pfmea/page.tsx`, `app/pfd/page.tsx`, `app/pcp/page.tsx`, `app/projects/page.tsx`, `app/settings/*`, `src/components/Layout/AppHeader.tsx`.
- Stosowanie `@ts-ignore` zamiast usuniecia problemu: m.in. `app/settings/severity/page.tsx:373`, `app/settings/occurrence/page.tsx:373`, `app/settings/detection/page.tsx:373`, `app/settings/risk-matrix/page.tsx:537`, `src/components/Layout/AppHeader.tsx:400`.
- `tsconfig.json:9-10` ma `allowJs` i `skipLibCheck`, co przy obecnym stylu kodu bardziej rozmywa granice jakosci niz pomaga.

Co powinno tu byc:

- Generowany typ `Database` z Supabase.
- Typowane DTO dla read/write per modul.
- Typowane utility dla session/user/org context.
- Zakaz `any` poza bardzo waskimi adapterami infrastrukturalnymi.

## 5. React best practices

Problemy:

- Prawie brak custom hookow. Powtarzalne wzorce sesji, timeoutow, cache i retry wystepuja w wielu plikach, np. `app/settings/severity/page.tsx`, `app/settings/occurrence/page.tsx`, `app/settings/detection/page.tsx`, `app/settings/risk-matrix/page.tsx`, `app/settings/invitations/page.tsx`, `app/settings/layout.tsx`, `app/projects/page.tsx`, `src/components/Layout/AppHeader.tsx`.
- W `app/pcp/page.tsx:1538` lint zlapal anty-pattern `setState` w `useEffect`, co moze generowac kaskadowe rerendery.
- `src/components/Layout/AppHeader.tsx` ma brakujace zaleznosci hookow zlapane przez linter (`485`, `491`, `503`), a kod obchodzi to komentarzami i lokalnymi workaroundami.
- Komponenty sa za duze i za "inteligentne". Re-render cost i mental cost sa wysokie, a lokalna optymalizacja przez `useCallback` nie naprawia zlego podzialu odpowiedzialnosci.

## 6. Bezpieczenstwo

Najwieksze ryzyka:

- RLS zbyt szeroki lub wrecz otwarty: `db/control_plan_rows_rls.sql:3,9,47-66`, `db/pfd_editing.sql:60-82`, `db/pfmea_editing.sql:54-62`, `db/pcp_editing.sql:53-61`, `db/pfmea_row_backups.sql:28-29`.
- Frontend jest traktowany jak zaufany klient. To bardzo zly kierunek dla multi-tenant SaaS.
- `app/login/page.tsx:17,49,87` ma open redirect.
- `app/request-access/page.tsx:28,37` robi publiczny insert bez backendowego gate'a.
- Krytyczne delete/update flows sa wykonywane prosto z browsera. Przyklad: `app/pfd/page.tsx:1810-1811` usuwa PFMEA rows i deaktywuje operations z klienta.
- `process.env.NEXT_PUBLIC_SUPABASE_URL!` i `NEXT_PUBLIC_SUPABASE_ANON_KEY!` sa non-null asserted w wielu miejscach (`app/lib/supabaseServer.ts:10-11`, `app/lib/supabaseBrowser.ts:6-7`, `proxy.ts:17-18`, `app/api/auth/signout/route.ts:10-11`) bez jawnej walidacji env.

Uwaga: samo uzycie `anon key` nie jest problemem. Problemem jest to, ze polityki RLS nie wygladaja jak polityki produkcyjne.

## 7. Wydajnosc

Glowne obserwacje:

- Za duzo logiki po stronie klienta. Root layout zawsze ciagnie `AppHeader`, `IdleLogout` i `BrowserSessionGuard`.
- Brak `next/dynamic`, brak lazy loading i brak wydzielenia ciezkich submodulow.
- Landing page i header uzywaja surowego `<img>` zamiast `next/image`: `app/page.tsx:227`, `src/components/Layout/AppHeader.tsx:583`. Linter to wykrywa.
- `app/page.tsx:92-107` i `app/page.tsx:165,227` laduja zasoby z Unsplash bezposrednio z przegladarki. To pogarsza LCP, bandwidth, kontrola CSP oraz prywatnosc.
- Najwieksze zbudowane chunki w `.next/static/chunks` maja ok. 228760 B, 224741 B i 203951 B, co potwierdza duzy koszt JS po stronie klienta.
- `next.config.ts:25` ma `reactStrictMode: false`, co usuwa jedna z podstawowych siatek bezpieczenstwa dla side effectow i wydajnosci.

## 8. Obsluga bledow i niezawodnosc

Plusy:

- W wielu miejscach sa `try/catch` i komunikaty `setErr(...)`.
- Istnieje koncept draftow, lockow i historii zmian.

Problemy:

- Brak route-level `error.tsx` i `loading.tsx`.
- Brak transakcyjnosci save/publish.
- Sporo logiki ma nature "best effort". Przyklady: optional history insert po publikacji PFMEA, cleanup draftu w osobnym kroku, sync metadata po publikacji w `try/catch`.
- `proxy.ts:40-44` redirectuje niezalogowanego uzytkownika na `/`, a nie na `login` z zachowaniem celu. To slabe UX i slaba recoverability flow.
- Czesc logiki opiera sie o storage, cache i heurystyki timeoutow zamiast jednego zaufanego stanu serwerowego.

## 9. Testowalnosc

Aktualny stan:

- Brak testow jednostkowych.
- Brak testow integracyjnych.
- Brak standardowego setupu e2e typu `playwright.config.*`.
- Nie znaleziono projektowych plikow `*.test.*` ani `*.spec.*` w `app/`, `src/` i `scripts/`.
- Jest zestaw niestandardowych skryptow browser regression w `scripts/regression`, co jest wartoscia, ale to za malo jako jedyny filar testowania.

Rekomendowana strategia:

- Unit tests dla helpers, mappingu danych, kalkulacji RPN/OxD, walidatorow formularzy i reducerow/stanow tabel.
- Integration tests dla warstw serwerowych: publikacja rewizji, locking, draft lifecycle, authorization guards.
- E2E dla przeplywow glownych: login, projects, PFD, PFMEA, PCP, invitations.
- Contract tests dla RPC i polityk dostepu.

## 10. Developer experience i utrzymanie

Problemy:

- `README.md:1-36` jest nadal szablonem create-next-app i nie dokumentuje nic o domenie, Supabase, modelu danych, seedach, RLS, workflow deploy ani testach.
- Brak Prettier, Husky, lint-staged, typecheck script, test script.
- Lint obejmuje skrypty CommonJS i tymczasowe pliki rootowe, ale brak sensownych override'ow i ignore list. To tworzy szum zamiast dobrego feedbacku.
- `.gitignore` nie ignoruje `test-results/`, screenshotow i `tmp-*`, co widac po artefaktach w rootcie repo.
- W projekcie sa pliki tymczasowe i debugowe w rootcie, np. `tmp-pfmea-*`, `timeflow360-dev.*`, `pcp-save-regression-failure.png`.

Co jest na plus:

- Jest workflow browser regression.
- Jest pewna dyscyplina wokol regresji najwrazliwszych flow.

## 11. UX / dostepnosc

Problemy:

- Broken links: `app/page.tsx:65,75`, `src/components/Layout/AppHeader.tsx:643,850`.
- Menu na `span role="button"` bez natywnych zachowan klawiatury: `src/components/Layout/AppHeader.tsx:627-660`.
- `role="menu"` bez pelnej semantyki menuitem i focus management: `src/components/Layout/AppHeader.tsx:818`.
- Logowanie ma pseudo-labele przez `div`, a nie semantyczne `label`: `app/login/page.tsx:181,192,219,247`.
- `app/login/page.tsx:329-338` i `app/request-access/page.tsx:133-140` usuwaja outline i nie dodaja wyraznych custom focus states.
- `app/layout.tsx:9` ma `lang="en"` przy polsko-angielskim UI.
- Teksty maja niespojna lokalizacje i miejscami uszkodzone kodowanie.

## Dodatkowe obserwacje szczegolowe

- `app/globals.css:13-14` zaklada zmienne fontow Geist, ale projekt nie laduje `next/font`; jednoczesnie `app/globals.css:24-27` ustawia `Arial, Helvetica, sans-serif`. To kolejny sygnal niespojnosci i niedokonczonego refactoru.
- `app/page.tsx` zawiera marketingowe linki do modulow, ktorych w repo nie ma.
- `src/components/AuthGuard.tsx:1-5` jest martwym placeholderem i niczego nie guarduje.
- `src/app/pfd/_lib/nodes/index.ts:3-5` samo przyznaje, ze to "legacy src/app PFD tree", co potwierdza zalegly debt architektoniczny.

## Co zostawilbym jako roadmapa naprawcza

1. Najpierw bezpieczenstwo.
Przeniesc krytyczne mutacje do server-side boundary, przeprojektowac RLS per organization/project/user, usunac `using (true)` i polityki "auth.uid() is not null" jako jedyna kontrole. Zamknac open redirect i publiczny insert bez rate limiting.

2. Potem rozbicie monolitow.
Wyciagnac `services`, `repositories`, `mappers`, `validators`, custom hooki i mniejsze komponenty tabelaryczne. PFMEA/PFD/PCP powinny miec osobne warstwy: read model, edit session, publish flow, UI composition.

3. Potem bramki jakosci.
Dodac `typecheck`, sensowny lint, testy jednostkowe/integracyjne, CI dla linta i typechecka, sensowne ignore rules dla artefaktow, generated Supabase types i walidacje env.

4. Na koniec UX/a11y/perf.
Naprawic broken links, przejsc na semantyczne controlsy, dodac focus states, uporzadkowac jezyk interfejsu, wdrozyc `next/image`, dynamic imports i odchudzic globalny header.

## Finalna ocena

Produkt wyglada jak ambitny i funkcjonalny prototyp domenowy, ale nie jak dojrzaly frontend produkcyjny. Najwiekszym problemem nie jest estetyka kodu, tylko to, ze obecna architektura i polityki danych nie daja wystarczajacego bezpieczenstwa ani przewidywalnosci przy dalszym rozwoju zespolowym.

Jesli mialbym to ocenic jednym zdaniem:

Silne know-how domenowe, slaba architektura aplikacyjna i bardzo wysoki priorytet na hardening bezpieczenstwa oraz refaktor warstw odpowiedzialnosci.
