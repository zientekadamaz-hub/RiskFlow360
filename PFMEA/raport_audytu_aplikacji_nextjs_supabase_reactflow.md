# Raport audytu aplikacji Next.js + Supabase + React Flow

Data audytu: 2026-04-23

## 1. Executive summary

Aplikacja jest juz w znacznie lepszym stanie niz na poczatku poprzednich przegladow: `npm run check` przechodzi, najgorsze otwarcia RLS zostaly domkniete, a warstwa settings ma czesc wspolnych komponentow. To jednak nadal nie jest kod na poziomie dojrzalego systemu produkcyjnego prowadzonego przez silny zespol senior/staff.

Najwiekszy problem nie polega juz na pojedynczych bugach, tylko na tym, ze system jest nadal zbyt mocno oparty o ogromne klientowe pliki stron, bez wyraznego podzialu na warstwe UI, logike domenowa, operacje danych i kontrakty typow. `PFMEA`, `PFD`, `PCP` i `Projects` sa monolitami obslugujacymi jednoczesnie routing, auth, cache, stan edytora, walidacje, komunikacje z Supabase i rendering UI. Taka konstrukcja skaluje sie zle, jest trudna do testowania i drogo ja rozwijac.

Po stronie Supabase sytuacja jest juz duzo bezpieczniejsza niz wczesniej, ale model uprawnien nadal nie jest domkniety. Nadal istnieja polityki definiowane na roli `public`, nadal sa `SECURITY DEFINER` funkcje dostepne dla `authenticated`, a co wazniejsze: czesc uprawnien biznesowych jest nadal niespojna z ustalonym modelem rol. Najbardziej widoczny problem to `site_departments`, gdzie live RLS pozwala na operacje kazdemu czlonkowi organizacji, mimo ze semantycznie jest to obszar ustawien administracyjnych.

Po stronie Next.js aplikacja formalnie korzysta z App Routera, ale praktycznie prawie wszystkie istotne ekrany sa klientowymi kontenerami. To oznacza duzy bundle, duzo logiki wykonywanej w przegladarce i slabe wykorzystanie mechanizmow server-side. Jednoczesnie repo ma sprzeczny obraz architektury: README twierdzi, ze publiczne trasy uzywaja wspolnego public shell, ale `app/layout.tsx` nadal renderuje bezposrednio `AppHeader`, a `AppChrome` i `PublicHeader` sa faktycznie martwa lub pol-martwa architektura.

Wniosek koncowy: to jest aplikacja dzialajaca i rokujaca, ale nadal bardziej "produkcyjny prototyp" niz system utrzymywany na poziomie Staff Engineer. Z punktu widzenia dalszego rozwoju najpilniejsze nie sa juz kosmetyczne poprawki, tylko:

- rozbicie monolitow `PFMEA` / `PFD` / `PCP`,
- wyciecie logiki uprawnien z komponentow do jednej warstwy policy/service,
- zamkniecie remaining riskow w auth/invitation/Supabase,
- zbudowanie prawdziwej strategii testow i migracji.

## 2. Ocena obszarow w skali 1-10

| Obszar | Ocena | Komentarz |
|---|---:|---|
| Architektura aplikacji | 5/10 | Dziala, ale za duzo logiki siedzi w monolitycznych stronach i klientowych komponentach. |
| Next.js best practices | 5/10 | App Router jest, ale serwerowe mozliwosci Next.js sa wykorzystywane slabo. |
| React best practices | 4/10 | Duze komponenty, duzo lokalnego stanu, slaba separacja i niski poziom kompozycji w modulach core. |
| TypeScript | 5/10 | `strict` jest wlaczone, ale realna jakosc typowania jest podwazana przez `any` i obejscia lint. |
| Supabase | 6/10 | Bezpieczenstwo wzroslo, ale model ról/RLS nadal nie jest calkowicie spójny i zbyt wiele operacji jest klientowych. |
| React Flow | 5/10 | Edytor jest funkcjonalny, ale architektura i wydajnosc dla wiekszych diagramow sa ryzykowne. |
| Bezpieczenstwo | 6/10 | Brak juz najgorszych dziur, ale invitation/auth/request-access nadal maja realne luki procesowe i anty-abuse. |
| Wydajnosc | 5/10 | Monolity klientowe i ciezki stan lokalny beda skalowac sie slabo wraz z danymi. |
| Jakosc kodu | 4/10 | Duza nierownosc poziomu, mieszanie stylow i sporo kodu, ktory nadal nie wyglada jak senior-level baseline. |
| Testowalnosc | 3/10 | Brak testow jednostkowych i integracyjnych, jest glownie niestandardowy browser regression harness. |
| Developer Experience | 5/10 | `check` i CI sa na plus, ale brak pelnego workflow migracji, pre-commit i spójnej dokumentacji. |
| UI / UX / spojnosc | 5/10 | Widac postep, ale system stylow jest nadal mieszany, a copy/locale bywa niespojny. |

## 3. Najwazniejsze problemy wg priorytetow

### CRITICAL

