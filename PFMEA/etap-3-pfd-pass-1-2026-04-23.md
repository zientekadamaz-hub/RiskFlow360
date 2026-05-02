# Etap 3 - PFD Pass 1

Data: 2026-04-23

## Cel

Rozpoczac rozbijanie monolitu [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>) bez ruszania wygladu i bez ingerencji w sam edytor React Flow bardziej niz to konieczne.

## Co zostalo zrobione

### 1. Wydzielenie typow PFD

Dodano [src/features/pfd/types.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/types.ts>), gdzie trafily podstawowe typy domenowe i pomocnicze dla modulu:

- `OperationRow`
- `PfmeaMiniRow`
- `PfdHistoryEntry`
- `PfdEditSession`
- `ProjectProcessOptionRow`
- `PfdUserContext`
- `PersistedPfdDiagram`

Efekt:

- route page przestala trzymac lokalnie kolejne typy domenowe
- typy sa gotowe do dalszego uzycia przez warstwe serwisowa i przyszle komponenty feature-level

### 2. Wydzielenie bootstrapu danych i odczytow

Dodano [src/features/pfd/pfd-service.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-service.ts>) z pierwsza warstwa odczytow i logiki publikacji:

- `fetchPfdUserContext(...)`
- `fetchPfdEditSession(...)`
- `fetchUnreadPfdSessionNotice(...)`
- `fetchPfdRevisionLabel(...)`
- `fetchPfdProcessOptions(...)`
- `fetchPfdHistory(...)`
- `fetchPfdCanvasData(...)`
- `publishPfdDiagram(...)`

W [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>) przepieto na te funkcje:

- `loadUserContext`
- `loadEditSession`
- `loadSessionNotice`
- `loadRevisionLabel`
- `loadProcessOptions`
- `loadHistory`
- `savePfdWithDescription`
- `loadAll`

Efekt:

- odczyty i publikacja nie sa juz rozproszone po route page
- page zaczyna pelnic role kontenera zamiast lokalnej warstwy danych

### 3. Wydzielenie mutacji sesji i draftu

Ten pass domknal najciezszy remaining kawalek bootstrapu:

Do [src/features/pfd/pfd-service.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-service.ts>) dodano:

- `startPfdEditSession(...)`
- `fetchOwnPfdDraft(...)`
- `discardPfdDraftAndCloseSession(...)`
- `heartbeatPfdEditSession(...)`
- `savePfdDraft(...)`

W [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>) przepieto na serwis:

- `startEditSession`
- ladowanie wlasnego draftu
- heartbeat locka edycji
- autosave draftu
- discard draft + close session

Efekt:

- route page nie wykonuje juz bezposrednio kolejnej grupy CRUD-owych operacji Supabase
- logika sesji draftu jest skupiona w jednym miejscu
- dalszy refaktor `PFD` bedzie prostszy, bo mamy juz wyrazny podzial na:
  - typy
  - warstwe serwisowa
  - kontener route

## Czego jeszcze nie ruszalismy

Swiadomie nie ruszalem jeszcze:

- glownej logiki samego edytora React Flow
- manipulacji wezlow i krawedziami
- mini-panelu PFMEA
- lokalnego stanu UI i toolbarow

To nadal jest duzy kawalek monolitu, ale po tym passie mamy juz sensowny punkt wejscia do dalszego dzielenia.

## Co to daje architektonicznie

`PFD` nie jest juz pojedynczym plikiem, ktory miesza:

- typy domenowe
- bootstrap auth/context
- odczyty Supabase
- sesje draftu
- publikacje rewizji
- logike React Flow

To jeszcze nie jest finalna architektura, ale najwazniejsza warstwa danych i sesji zostala juz odseparowana od widoku.

## Walidacja

- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run build` - OK
- `REGRESSION_ADMIN_EMAIL=riskflow360@gmail.com REGRESSION_ADMIN_PASSWORD=... npm run regression:org:customer-flow` - OK

## Decyzja na nastepny krok

Najrozsadniejszy kolejny pass Etapu 3 dla `PFD`:

- wydzielenie operacji na danych PFMEA mini-panelu do feature service
- potem wydzielenie czesci lokalnej logiki React Flow do mniejszych helperow lub komponentow feature-level

Bez ruszania jeszcze wspolnego systemu UI.
