# Etap 3 - Architecture Pass 2

Data: 2026-04-23

## Cel

Kontynuowac rozbijanie `Projects` bez zmian wizualnych i wyciagnac z route page ciezsze query, nie tylko podstawowy CRUD.

## Co zostalo zrobione

### 1. Wyodrebnienie agregacji PFMEA

Do [src/features/projects/projects-service.ts](</c:/Users/zieada/pfmea-app/src/features/projects/projects-service.ts>) dodano:

- `fetchProjectPfmeaStats(...)`

Zakres:

- pobieranie danych z `pfmea_rows`
- agregacja po `project + revision`
- wybor preferowanej rewizji
- wyliczenie:
  - `riskCount`
  - `avgRpn`

Efekt:

- `app/projects/page.tsx` nie trzyma juz lokalnie tej logiki agregacyjnej
- query i algorytm wyboru rewizji sa w jednej warstwie serwisowej

### 2. Wyodrebnienie historii rewizji

Do [src/features/projects/projects-service.ts](</c:/Users/zieada/pfmea-app/src/features/projects/projects-service.ts>) dodano:

- `fetchProjectRevisionPopupData(...)`

Zakres:

- pobranie ostatnich zmian z:
  - `pfd_change_history`
  - `pfmea_change_history`
  - `pcp_change_history`
- zbudowanie finalnego modelu popupu rewizji
- mapowanie author/description/revision label

Efekt:

- `Projects` page przestala skladac popup rewizji bezposrednio w komponencie
- kolejna duza odpowiedzialnosc wypadla z route-level widoku

### 3. Odchudzenie widoku

W [app/projects/page.tsx](</c:/Users/zieada/pfmea-app/app/projects/page.tsx>):

- uproszczono dwa duze `useEffect`
- zostawiono tylko:
  - sterowanie stanem loading/fallback
  - podpiecie wyniku do React state

Efekt:

- mniej logiki domenowej w komponencie
- page jest blizej roli kontenera niz lokalnej mini-warstwy backendowej

## Co to rozwiazuje z audytu

Ten pass dalej adresuje:

- monolityczne moduly
- rozlana warstwe danych w UI
- slaba separacje odpowiedzialnosci
- niski poziom utrzymywalnosci i testowalnosci

## Czego jeszcze nie zrobiono

`Projects` nadal zawiera:

- logike filtrow
- local state create/edit
- open risk count summary
- spora warstwe renderingu tabeli i popupow

Czyli:

- modul jest wyraznie lepszy niz byl
- ale nadal nie jest jeszcze finalnie rozbity

## Walidacja

- `npm run lint` - OK
- `npm run build` - OK
- `npm run regression:org:customer-flow` - OK

## Wniosek

Ten pass jest dobry, bo rozwija ten sam kierunek co poprzedni bez ryzykownego przepisywania UI. `Projects` jest juz coraz bardziej podzielone na:

- typy
- utils
- service layer
- route container

## Nastepny sensowny krok

Mamy teraz dwie sensowne opcje:

1. dokonczyc `Projects`
   - wyciagnac open risk summary
   - wyciagnac create/edit state do hooka
2. zaczac pierwszy architektoniczny pass dla `PFD`
   - bootstrap auth/session/context
   - load/save service
   - zostawic sam edytor i node handling na kolejny krok
