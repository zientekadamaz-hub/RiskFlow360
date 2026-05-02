# Etap 3 - UI Standard Draft

Data: 2026-04-23

## Cel

Wprowadzic kontrolowany proces zatwierdzania wspolnego standardu UI przed migracja istniejacych ekranow.

## Decyzja procesowa

Migracja wizualna nie bedzie robiona od razu na zywych stronach.

Najpierw:

1. przygotowujemy wspolny draft standardu
2. pokazujemy go na izolowanej stronie preview
3. zatwierdzasz elementy wizualne sekcja po sekcji
4. dopiero po akceptacji ruszamy migracje realnych ekranow

To ogranicza ryzyko przypadkowego "rozjechania" aplikacji i pozwala zatwierdzac styl na poziomie komponentow, a nie dopiero po fakcie.

## Bazowy kierunek

Standard v1 ma byc budowany przede wszystkim na podstawie:

- [app/pfmea/page.tsx](</c:/Users/zieada/pfmea-app/app/pfmea/page.tsx>)

Wspierajace referencje:

- [app/projects/page.tsx](</c:/Users/zieada/pfmea-app/app/projects/page.tsx>)
- [app/pcp/page.tsx](</c:/Users/zieada/pfmea-app/app/pcp/page.tsx>)

Te ekrany sa od teraz glownym punktem odniesienia dla:

- typografii
- akcentow kolorystycznych
- tabel
- przyciskow akcji
- kart summary
- dialogow modalnych
- popupow pomocniczych / hint popupow

Wazne doprecyzowanie:

- [app/settings/invitations/page.tsx](</c:/Users/zieada/pfmea-app/app/settings/invitations/page.tsx>) i [src/features/settings/invitation-shell.tsx](</c:/Users/zieada/pfmea-app/src/features/settings/invitation-shell.tsx>) zostaja jako pomocnicza baza techniczna dla shelli `settings`
- ale nie sa juz glownym wizualnym wzorcem dla calej aplikacji

## Kandydat standardu v1

### 1. Page shell

- tlo: ciemny granat `#171f33`
- wspolny backdrop z `home-hero-bg.svg`
- overlay gradient:
  - `rgba(88, 58, 39, 0.58)` -> `rgba(23, 31, 51, 0.86)`
- szerokosc frame:
  - `96%`

### 2. Karty

- blur glass card
- border:
  - `rgba(255,255,255,0.16)`
- radius:
  - `8px`
- shadow:
  - `0 18px 40px rgba(0,0,0,0.18)`

### 3. Typografia

- font bazowy:
  - `Arial, sans-serif`
- page title:
  - `28px`, `600`
- subtitle:
  - `13.5px`
- body/table/form:
  - `13px`
- labels:
  - `11px`, uppercase, wysoki kontrast

### 4. Formularze

- input/select height:
  - `32px` dla zwartego stylu procesowego
- textarea:
  - kompaktowa, ciemne wypelnienie jak w modulach procesu
- border:
  - `rgba(255,255,255,0.16)`
- background:
  - `rgba(255,255,255,0.06)`

### 5. Przyciski

- primary:
  - kompaktowy, procesowy, z wypelnieniem `rgba(255,255,255,0.16)`
- action chip:
  - zblizony do `Projects/PCP`, bez przesadnie “appkowego” wygladu
- radius:
  - `8px`
- brak agresywnego zroznicowania ksztaltow
- hierarchia ma byc budowana glownie kolorem i kontrastem, nie rozmiarem

### 6. Tabele

- wrapper z borderem i radius `8px`
- tabela nie ma dodatkowego tytulu/opisu bezposrednio nad wrapperem; kontekst strony ma wynikac z top frame, toolbaru, filtrow lub samych naglowkow kolumn
- rekordy tabelaryczne dodajemy i edytujemy w wierszu tabeli; nie tworzymy osobnego formularza nad tabela dla danych, ktore naturalnie sa jednym rekordem tabeli
- header:
  - `13px`, semi-muted white, do lewej
