# Audyt po zmianach - Next.js / PFMEA App

Data: 2026-04-22

## Executive summary

Stan projektu po ostatnich poprawkach jest wyraźnie lepszy niż w audycie początkowym.

Najważniejsze plusy:
- `lint`, `typecheck` i `build` przechodzą bez błędów blokujących.
- Zniknęły warningi z głównych modułów aplikacyjnych (`PFMEA`, `PFD`, `PCP`).
- Warstwa request-access została przeniesiona za route handler z walidacją.
- Redirect po logowaniu jest sanitizowany.
- Ustawienia severity / occurrence / detection mają już wspólną implementację.
- CI obejmuje build, typecheck, lint oraz browser regression, jeśli dostępne są sekrety.

Najważniejsze problemy, które nadal pozostają:
- Architektura domenowa nadal jest zbyt mocno skupiona w kilku monolitycznych ekranach klienckich.
- Kluczowe moduły biznesowe wykonują bardzo dużo logiki i operacji na Supabase bez wyraźnej warstwy serwisowej po stronie serwera.
- Bez bezpośredniego audytu Supabase/RLS nie da się uznać modelu autoryzacji i izolacji danych za produkcyjnie zweryfikowany.
- W repo nadal istnieją martwe lub mylące artefakty architektoniczne.

Ocena końcowa po zmianach: **7/10**

Werdykt:
Projekt **nie wygląda jeszcze w pełni jak prowadzony end-to-end na poziomie senior/staff**, ale po ostatnich poprawkach jest już **blisko sensownego poziomu produkcyjnego w warstwie aplikacyjnej**. Największą barierą pozostają architektura modułów core oraz brak zweryfikowanej warstwy bezpieczeństwa po stronie Supabase.

## 1. Architektura aplikacji

### Ocena
Architektura poprawiła się, ale nadal jest nierówna. Widać mieszankę sensownych ekstrakcji i bardzo dużych ekranów, które pełnią jednocześnie rolę widoku, kontrolera stanu, warstwy dostępu do danych i części logiki domenowej.

### Mocne strony
- App Router jest używany spójnie na poziomie katalogów `app/**`.
- Pojawiły się pierwsze sensowne ekstrakcje współdzielone:
  - `src/features/settings/rating-scale/RatingScalePage.tsx`
  - `src/lib/routing.ts`
  - `src/lib/request-access.ts`
  - `src/lib/env.ts`
- Warstwa UI ma już wspólne prymitywy w `src/components/ui/primitives.tsx`.

### Główne problemy

#### HIGH - monolityczne moduły core
- `app/pfmea/page.tsx` ma ok. **7517 linii** i scala bardzo dużo odpowiedzialności.
- `app/pfd/page.tsx` ma ok. **3127 linii**.
- `app/projects/page.tsx` ma ok. **2438 linii**.
- `app/pcp/page.tsx` ma ok. **1605 linii**.

To nadal jest główna bariera dla skalowalności i utrzymywalności. Te pliki są zbyt duże, żeby bezpiecznie rozwijać je zespołowo i bezpiecznie refaktorować.

#### HIGH - zbyt dużo logiki w client components
Kluczowe ekrany biznesowe są client-side i bezpośrednio importują klienta Supabase:
- `app/pfmea/page.tsx:1,7`
- `app/pfd/page.tsx:1,22`
- `app/pcp/page.tsx:2,8`
- `app/projects/page.tsx:1,5`

To oznacza:
- duży coupling UI z danymi,
- utrudnione testowanie,
- trudniejszą kontrolę uprawnień,
- większe ryzyko regresji przy zmianach logiki domenowej.

#### MEDIUM - martwe i mylące artefakty architektoniczne
- `src/components/Layout/AppChrome.tsx` istnieje, ale aktualny root layout go nie używa.
- `src/components/AuthGuard.tsx` jest pustym wrapperem.
- `src/app/pfd/_lib/nodes/index.ts` i `src/app/pfd/_lib/nodes/types.ts` to legacy stuby.
- `app/pfmea/pageBackup.tsx` nadal leży w repo.