1. Monolityczne moduly biznesowe (`app/pfmea/page.tsx`, `app/pfd/page.tsx`, `app/pcp/page.tsx`, `app/projects/page.tsx`).
2. Model dostepu nadal nie jest domkniety semantycznie po stronie Supabase.
3. Invitation-first access nie jest wymuszony na warstwie auth, tylko glownie na warstwie UI.
4. `request-access` nie ma realnych mechanizmow anty-abuse.

### HIGH

1. App Router jest wykorzystywany glownie jako hosting dla duzych client components.
2. Kod omija lint/typing w najbardziej krytycznych obszarach.
3. React Flow ma kosztowne wzorce renderowania i stanowe hotspoty.
4. Warstwa danych jest zbyt mocno sprzezona z komponentami.
5. Brakuje prawdziwej strategii testow.
6. Repo ma niespojnosci architektoniczne i martwe elementy shell/layout.

### MEDIUM

1. Mixed styling stack: Tailwind + inline styles + lokalne style obiektowe + legacy CSS.
2. Duza ilosc cache i auth state w `sessionStorage` / `localStorage`.
3. Twarde `window.location.assign(...)` zamiast spójnej nawigacji.
4. Dokumentacja i DX nie nadazaja za rzeczywista architektura.
5. Czesciowe problemy accessibility i spójnosci copy.

### LOW

1. Homepage ma jeszcze slady problemow z copy/encoding.
2. Legacy redirecty maskuja brakujace funkcje zamiast je formalnie ukrywac.

## 4. Szczegolowy audyt

### 4.1 Architektura aplikacji

#### Problem A1
1. Co jest nie tak:
   `app/pfmea/page.tsx` ma ok. 7396 linii, `app/pfd/page.tsx` ok. 3091 linii, `app/pcp/page.tsx` ok. 1587 linii, `app/projects/page.tsx` ok. 2409 linii. W tych plikach sa jednoczesnie typy, helpery, logika domenowa, auth, cache, transformacje danych, komunikacja z Supabase i rendering.
2. Dlaczego to problem:
   Taki modul jest trudny do zrozumienia, review, testowania i bezpiecznej zmiany. Jedna poprawka moze naruszyc kilka odpowiedzialnosci naraz.
3. Jak powinno to wygladac na poziomie senior developer:
   Osobne warstwy: `queries/services`, `state hooks`, `view components`, `React Flow adapters`, `domain rules`, `mapping/serialization`.
4. Jak to poprawic:
   Rozciac kazdy modul co najmniej na:
   - `page-shell` / route container,
   - `use*PageState`,
   - `*Repository` / `*Service`,
   - `*Table`, `*Toolbar`, `*Dialogs`, `*SessionBanner`,
   - osobny plik z typami domenowymi.
5. Priorytet:
   CRITICAL

#### Problem A2
1. Co jest nie tak:
   Root layout nadal renderuje bezposrednio `AppHeader`, `BrowserSessionGuard` i `IdleLogout` (`app/layout.tsx:2-13`), podczas gdy repo zawiera osobny `AppChrome` z rozroznieniem public/public-header (`src/components/Layout/AppChrome.tsx:10-23`) i helper `usesPublicHeader` (`src/lib/routing.ts:32`).
2. Dlaczego to problem:
   To oznacza rozjechanie rzeczywistej architektury z zamierzona. Powstaje martwy kod i trudno przewidziec, ktora warstwa faktycznie kontroluje layout i auth.
3. Jak powinno to wygladac na poziomie senior developer:
   Jedna odpowiedzialna warstwa shell/chrome, bez duplikatow.
4. Jak to poprawic:
   Albo:
   - uzyc `AppChrome` faktycznie w `app/layout.tsx`,
   albo:
   - skasowac `AppChrome`, `PublicHeader` i `usesPublicHeader`, jesli nie sa elementem architektury docelowej.
5. Priorytet:
   HIGH

#### Problem A3
1. Co jest nie tak:
   Warstwa danych jest w praktyce rozlana po stronach i komponentach. `supabase.from(...)` i `supabase.rpc(...)` sa wywolywane bezposrednio z widokow, np. `app/projects/page.tsx:494-599`, `app/pfd/page.tsx:736-941`, `app/pfmea/page.tsx:1912-3653`, `app/pcp/page.tsx:523-1032`, `app/settings/sites-departments/page.tsx:221-245`.
2. Dlaczego to problem:
   UI zna za duzo szczegolow schematu i RLS. Przy kazdej zmianie bazy lub kontraktu dotykasz renderingu, co zabija testowalnosc i czytelnosc.
3. Jak powinno to wygladac na poziomie senior developer:
   Komponent powinien rozmawiac z abstrakcja typu `PfmeaDraftService`, `ProjectsRepository`, `OrgInvitationService`.
4. Jak to poprawic:
   Wyciagnac wszystkie operacje DB do `src/lib/supabase/*` albo `src/features/*/data/*`, zwracajac jawne DTO i błędy domenowe.
5. Priorytet:
   HIGH

### 4.2 Next.js best practices

#### Problem N1
1. Co jest nie tak:
   Prawie wszystkie istotne strony sa `use client`, m.in. `app/login/page.tsx`, `app/projects/page.tsx`, `app/pfd/page.tsx`, `app/pfmea/page.tsx`, `app/pcp/page.tsx`, wiekszosc settings.