- cell:
  - `14px`, `#f8fafc`
- tlo tabeli:
  - `rgba(255,255,255,0.03)` lub `0.04` zalezne od wariantu
- wrapper tabeli:
  - `settingsTableWrapStyle`
  - `background: rgba(255,255,255,0.035)`
  - `backdrop-filter: blur(6px)`
  - bez dodatkowego cienia
- cienkie separatory poziome
- akcje kolumn:
  - nie uzywamy osobnych filter icon obok labela
  - standardem jest `three-dot column menu` zaraz obok nazwy kolumny
  - kropki sa biale dla kolumn widocznych
  - po ukryciu kolumny kropki przechodza na akcent procesu `#d4a61b`
- popupy kolumn:
  - mamy dwa zatwierdzone warianty i oba sa czescia jednego standardu
  - `filter popup`:
    - dla kolumn filtrowalnych
    - zawiera:
      - `Sort ascending`
      - `Sort descending`
      - `Hide column`
      - `Search`
      - `(Select all)`
      - liste wartosci z checkboxami
      - `Cancel / OK`
  - `action popup`:
    - dla kolumn sort-only
    - zawiera:
      - `Sort ascending`
      - `Sort descending`
      - `Hide column`
  - oba popupy maja miec:
    - to samo tlo
    - ten sam border
    - ten sam radius
    - ten sam shadow
    - to samo pozycjonowanie poza tabela przez portal
- ukrywanie kolumn:
  - ukryta kolumna nie znika calkowicie
  - zostaje po niej waski slot z samymi `...`
  - klikniecie otwiera popup tylko z:
    - `Show column`
  - nie pokazujemy dodatkowego opisu nad przyciskiem typu:
    - `column is currently hidden`
  - nie pokazujemy dodatkowego napisu nad tabela typu:
    - `Hidden columns`
- szerokosci kolumn:
  - cala tabela ma zachowac stala szerokosc
  - po ukryciu kolumny jej szerokosc jest redukowana do malego slotu `...`
  - pozostala szerokosc ma byc rozdzielana proporcjonalnie pomiedzy widoczne kolumny
  - szersza kolumna bazowa dostaje wieksza czesc wolnego miejsca
  - wezsza kolumna bazowa dostaje mniejsza czesc wolnego miejsca
  - ukrywanie kolumn nie moze powodowac, ze tabela robi sie szersza od swojego kontenera
- dodatkowe zasady:
  - naglowki i wartosci pozostaja wyrownane do lewej, chyba ze komponent wymaga innego zachowania
  - `Delete` w tabeli jest tekstowym przyciskiem standardu, bez ikony kosza
  - czerwony akcent pojawia sie dopiero na hover

Wzorcem referencyjnym dla tych zasad jest teraz:

- [app/projects/page.tsx](</c:/Users/zieada/pfmea-app/app/projects/page.tsx>)

### 7. Akcent procesu

- glowny cieply akcent:
  - `#d4a61b`
- uzycie:
  - nazwy procesu
  - statusy draft/review, gdzie cieply akcent ma sens
  - selected hints i approval accents

### 8. Banery i stany

- success:
  - zielony tekst statusowy `#bbf7d0`
  - bez tla, ramki i karty
  - pozycja: zaraz pod top frame strony
  - jesli pod top frame jest toolbar akcji, komunikat pokazujemy w tym samym wierszu co przyciski, wyrownany pionowo do srodka przyciskow
- error:
  - bledy blokujace lub wymagajace decyzji pokazywane sa jako modal/popup `SettingsConfirmDialog`
  - modal bledu ma przycisk `Cancel` i bez dodatkowego przycisku confirm
  - nie pokazujemy bledow jako dodatkowej ramki nad tabela ani jako tekstu w toolbarze, jesli blokuja dalsze dzialanie