To nie psuje buildu, ale obniża czytelność architektury i podnosi koszt onboardingu.

### Wniosek
Architektura jest dziś **wystarczająca do dalszego rozwoju**, ale nie jest jeszcze dojrzała. Potrzebna jest docelowo separacja:
- `view`
- `state orchestration`
- `domain logic`
- `Supabase data access`

## 2. Jakość kodu

### Ocena
Jakość kodu wzrosła zauważalnie. Widać porządkowanie martwego kodu, warningów, zależności hooków i prostszych helperów. Nadal jednak poziom jest nierówny między starszymi modułami a nowszymi ekstrakcjami.

### Mocne strony
- Aktualnie quality gates są czyste.
- Wspólna implementacja rating scale jest dużo bardziej senior-level niż wcześniejsze duplikaty.
- Request-access ma już osobną walidację payloadu.
- Uporządkowano dużą liczbę warningów i martwej logiki.

### Problemy

#### HIGH - duży rozdźwięk jakości między modułami
- `src/features/settings/rating-scale/RatingScalePage.tsx` prezentuje sensowny poziom abstrakcji.
- `app/pfmea/page.tsx`, `app/pfd/page.tsx`, `app/projects/page.tsx` nadal mają poziom znacznie bardziej legacy/proceduralny.

#### MEDIUM - kod nadal bywa „za ciężki” w jednym miejscu
W dużych ekranach:
- dużo lokalnych helperów,
- dużo stanu lokalnego,
- dużo callbacków,
- dużo logiki sekwencyjnej zależnej od kolejności działań.

To działa, ale nie jest czytelne na poziomie senior maintainability.

#### MEDIUM - repo zawiera artefakty po wcześniejszych iteracjach
- `pageBackup`
- tymczasowe skrypty `tmp-*`
- legacy stuby w `src/app/pfd/_lib`

To wygląda jak baza rozwijana etapami bez pełnego cleanupu po każdej iteracji.

## 3. Standardy Next.js

### Ocena
Projekt korzysta z App Router poprawnie na poziomie routingu, ale nadal nie wykorzystuje pełni idiomatycznych wzorców Next.js 16.

### Dobre strony
- App Router jest spójny.
- Route handlers są używane:
  - `app/api/request-access/route.ts`
  - `app/api/auth/signout/route.ts`
- Middleware/proxy pilnuje sesji i redirectów:
  - `proxy.ts:11-33`

### Problemy

#### HIGH - zbyt mało server-first podejścia
Najważniejsze ekrany produktowe są praktycznie całe klientowe. To oznacza, że:
- render,
- pobieranie danych,
- mutacje,
- logika kontrolna

są mocno osadzone w kliencie.

#### MEDIUM - brak segment-level `loading.tsx` / `error.tsx`
Repo nie ma realnych segmentowych `loading.tsx` i `error.tsx` w App Router. To oznacza, że aplikacja nie korzysta dobrze z natywnych fallbacków Next.js.

#### MEDIUM - `reactStrictMode` jest wyłączony
- `next.config.ts:25`

To obniża szansę wcześniejszego wykrywania problemów z efektami i nieczystymi komponentami.

#### LOW - redirecty maskują brakujące moduły
- `next.config.ts:27-48`

Redirecty `/actions`, `/reports`, `/task-management` do `/projects` są praktyczne, ale to nadal workaround, a nie architektoniczne domknięcie nawigacji produktu.

## 4. TypeScript

### Ocena
Typowanie jest dziś wyraźnie lepsze niż wcześniej, ale nadal niespójne.

### Mocne strony
- `strict: true` jest włączone.
- `typecheck` przechodzi.
- W głównych hotspotach usunięto część prowizorycznych obejść.