2. Dlaczego to problem:
   App Router traci wiekszosc przewag: server rendering danych, lepsze cache, mniejszy bundle, prostszy auth boundary.
3. Jak powinno to wygladac na poziomie senior developer:
   Strona route-level powinna byc server-first, a klientowe komponenty tylko tam, gdzie sa potrzebne interakcje.
4. Jak to poprawic:
   - Przeniesc session/bootstrap i read-only fetch do server components.
   - Zostawic `use client` tylko dla edytorow, formularzy i interaktywnych fragmentow.
   - Rozwazyc route-level `loading.tsx` i `error.tsx`.
5. Priorytet:
   HIGH

#### Problem N2
1. Co jest nie tak:
   `reactStrictMode` jest wylaczone (`next.config.ts:25`).
2. Dlaczego to problem:
   Tracisz jeden z najtanszych mechanizmow wykrywania side-effectow i problemow z kompatybilnoscia React 19.
3. Jak powinno to wygladac na poziomie senior developer:
   Strict mode wlaczony, a efekty naprawione zamiast ukryte.
4. Jak to poprawic:
   Wlaczyc `reactStrictMode: true`, uruchomic regresje i poprawic miejsca, ktore polegaja na niebezpiecznych efektach.
5. Priorytet:
   HIGH

#### Problem N3
1. Co jest nie tak:
   Brak route-level `loading.tsx` i `error.tsx`. Audyt nie wykryl ani jednego takiego pliku w `app/`.
2. Dlaczego to problem:
   Bledy i stany oczekiwania sa obslugiwane ad hoc w komponentach, co daje niespójny UX i trudniejszy recovery path.
3. Jak powinno to wygladac na poziomie senior developer:
   Krytyczne moduly powinny miec route-level fallbacki i boundaries.
4. Jak to poprawic:
   Dodac `loading.tsx` i `error.tsx` przynajmniej dla `/projects`, `/pfd`, `/pfmea`, `/pcp`, `/settings/*`.
5. Priorytet:
   MEDIUM

#### Problem N4
1. Co jest nie tak:
   Brakujace funkcje sa maskowane redirectami w `next.config.ts:36-58` (`/actions`, `/reports`, `/reports/progress`, `/task-management` -> `/projects`), a homepage nadal promuje te obszary jako moduly produktu (`app/page.tsx:67-84`).
2. Dlaczego to problem:
   To jest mylace produktowo i ukrywa debt zamiast go kontrolowac.
3. Jak powinno to wygladac na poziomie senior developer:
   Menu i landing page powinny pokazywac tylko realnie dostepne funkcje albo oznaczac je jako roadmap/coming soon.
4. Jak to poprawic:
   Albo wdrozyc te moduly, albo usunac je z nawigacji i homepage, albo oznaczyc wprost jako niedostepne.
5. Priorytet:
   MEDIUM

### 4.3 React best practices

#### Problem R1
1. Co jest nie tak:
   Najwazniejsze komponenty stron sa gigantycznymi kontenerami z setkami lokalnych stanow i callbackow, np. `app/pfmea/page.tsx`, `app/pfd/page.tsx`, `app/pcp/page.tsx`.
2. Dlaczego to problem:
   Re-render tree jest trudny do kontrolowania, a logika UI miesza sie z logika domenowa.
3. Jak powinno to wygladac na poziomie senior developer:
   Podzial na male komponenty i custom hooki z jasno zdefiniowanymi wejściami/wyjsciami.
4. Jak to poprawic:
   Wyciagnac:
   - session lock banner,
   - history dialogs,
   - column config,
   - table row editors,
   - publish/discard controls,
   - data bootstrap hooks.
5. Priorytet:
   CRITICAL

#### Problem R2
1. Co jest nie tak:
   Aplikacja szeroko uzywa twardych `window.location.assign(...)`, np. `app/login/page.tsx:63,131,165`, `app/settings/layout.tsx:54`, `src/components/Layout/AppHeader.tsx:361,520`.
2. Dlaczego to problem:
   To robi pelny reload, traci lokalny stan, utrudnia suspense/nawigacje App Routera i zaciemnia flow.
3. Jak powinno to wygladac na poziomie senior developer:
   `router.push` / `router.replace` dla zwyklych przejsc, hard reload tylko tam, gdzie jest rzeczywiscie wymagany.
4. Jak to poprawic:
   Zdefiniowac policy navigation helper i ograniczyc hard redirects do sign-out/token reset edge-case.
5. Priorytet:
   MEDIUM

#### Problem R3
1. Co jest nie tak:
   Wiele miejsc trzyma stan i cache w `sessionStorage` / `localStorage` (`AppHeader`, `BrowserSessionGuard`, `IdleLogout`, `SettingsLayout`, `PFMEA`, `Projects`, `Invitations`, `Risk Matrix`).
2. Dlaczego to problem:
   Stan auth i uprawnien staje sie rozproszony i trudny do przewidzenia. To szczegolnie ryzykowne przy kilku kartach i zmianach sesji.
3. Jak powinno to wygladac na poziomie senior developer:
   Minimalny lokalny cache, jasno okreslone ownership i TTL, centralny adapter session/auth state.
4. Jak to poprawic:
   Zostawic tylko cache dla niekrytycznych preferencji UI, a session/access decisions ujednolicic w jednym klienckim store lub server-first flow.
