# Etap 3 - PFD Pass 2

Data: 2026-04-23

## Cel

Wyciagnac z [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>) kolejny duzy obszar logiki danych bez ruszania wygladu i bez zmiany zachowania mini-panelu `PFMEA`.

## Co zostalo zrobione

### 1. Wydzielenie warstwy danych dla mini-panelu PFMEA

Dodano nowy plik [src/features/pfd/pfmea-mini-service.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfmea-mini-service.ts>).

Trafily tam:

- `fetchPfmeaMiniRows(...)`
- `createPfmeaMiniRow(...)`
- `updatePfmeaMiniRow(...)`
- `computePfmeaMiniDerived(...)`
- `clampPfmeaMiniScore(...)`

Zakres tej warstwy:

- odczyt wierszy `pfmea_rows` dla wskazanej operacji
- tworzenie pustego rekordu mini-panelu
- aktualizacja komorki z walidacja wartosci `severity/occurrence/detection`
- wyliczanie pochodnych `oxd` i `rpn`

### 2. Uproszczenie route page

W [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>) przepieto na serwis:

- `reloadMini`
- `addMiniRow`
- `updateMiniCell`

Dodatkowo usunieto z route page lokalne helpery:

- `isInt1to10`
- `safeMul`
- `safeRpn`
- `computeMiniDerived`
- `clamp10`

To oznacza, ze `PFD` page nie miesza juz lokalnie:

- CRUD do `pfmea_rows`
- walidacji mini-score
- przeliczania `rpn/oxd`

z reszta logiki ekranu.

## Co to daje architektonicznie

Po tym passie `PFD` ma juz trzy sensowne warstwy feature-level:

- [src/features/pfd/types.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/types.ts>)
- [src/features/pfd/pfd-service.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-service.ts>)
- [src/features/pfd/pfmea-mini-service.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfmea-mini-service.ts>)

Najwazniejszy efekt:

- mini-panel `PFMEA` przestal byc kolejnym miejscem, w ktorym route page trzyma logike domenowa i zapisy do Supabase

To nie konczy jeszcze refaktoru `PFD`, ale kolejny duzy fragment danych jest juz wyjety z monolitu.

## Czego jeszcze nie ruszalismy

Nadal zostalo w `PFD` sporo ciezaru:

- operacje na wezłach i krawedziach React Flow
- logika tworzenia/usuwania symboli
- czesc operacji na `operations`
- lokalny stan UI, dialogow i selekcji

To bedzie naturalny material na nastepne passy Etapu 3.

## Walidacja

- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run build` - OK
- `REGRESSION_ADMIN_EMAIL=riskflow360@gmail.com REGRESSION_ADMIN_PASSWORD=... npm run regression:org:customer-flow` - OK

## Decyzja na nastepny krok

Najrozsadniejszy kolejny krok zgodnie z planem:

- dalej rozcinac `PFD`, ale juz od strony operacji i helperow React Flow
- dopiero po 1-2 takich passach wracac do zaplanowanej standaryzacji wspolnego UI

Czyli nadal priorytetem pozostaje funkcjonalna architektura, bez ruszania wygladu.