### Problemy

#### MEDIUM - repo nadal dopuszcza zbyt dużo luzu
- `tsconfig.json:9` -> `allowJs: true`
- `tsconfig.json:10` -> `skipLibCheck: true`

To jest zrozumiałe w przejściowej fazie projektu, ale nie jest idealnym ustawieniem dla dojrzałej bazy TS-first.

#### MEDIUM - ESLint ma świadome wyjątki dla legacy obszarów
- `eslint.config.mjs:28-39` -> wyłączenie `no-explicit-any` dla kilku kluczowych ekranów
- `eslint.config.mjs:51-53` -> wyłączenie `ban-ts-comment` dla risk matrix

To jest uczciwe i pragmatyczne, ale potwierdza, że pełne domknięcie jakości TS jeszcze nie nastąpiło.

#### MEDIUM - typy domenowe są lokalne dla wielkich ekranów
W dużych modułach typy są często definiowane lokalnie i nie tworzą wspólnego kontraktu domenowego dla całej aplikacji. To ogranicza reużywalność i testowalność.

## 5. React best practices

### Ocena
W warstwie React widać realną poprawę, ale główne moduły nadal są zbyt duże i nadmiernie lokalne.

### Dobre strony
- warningi hooków zostały domknięte,
- mniejsze moduły są czytelniejsze,
- rating scale ma dobrą kompozycję i sensowne kapsułkowanie.

### Problemy

#### HIGH - nadal za duże komponenty typu page-as-application
- `app/pfmea/page.tsx`
- `app/pfd/page.tsx`
- `app/projects/page.tsx`
- `app/pcp/page.tsx`

To są nie tyle komponenty, co mini-aplikacje osadzone w jednym pliku.

#### MEDIUM - dużo lokalnego stanu sterującego
W dużych ekranach wciąż występuje:
- dużo `useState`,
- dużo `useCallback`,
- duża liczba pochodnych helperów zależnych od kolejności deklaracji.

To utrudnia reasoning i bezpieczne zmiany.

#### LOW - są ślady nadmiarowych/stubowych komponentów
- `src/components/AuthGuard.tsx` jest no-op wrapperem.

## 6. Bezpieczeństwo

### Ocena
Warstwa aplikacyjna jest bezpieczniejsza niż wcześniej, ale największe ryzyko nadal siedzi poza samym kodem UI, czyli w modelu Supabase/RLS, którego ten audyt nie mógł zweryfikować bezpośrednio.

### Mocne strony
- request-access ma walidację i prosty honeypot:
  - `app/api/request-access/route.ts:14-26`
  - `src/lib/request-access.ts:20-58`
- redirect po logowaniu jest sanitizowany:
  - `src/lib/routing.ts:32-45`
- proxy wymusza sesję dla tras niepublicznych:
  - `proxy.ts:26-33`

### Najważniejsze ryzyka

#### CRITICAL - brak bezpośrednio zweryfikowanego modelu autoryzacji danych
Kluczowe ekrany biznesowe pracują bezpośrednio z klientem Supabase po stronie przeglądarki:
- `app/pfmea/page.tsx:1,7`
- `app/pfd/page.tsx:1,22`
- `app/pcp/page.tsx:2,8`
- `app/projects/page.tsx:1,5`

Proxy sprawdza tylko obecność sesji:
- `proxy.ts:11-33`

Nie sprawdza:
- membership,
- aktywnej organizacji,
- ról,
- tenant isolation,
- prawa do konkretnego projektu.

Jeżeli RLS w Supabase nie jest wzorowo ustawione, aplikacja może mieć realne ryzyko błędów dostępu. Dlatego pełny audyt Supabase pozostaje obowiązkowy.

#### HIGH - route handler request-access działa na anon key
- `app/api/request-access/route.ts:6`

To nie jest samo w sobie błędem, ale oznacza, że bezpieczeństwo inserta zależy od poprawnych policy po stronie Supabase.