5. Priorytet:
   HIGH

### 4.4 TypeScript

#### Problem T1
1. Co jest nie tak:
   Lint celowo wyłącza `@typescript-eslint/no-explicit-any` dla najtrudniejszych stron (`eslint.config.mjs:27-40`) oraz `ban-ts-comment` dla risk matrix (`eslint.config.mjs:50-54`).
2. Dlaczego to problem:
   To znaczy, ze typowanie jest "formalne", ale niekoniecznie realne tam, gdzie ryzyko regresji jest najwyzsze.
3. Jak powinno to wygladac na poziomie senior developer:
   Najbardziej krytyczne moduly powinny miec najsilniejsze typowanie, a nie najwieksze wyjatki.
4. Jak to poprawic:
   Wrocic do surowych reguł modul po module, zaczynajac od `projects`, `risk-matrix`, potem `pfd`, `pfmea`, `pcp`.
5. Priorytet:
   HIGH

#### Problem T2
1. Co jest nie tak:
   Nadal jest duzo `any` w warstwie krytycznej, np. `app/projects/page.tsx:94,230,403-409,479...`, `app/pfd/page.tsx:102,890,1037,1232,1658...`, `app/pfmea/page.tsx:412,421,1926,1992...`, `app/pcp/page.tsx:823,854,900...`, `app/settings/sites-departments/page.tsx:140,149,162,172`.
2. Dlaczego to problem:
   To ukrywa bledne inferencje, utrudnia refaktor i powoduje, ze contract drift z baza wychodzi dopiero w runtime.
3. Jak powinno to wygladac na poziomie senior developer:
   Jawne typy DTO, parse layer dla danych z Supabase i helpery normalizujace bez `any`.
4. Jak to poprawic:
   Wprowadzic:
   - `Db*Row` / `Ui*Model`,
   - parsery `zod` lub reczne guardy,
   - typed repositories dla zapytan i RPC.
5. Priorytet:
   HIGH

#### Problem T3
1. Co jest nie tak:
   `tsconfig.json` nadal ma `allowJs: true` (`tsconfig.json:9`), mimo ze repo praktycznie nie buduje aplikacji z JS poza skryptami regresji.
2. Dlaczego to problem:
   To rozmywa granice repo i moze w przyszlosci przepuscic niekontrolowane JS do app layer.
3. Jak powinno to wygladac na poziomie senior developer:
   Aplikacja TS-only, a skrypty techniczne odseparowane.
4. Jak to poprawic:
   Rozwazyc `allowJs: false` dla app/src i osobny tsconfig lub po prostu pozostawic JS wyłącznie dla `scripts/`.
5. Priorytet:
   LOW

### 4.5 Supabase

#### Problem S1
1. Co jest nie tak:
   Live snapshot pokazuje nadal 26 polityk RLS zdefiniowanych na roli `public` dla tabel takich jak `operations`, `pfd_diagrams`, `pfd_nodes`, `pfd_edges`, `pfmea_rows`, `process_revisions`, `site_departments`.
2. Dlaczego to problem:
   Nawet jesli granty tabelowe zostaly zawężone, polityki na `public` sa semantycznie zbyt szerokie i podbijaja ryzyko przyszlego regresu uprawnien.
3. Jak powinno to wygladac na poziomie senior developer:
   Polityki powinny byc przypisane do `authenticated` lub waskich ról, chyba ze publiczny dostep jest intencjonalny i udokumentowany.
4. Jak to poprawic:
   Przepisac remaining policies na `authenticated`, zostawiajac `public` tylko tam, gdzie jawnie akceptujesz anonimowy use-case.
5. Priorytet:
   HIGH

#### Problem S2
1. Co jest nie tak:
   `site_departments` ma live polityki pozwalajace kazdemu czlonkowi organizacji na `SELECT`, `INSERT`, `DELETE` (`pg_policies` snapshot, tabela `site_departments`), podczas gdy to obszar ustawien administracyjnych.
2. Dlaczego to problem:
   To jest niezgodne z ustalonym modelem ról i pozwala zwyklemu `engineer` modyfikowac konfiguracje organizacji.
3. Jak powinno to wygladac na poziomie senior developer:
   `settings` powinny byc spójnie ograniczone do `global admin` oraz `champion/org admin`.
4. Jak to poprawic:
   Zmienic RLS `site_departments` tak, by write path byl oparty o `is_org_admin_or_champion_v2(...)`, a read zgodny z wymaganym zakresem biznesowym.
5. Priorytet:
   CRITICAL

#### Problem S3
1. Co jest nie tak:
   Kluczowe funkcje nadal sa `SECURITY DEFINER` i dostepne dla `authenticated`, m.in. `accept_invitation`, `ensure_process_draft`, `publish_process_module_revision`, `get_my_header`.
2. Dlaczego to problem:
   To nie jest zle samo w sobie, ale oznacza bardzo waski margines bledu. Kazdy kontrakt i walidacja w srodku funkcji musi byc perfekcyjny.
3. Jak powinno to wygladac na poziomie senior developer:
   `SECURITY DEFINER` tylko tam, gdzie to konieczne, z minimalna powierzchnia i najlepiej wywolaniem z warstwy server-side, a nie bezposrednio z klienta.