- neutral:
  - wspolny dark glass

### 8a. Kafle summary w top frame

- kafle w `SettingsPageShell.summary` musza korzystac ze wspolnego `SettingsSummaryGrid` i `SettingsSummaryTile`
- szerokosc grupy kafli wynika z liczby kolumn przez `getSettingsSummaryGridMaxWidth(columns)`; nie ustawiamy lokalnych, przyblizonych `maxWidth`
- kafle nie dostaja lokalnych borderow, radiusow ani tla poza zatwierdzonymi wariantami ryzyka

### 8b. Kafle ryzyka zgodne z PFMEA

- wzorzec:
  - [app/pfmea/page.tsx](</c:/Users/zieada/pfmea-app/app/pfmea/page.tsx>)
- zastosowanie:
  - summary tiles pokazujace rozklad ryzyka
  - kafle z licznikami dla `red / orange / yellow / green`
- zasada:
  - kolor jest na tle i borderze
  - wartosc liczbowa pozostaje biala
  - nie kolorujemy samej liczby wedlug ryzyka
- nie uzywamy tego jako domyslnego stylu dla wszystkich kart
- to jest styl statusowych kafli procesu, nie ogolnego shellu

### 9. Dialogi

- dark panel `rgb(40, 39, 47)`
- compact spacing
- ostrzezenie destructive jako osobny blok w kolorze czerwonym
- akcje po prawej stronie

### 10. Popupy pomocnicze

- wzorowane bezposrednio na popupach z:
  - [app/pfmea/page.tsx](</c:/Users/zieada/pfmea-app/app/pfmea/page.tsx>)
- glowny wzorzec:
  - popupy severity / class / contextual help z `PFMEA`
- popup nie jest tym samym co modal:
  - ma byc lzejszy
  - bardziej techniczny
  - bardziej "hint/details/rules" niz "confirm action"
- panel:
  - `rgb(40, 39, 47)`
- radius:
  - `10px`
- shadow:
  - `0 14px 30px rgba(0,0,0,0.18)`
- title/body:
  - `#d4a61b`
- najlepsze zastosowanie:
  - wyjasnienie zasad
  - hover details
  - contextual help
  - option details
- popup ma byc:
  - zakotwiczony przy ikonie lub polu
  - kompaktowy
  - kolorystycznie zgodny z panelem / ramka / tabela
  - nadal subtelny, bez ciezkiej ramy
- jesli popup zawiera tabele:
  - wewnetrzny wrapper tabeli tez ma byc zaokraglony
  - zaokraglenie ma byc widoczne, nie tylko wpisane na samym `table`
  - najbezpieczniej przez `overflow: hidden` na wrapperze

## Strona do zatwierdzania

Dodano izolowana strone:

- [app/settings/ui-preview/page.tsx](</c:/Users/zieada/pfmea-app/app/settings/ui-preview/page.tsx>)

Route:

- `/settings/ui-preview`

Ta strona pokazuje kandydat v1 bez migracji istniejacych ekranow i jest juz przestawiona na jezyk wizualny blizszy `Projects/PFMEA/PCP`.

## Jak bedziemy zatwierdzac

Zatwierdzanie robimy recznie, sekcja po sekcji:

1. typography
2. buttons and banners
3. forms
4. tables
5. RPN frame accents
6. modal / confirm
7. popup / contextual help

Ty wskazujesz:

- `akceptuje`
- `zmien`
- `zostaw jak bylo`

Po akceptacji tej strony przejde do pilota:

- jedna wybrana strona `settings`

Dopiero po zatwierdzeniu pilota ruszymy migracje reszty aplikacji.

## Decyzja na nastepny krok

Nastepny krok nie jest juz "w ciemno" migracja.

Najpierw:

- Twoje zatwierdzenie `ui-preview`

Potem:

- pierwszy ekran pilotażowy na wspolnych prymitywach