#### MEDIUM - brak centralnej warstwy serwerowej dla mutacji krytycznych
Większość ważnych zapisów odbywa się z poziomu klienta. To jest wygodne, ale słabsze niż model:
- server actions / server services / typed backend boundary.

## 7. Wydajność

### Ocena
Wydajność aplikacji jest akceptowalna dla obecnej skali, ale architektura sugeruje, że przy większych datasetach pojawią się problemy.

### Plusy
- Obrazy `app/page.tsx` i `AppHeader.tsx` są już przeniesione na `next/image`.
- Build przechodzi poprawnie.
- Nie ma już lintowych sygnałów podstawowych problemów front-endowych.

### Problemy

#### HIGH - duże bundle i ciężkie ekrany klienckie
Monolityczne client pages oznaczają:
- większy JS na kliencie,
- więcej logiki przy pierwszym renderze,
- więcej stanu i efektów utrzymywanych w pamięci.

#### MEDIUM - brak wyraźnej strategii cache/data fetching
Większość logiki fetchowania jest ręcznie zarządzana w komponentach, zamiast przez bardziej systemowy model danych.

#### MEDIUM - dużo inline styles i dużych tabel renderowanych w kliencie
To nie zabija wydajności od razu, ale utrudnia optymalizacje i memoizację w przyszłości.

## 8. Obsługa błędów i niezawodność

### Ocena
Obsługa błędów w dużych ekranach jest praktyczna, ale nadal bardziej lokalna niż systemowa.

### Plusy
- Ekrany mają komunikaty błędów i stany sesji.
- Request-access daje poprawne statusy HTTP.
- `build`, `typecheck`, `lint` przechodzą.

### Problemy

#### MEDIUM - brak segmentowych error boundaries App Router
Brak `error.tsx` i `loading.tsx` sprawia, że aplikacja wciąż polega bardziej na ręcznych bannerach niż na natywnym modelu niezawodności Next.js.

#### MEDIUM - duża część błędów jest łapana lokalnie i renderowana ad hoc
To działa, ale nie daje jednolitego standardu fallbacków.

#### LOW - `README` jest już częściowo nieaktualne
- `README.md:60-62`

README nadal mówi, że legacy moduły emitują warningi, a aktualny stan quality gates jest już czystszy.

## 9. Testowalność

### Ocena
Testowalność wzrosła, ale nadal jest jednym z najsłabszych obszarów.

### Plusy
- Jest realna warstwa browser regression:
  - `.github/workflows/regression.yml`
  - `scripts/regression/**`
- CI potrafi uruchomić regresje warunkowo.

### Problemy

#### HIGH - brak testów jednostkowych i integracyjnych
Repo nie ma:
- Vitest/Jest,
- React Testing Library,
- sensownej warstwy testów logiki domenowej.

To oznacza, że większość pewności opiera się na:
- buildzie,
- lintrze,
- testach przeglądarkowych,
- ręcznym reasoning.

#### HIGH - duże client pages są bardzo trudne do testowania
Brakuje warstw pośrednich, które można testować niezależnie od UI.

## 10. Developer experience i utrzymanie

### Ocena
DX jest dziś sensowny, ale nie jeszcze „enterprise-ready”.

### Plusy
- `package.json` ma czytelne skrypty jakościowe.
- CI robi:
  - lint
  - typecheck
  - build
  - opcjonalny browser regression
- `README.md` jest krótszy, ale dużo lepszy niż wcześniej.

### Problemy

#### MEDIUM - brak Prettier / Husky / lint-staged
W repo nie ma śladu po:
- Prettier
- Husky
- lint-staged

To nie jest krytyczne, ale obniża spójność pracy zespołowej.

#### MEDIUM - README nie nadąża za obecnym stanem
Opis legacy warningów jest już częściowo przestarzały.