4. Jak to poprawic:
   Zrobic review funkcja po funkcji:
   - usunac martwe parametry `p_user_id` z sygnatur,
   - przeniesc czesc wywolan do route handlers/server actions,
   - utrzymac audit trail i testy kontraktowe RPC.
5. Priorytet:
   HIGH

#### Problem S4
1. Co jest nie tak:
   Flow zaproszen nadal polega na klientowym `supabase.auth.signUp(...)` (`app/login/page.tsx:116-137`) do ustawienia pierwszego hasla.
2. Dlaczego to problem:
   To oznacza, ze model "dostep tylko po zaproszeniu" nie jest wymuszony na warstwie auth. Mozna tworzyc konta auth poza procesem organizacyjnym.
3. Jak powinno to wygladac na poziomie senior developer:
   Invitation-only onboarding powinien byc wymuszony przez konfiguracje auth i/lub server-side token exchange, nie przez warunkowy przycisk w UI.
4. Jak to poprawic:
   Docelowo:
   - wyłączyc otwarte self-signup w Supabase Auth,
   - stworzyc serwerowy activation endpoint powiazany z invitation tokenem,
   - dopiero po walidacji tworzyc/aktywować konto.
5. Priorytet:
   CRITICAL

#### Problem S5
1. Co jest nie tak:
   Repo nadal zarzadza baza przez luźne pliki SQL w `db/`, bez formalnego systemu migracji i bez checka driftu schema<->repo.
2. Dlaczego to problem:
   To jest proszenie sie o drift, niepowtarzalne wdrozenia i "dziala na moim projekcie Supabase".
3. Jak powinno to wygladac na poziomie senior developer:
   Migracje wersjonowane, odtwarzalne i walidowane w CI.
4. Jak to poprawic:
   Ustandaryzowac proces:
   - Supabase migrations jako source of truth,
   - schema drift check w CI,
   - opisane sekwencje rollout/rollback.
5. Priorytet:
   HIGH

### 4.6 React Flow

#### Problem F1
1. Co jest nie tak:
   `app/pfd/page.tsx` laczy logike edytora PFD, mini-panel PFMEA, session locking, publish, drafts, operacje na diagramie i DB sync w jednym komponencie.
2. Dlaczego to problem:
   React Flow sam z siebie jest wymagajacy wydajnosciowo; gdy dokladasz do tego caly stan biznesowy w jednym module, kazda zmiana staje sie ryzykowna.
3. Jak powinno to wygladac na poziomie senior developer:
   Osobne warstwy:
   - graph state adapter,
   - node/edge serializers,
   - editor commands,
   - persistence layer,
   - mini-panel integration.
4. Jak to poprawic:
   Wyodrebnic `usePfdEditorState`, `usePfdPersistence`, `usePfdSessions`, `usePfmeaMiniPanel`.
5. Priorytet:
   CRITICAL

#### Problem F2
1. Co jest nie tak:
   `OperationNode` trzyma lokalny stan `hot` i aktualizuje go na `onMouseMove` (`app/pfd/_lib/nodes/OperationNode.tsx`), a `OrthEdge` parsuje path i oblicza handle geometry w runtime dla kazdej krawedzi (`app/pfd/_lib/edges/OrthEdge.tsx`).
2. Dlaczego to problem:
   Przy wiekszych diagramach robi sie z tego realny koszt renderowania i interakcji.
3. Jak powinno to wygladac na poziomie senior developer:
   Minimalny stan w node/edge components, predykcja geometrii i throttling/interakcje oparte na prostszych mechanizmach.
4. Jak to poprawic:
   - ograniczyc `mousemove` state updates,
   - rozważyć memoizacje wyzej lub lekkie pointer heuristics,
   - zweryfikowac czy wszystkie draggable handles sa rzeczywiscie potrzebne always-on.
5. Priorytet:
   HIGH

#### Problem F3
1. Co jest nie tak:
   CSS React Flow jest importowany globalnie w `app/globals.css:2` i dodatkowo w `app/pfd/page.tsx:21`.
2. Dlaczego to problem:
   To jest niepotrzebna duplikacja i sygnal braku jasnego ownership stylow biblioteki.
3. Jak powinno to wygladac na poziomie senior developer:
   Jedno miejsce importu bibliotecznego CSS.
4. Jak to poprawic:
   Zostawic globalny import i usunac lokalny import z `app/pfd/page.tsx`.
5. Priorytet:
   MEDIUM

### 4.7 Bezpieczenstwo

#### Problem B1
1. Co jest nie tak:
   `app/api/request-access/route.ts:13-47` ma walidacje payloadu, ale nie ma rate limitu, captcha, throttlingu po IP/email ani idempotency protection.
2. Dlaczego to problem:
   Endpoint jest publiczny i moze byc spamowany lub wykorzystywany do zalewania `access_requests`.
3. Jak powinno to wygladac na poziomie senior developer:
   Publiczny endpoint powinien miec przynajmniej podstawowe warstwy anty-abuse.
4. Jak to poprawic:
   Dodac:
   - rate limit per IP/email,
   - captcha/hCaptcha/Turnstile,
   - deduplikacje requestow,
   - audit/logging.
5. Priorytet:
   CRITICAL

#### Problem B2
1. Co jest nie tak:
   `request-access` route tworzy klienta na anon key (`app/api/request-access/route.ts:6-11`), czyli route handler nie wnosi realnej izolacji serwerowej poza walidacja.
2. Dlaczego to problem:
   To tylko "server veneer". W praktyce bezpieczniejsza polityka biznesowa nadal siedzi poza backendem aplikacji.
3. Jak powinno to wygladac na poziomie senior developer:
   Serwer powinien byc miejscem egzekwowania polityki anty-abuse i workflow, a nie tylko przelotka do tej samej bazy z tym samym anon contextem.
4. Jak to poprawic:
   Albo:
   - uzyc server-only backend function z dodatkowymi zabezpieczeniami,
   albo:
   - przyznac, ze to swiadomie publiczny write path, ale uzupelnic go o kontrolki ochronne.
5. Priorytet:
   HIGH

#### Problem B3
1. Co jest nie tak:
   Auth/session control jest rozproszony miedzy `proxy.ts`, `BrowserSessionGuard`, `IdleLogout`, `SettingsLayout`, `AppHeader`, `client-session.ts`.
2. Dlaczego to problem:
   Rozproszone decyzje dostepowe sa trudne do zweryfikowania i latwo o niespojnosc edge-case.
3. Jak powinno to wygladac na poziomie senior developer:
   Jedna glowna strategia auth boundary, plus minimalne pomocnicze cache.
4. Jak to poprawic:
   Uproscic architekture:
   - proxy/middleware tylko dla coarse access,
   - jedna warstwa klientowa dla sesji,
   - jedna warstwa server-side dla protected reads/writes.
5. Priorytet:
   HIGH

### 4.8 Wydajnosc

#### Problem W1
1. Co jest nie tak:
   Najwieksze strony sa potężnymi client components, wiec caly kod, helpery i logika trafiaja do klienta.
2. Dlaczego to problem:
   Rosnie bundle, czas inicjalizacji i koszt hydration.
3. Jak powinno to wygladac na poziomie senior developer:
   Server-first route, a klient tylko dla prawdziwej interakcji.
4. Jak to poprawic:
   Rozciac bootstrap danych na server components i lazily ladowac ciezkie fragmenty edytora.
5. Priorytet:
   HIGH

#### Problem W2
1. Co jest nie tak:
   Home hero ma sztywne `grid-cols-6` dla kart modulow (`app/page.tsx:195`), co na mniejszych ekranach daje ciasny layout zamiast adaptacyjnego grida.
2. Dlaczego to problem:
   To pogarsza czytelnosc i mobile UX.
3. Jak powinno to wygladac na poziomie senior developer:
   Responsywny grid typu `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`.
4. Jak to poprawic:
   Zmienic top module grid na responsywny i nie opierac sekcji hero na desktopowej siatce 6-kolumnowej.
5. Priorytet:
   MEDIUM

### 4.9 Jakosc kodu

#### Problem J1
1. Co jest nie tak:
   Repo miesza kilka stylow implementacyjnych naraz:
   - Tailwind utility classes (`app/page.tsx`, `src/components/ui/primitives.tsx`),
   - rozbudowane inline `CSSProperties` (`src/features/settings/invitation-shell.tsx`),
   - stylowanie stricte wewnatrz duzych stron (`pfd`, `pfmea`, `pcp`, `risk-matrix`).
2. Dlaczego to problem:
   Zespol nie ma jednego stylu pracy. To spowalnia review i wprowadza chaos.
3. Jak powinno to wygladac na poziomie senior developer:
   Jeden glowny system UI i jeden preferowany styl implementacji.
4. Jak to poprawic:
   Ustalic standard:
   - Tailwind + headless primitives,
   albo:
   - CSS modules / styled components,
   ale nie miks wszystkiego.
5. Priorytet:
   HIGH

#### Problem J2
1. Co jest nie tak:
   README deklaruje architekture, ktora nie odpowiada rzeczywistosci (`README.md:53-58` vs `app/layout.tsx:2-13`).
2. Dlaczego to problem:
   Dokumentacja, ktora mija sie z kodem, szkodzi bardziej niz jej brak.
3. Jak powinno to wygladac na poziomie senior developer:
   README ma opisywac stan faktyczny albo architekture docelowa oznaczona jako roadmap.
4. Jak to poprawic:
   Urealnic README i dodac sekcje:
   - auth flow,
   - invitation flow,
   - data model,
   - Supabase deploy process,
   - known constraints.
5. Priorytet:
   MEDIUM

#### Problem J3
1. Co jest nie tak:
   Homepage ma artefakty encoding/copy (`app/page.tsx:91`, `app/page.tsx:150`, `app/page.tsx:180`, `app/page.tsx:206`).
2. Dlaczego to problem:
   To daje wrazenie nieskonczonego, niestarannie utrzymanego produktu.
3. Jak powinno to wygladac na poziomie senior developer:
   Zero mojibake i jeden spójny standard copy.
4. Jak to poprawic:
   Przejrzec pliki publiczne i ustawic jeden standard encoding + locale copy review.
5. Priorytet:
   LOW