#### MEDIUM - w repo nadal leżą pliki tymczasowe
`tmp-*`, backupy i stare stuby utrudniają onboarding.

## 11. UX / dostępność

### Ocena
UX jest funkcjonalny i po poprawkach bardziej spójny technicznie, ale dostępność nadal nie wygląda na obszar projektowany systemowo.

### Mocne strony
- Semantyka w nowszych fragmentach jest przyzwoita.
- Formularze i akcje mają sensowne komunikaty.
- Landing i header nie mają już podstawowego warningu o obrazach.

### Problemy

#### MEDIUM - brak systemowego podejścia do accessibility
Nie widać w repo warstwy standardów a11y ani dedykowanych testów dostępności.

#### MEDIUM - duże tabele i rozbudowane ekrany operacyjne
PFMEA / PCP / PFD są mocno interaktywne i tabelaryczne, co zwykle wymaga bardzo uważnego podejścia do:
- focus management,
- keyboard UX,
- screen reader semantics.

W kodzie widać dużo ręcznej logiki, ale nie widać dowodu na pełne dopracowanie a11y.

## Najważniejsze problemy wg priorytetu

### CRITICAL
1. Brak bezpośrednio zweryfikowanego bezpieczeństwa Supabase / RLS przy client-side data access.

### HIGH
1. Monolityczne moduły core: `PFMEA`, `PFD`, `Projects`, `PCP`.
2. Duża część logiki domenowej nadal znajduje się w client components.
3. Brak testów jednostkowych / integracyjnych.

### MEDIUM
1. `reactStrictMode: false`.
2. Brak `loading.tsx` / `error.tsx`.
3. Martwe artefakty architektoniczne i backupy.
4. `allowJs` + `skipLibCheck` + lint exceptions dla legacy obszarów.
5. Brak Prettier / Husky / lint-staged.
6. README częściowo nieaktualny.

### LOW
1. Redirecty maskujące brak gotowych sekcji produktu.
2. Tymczasowe skrypty w root repo.

## Ocena obszarów

- Architektura: **6/10**
- Jakość kodu: **7/10**
- Standardy Next.js: **6/10**
- TypeScript: **7/10**
- React: **6.5/10**
- Bezpieczeństwo aplikacyjne: **6/10**
- Wydajność: **6.5/10**
- Niezawodność: **6.5/10**
- Testowalność: **5/10**
- DX / utrzymanie: **7/10**
- UX / accessibility: **6/10**

## Co poprawiło się względem poprzedniego audytu

- Quality gates są domknięte.
- Landing/header nie mają już warningów obrazków.
- `PFMEA`, `PFD`, `PCP` zostały znacząco odszumione z warningów i martwego kodu.
- Settings rating scales są ujednolicone przez wspólny moduł.
- Request-access ma bezpieczniejszy przepływ i walidację.
- CI jest czytelniejsze i bardziej użyteczne niż wcześniej.

## Co nadal wymaga kolejnego etapu

1. **Audyt Supabase**
   - RLS
   - auth model
   - SQL functions
   - project / organization isolation

2. **Rozbicie monolitów**
   - najpierw `PFMEA`
   - potem `PFD`
   - potem `Projects`

3. **Warstwa testów**
   - unit tests dla helperów domenowych
   - integration tests dla mutacji i mapowania danych
   - utrzymanie browser regression jako warstwy końcowej, a nie jedynej

4. **Cleanup repo**
   - usunięcie stubów / backupów / tmp-files
   - uporządkowanie nieużywanych abstrakcji

## Final recommendation

Na ten moment najlepsza kolejność dalszych działań jest taka:

1. wykonać **pełny audyt Supabase**
2. zamknąć decyzje dot. RLS i modelu dostępu
3. dopiero potem wejść w większą refaktoryzację `PFMEA`

Bez kroku 1 dalsze inwestowanie w sam frontend poprawia jakość kodu, ale nie zamyka największego ryzyka produkcyjnego.