### 4.10 Testowalnosc

#### Problem TST1
1. Co jest nie tak:
   Repo nie zawiera realnych testow jednostkowych ani integracyjnych. Nie ma `*.test.*`, `*.spec.*`, Vitest/Jest config. Istnieja tylko niestandardowe skrypty regresji w `scripts/regression/*`.
2. Dlaczego to problem:
   Taki zestaw nie chroni logiki domenowej i nie daje szybkiego feedbacku. Browser smoke tests sa zbyt drogie, by zastapic unit/integration tests.
3. Jak powinno to wygladac na poziomie senior developer:
   Test pyramid:
   - unit dla mapperow i domeny,
   - integration dla Supabase adapters / route handlers / RPC contracts,
   - e2e dla krytycznych flow.
4. Jak to poprawic:
   Dodac:
   - Vitest dla logiki,
   - testy route handlers,
   - kontraktowe testy RPC,
   - Playwright e2e na invitation/login/draft/publish.
5. Priorytet:
   CRITICAL

#### Problem TST2
1. Co jest nie tak:
   Obecne browser regression to skrypty Node + Playwright uruchamiane sekwencyjnie (`scripts/regression/run-all.js`) bez frameworkowego raportowania test case per case.
2. Dlaczego to problem:
   Trudniej diagnozowac awarie, parametryzowac przypadki i budowac pokrycie.
3. Jak powinno to wygladac na poziomie senior developer:
   Normalny test runner Playwright z test cases, fixtures i artefaktami per scenariusz.
4. Jak to poprawic:
   Migrowac custom scripts do `@playwright/test`.
5. Priorytet:
   HIGH

### 4.11 Developer Experience

#### Problem DX1
1. Co jest nie tak:
   W repo nie widac Prettiera, Husky, lint-staged ani pre-commit policy. Jest tylko `eslint`, `typecheck`, `build` i jeden workflow regresji.
2. Dlaczego to problem:
   Jakosc zalezy bardziej od dyscypliny autora niz od procesu.
3. Jak powinno to wygladac na poziomie senior developer:
   Minimalny pipeline lokalny i CI powinien wymuszac podstawowy standard.
4. Jak to poprawic:
   Dodac:
   - Prettier,
   - Husky + lint-staged,
   - dedykowany workflow `quality` i osobny `e2e`,
   - schema drift check dla Supabase.
5. Priorytet:
   MEDIUM

#### Problem DX2
1. Co jest nie tak:
   `README.md` praktycznie nie tlumaczy architektury domenowej, RLS, migracji, modelu ról, invitation flow ani jak odtworzyc Supabase state.
2. Dlaczego to problem:
   Onboarding nowej osoby bedzie wolny i oparty na tribal knowledge.
3. Jak powinno to wygladac na poziomie senior developer:
   README + `docs/` z minimum architektury i deploy process.
4. Jak to poprawic:
   Dodać dokumenty:
   - `docs/auth-and-roles.md`
   - `docs/supabase-migrations.md`
   - `docs/editor-architecture.md`
5. Priorytet:
   MEDIUM

### 4.12 UI / UX / spojnosc

#### Problem UX1
1. Co jest nie tak:
   UI jest mniej chaotyczne niz wczesniej, ale nadal niespójne technologicznie i produktowo. Settings shell jest zrobiony jednym stylem, ale homepage, publiczne ekrany, dialogi i modulowe edytory nadal zyja czesciowo osobnymi zasadami.
2. Dlaczego to problem:
   Uzytkownik widzi produkt skladany etapami, a nie jednolity system.
3. Jak powinno to wygladac na poziomie senior developer:
   Jeden design system, jeden tone of voice, jeden zestaw komponentow podstawowych.
4. Jak to poprawic:
   Ustanowic:
   - button/input/dialog/banner/table/page-shell primitives,
   - tokeny spacing/typography/color,
   - copy standard (PL lub EN, nie mix).
5. Priorytet:
   MEDIUM

#### Problem UX2
1. Co jest nie tak:
   Wiele ekranow budowanych inline stylem nie ma systemowych focus states i spójnej semantyki formularzy. React Flow nodes rowniez nie sa projektowane z mysla o klawiaturze i accessibility.
2. Dlaczego to problem:
   To pogarsza dostepnosc i jakosc produktu dla bardziej wymagajacych uzytkownikow.
3. Jak powinno to wygladac na poziomie senior developer:
   Komponenty form/dialog/table z focus-visible, aria i keyboard-first behavior.
4. Jak to poprawic:
   W pierwszym kroku ustandaryzowac komponenty UI, w drugim zrobic pass a11y po formularzach i dialogach.
5. Priorytet:
   MEDIUM

## 5. Plan dzialania

### Etap 1 - krytyczne poprawki

Cel:
Domknac ryzyka architektoniczno-bezpieczenstwowe, ktore moga zepsuc system lub zablokowac skalowanie.

Zakres:
- auth / invitation / request-access
- RLS / Supabase role model
- najgorsze monolity i ownership danych

Konkretne zadania:
- Przepisac `site_departments` RLS zgodnie z modelem `admin/champion`.
- Usunac remaining policies na roli `public`, gdzie nie sa intencjonalne.
- Zamknac invitation onboarding na poziomie auth, a nie tylko UI.
- Dodac anty-abuse dla `request-access`.
- Wyciagnac z `PFMEA`, `PFD`, `PCP` pierwsza warstwe service/repository.
- Usunac martwy shell/layout albo faktycznie wdrozyc `AppChrome`.

Spodziewany efekt:
- mniej ryzyk bezpieczenstwa,
- spójniejszy model ról,
- mniejsza zaleznosc UI od schematu DB,
- czytelniejsza architektura startowa do dalszego refaktoru.

### Etap 2 - stabilizacja i jakosc

Cel:
Podniesc niezawodnosc i ograniczyc koszt zmian.

Zakres:
- typowanie
- testy
- session/auth flow
- error handling

Konkretne zadania:
- Przywrocic `no-explicit-any` dla `projects` i `risk-matrix`.
- Rozbic `projects` na data/view layer.
- Zastapic custom browser scripts prawdziwym Playwright test runnerem.
- Dodac pierwsze testy unit dla parserow/modeli i integration dla route/RPC.
- Ujednolicic obsluge sesji zamiast powielac retry/cache w kilku komponentach.
- Dodac route-level `loading.tsx` i `error.tsx`.

Spodziewany efekt:
- mniej regresji,
- mniej niejawnych kontraktow runtime,
- lepsza diagnozowalnosc bledow.

### Etap 3 - standaryzacja

Cel:
Zbudowac jeden spójny standard kodu, UI i procesu developerskiego.

Zakres:
- UI primitives
- lint/type rules
- docs
- CI/CD

Konkretne zadania:
- Wybrac jeden standard stylowania i konsekentnie go stosowac.
- Zdefiniowac wspolne `design tokens`:
  - kolory
  - spacing
  - radiusy
  - cienie
  - typografie
  - stany hover/focus/disabled
- Zbudowac zestaw wspolnych `UI primitives`:
  - button
  - input
  - select
  - textarea
  - checkbox
  - card
  - banner
  - modal shell
  - table shell
  - section header
- Migrowac strony etapami na wspolny system UI zamiast lokalnych inline styles i lokalnych wariantow tych samych elementow.
- Wypchnac inline style z shared shells do komponentow bazowych.
- Dodac Prettier, Husky, lint-staged.
- Rozszerzyc README i dodac docs dla auth/Supabase/editor architecture.
- Wlaczyc `reactStrictMode`.
- Usunac duplikaty typu podwojny import CSS React Flow.

Spodziewany efekt:
- bardziej przewidywalny kod,
- spojny styl calej aplikacji,
- latwiejsza zmiana wygladu w jednym miejscu zamiast na wielu stronach,
- prostszy onboarding,
- mniejszy chaos technologiczny.

### Etap 4 - rozwoj docelowy

Cel:
Przestawic aplikacje z "utrzymywanego prototypu" na platforme gotowa do rozwoju.

Zakres:
- server-first Next.js
- granular access model
- skalowanie React Flow
- roadmap modules

Konkretne zadania:
- Przeniesc read bootstrap do server components tam, gdzie to ma sens.
- Zbudowac granularny model dostepu `customer` do konkretnych PFD/PFMEA/PCP.
- Rozdzielic React Flow editor commands od persistence.
- Dodac formalne migracje Supabase i drift checks.
- Podjac decyzje produktowe dla `/actions` i `/reports`.

Spodziewany efekt:
- architektura gotowa na zespolowy rozwoj,
- bardziej przewidywalne wdrozenia,
- mniej tarcia przy nowych funkcjach.

## 6. Werdykt koncowy

To nie jest slaby projekt w sensie "nic tu nie dziala". Aplikacja dziala, quality gate przechodzi, a najwieksze oczywiste dziury RLS zostaly juz ograniczone. Ale to nadal nie jest kod prowadzony tak, jak prowadzi sie dojrzaly system przez Senior/Staff Engineer od poczatku do konca.

Najmocniejsze minusy sa trzy:

- za duzo krytycznej logiki siedzi w ogromnych klientowych stronach,
- model dostepu i auth jest nadal zbyt zlozony i czesciowo egzekwowany na zlym poziomie,
- testowalnosc i proces developerski nie odpowiadaja ciezarowi systemu.

Najuczciwsza konkluzja:

- aplikacja jest funkcjonalna,
- technicznie jest juz bezpieczniejsza niz byla,
- ale nadal wymaga jednego mocnego, architektonicznego passa, zeby wejsc na prawdziwy poziom production-grade senior engineering.

Ocena koncowa calego systemu: **5/10**

To jest poziom:
- "da sie rozwijac dalej",
- ale jeszcze nie "mozna spokojnie skalowac zespol i tempo zmian bez ryzyka, ze architektura zacznie sie sypac".

## Stan quality gate na moment audytu

- `npm run check` przechodzi
- `npm run lint` przechodzi
- `npm run typecheck` przechodzi
- `npm run build` przechodzi

To jest plus operacyjny, ale nie zmienia oceny architektonicznej. Tu problemem nie jest juz to, czy repo sie kompiluje. Problemem jest to, jak drogie i ryzykowne beda kolejne zmiany, jesli obecny model zostanie bez wiekszego refaktoru.
