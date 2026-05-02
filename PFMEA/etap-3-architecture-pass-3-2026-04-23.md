# Etap 3 - Architecture Pass 3

Data: 2026-04-23

## Cel

Domknac kolejny kawalek `Projects` i wyciagnac ostatnia wieksza agregacje z route page bez ruszania wygladu.

## Co zostalo zrobione

### 1. Wyodrebnienie open-risk summary

Do [src/features/projects/projects-service.ts](</c:/Users/zieada/pfmea-app/src/features/projects/projects-service.ts>) dodano:

- `fetchOpenRiskSummary(...)`

Zakres:

- pobranie danych z `pfmea_rows` dla otwartych projektow
- wyliczenie:
  - `riskCount`
  - `openRiskAvgRpn`
  - `riskColorCounts`
- uwzglednienie aktualnego trybu risk matrix:
  - `manual`
  - `rpn`

Do [src/features/projects/types.ts](</c:/Users/zieada/pfmea-app/src/features/projects/types.ts>) dodano:

- `OpenRiskSummary`

### 2. Uproszczenie widoku

W [app/projects/page.tsx](</c:/Users/zieada/pfmea-app/app/projects/page.tsx>):

- useEffect od open-risk summary korzysta juz z `fetchOpenRiskSummary(...)`
- usunieto kolejne lokalne helpery obliczeniowe, ktore przestaly byc potrzebne
- page jest jeszcze bardziej route-contenerem zamiast lokalna warstwa danych

## Co to daje architektonicznie

Po trzech passach `Projects` ma juz sensowny podzial na:

- [src/features/projects/types.ts](</c:/Users/zieada/pfmea-app/src/features/projects/types.ts>)
- [src/features/projects/utils.ts](</c:/Users/zieada/pfmea-app/src/features/projects/utils.ts>)
- [src/features/projects/projects-service.ts](</c:/Users/zieada/pfmea-app/src/features/projects/projects-service.ts>)
- [app/projects/page.tsx](</c:/Users/zieada/pfmea-app/app/projects/page.tsx>)

To nie jest jeszcze finalna architektura, ale modul przestal byc jednym wielkim workiem na:

- typy
- formatowanie
- CRUD
- agregacje PFMEA
- popup rewizji
- summary dashboardowe

## Walidacja

- `npm run lint` - OK
- `npm run build` - OK
- `npm run regression:org:customer-flow` - OK

## Ocena

`Projects` nie jest jeszcze malym modularem, ale osiagnelismy sensowny checkpoint:

- najciezsze query i agregacje sa juz poza widokiem
- UI nie zostal naruszony
- flow organizacyjne nadal dzialaja

## Decyzja na nastepny krok

Od tego miejsca najrozsadniej jest przejsc do pierwszego passu architektonicznego dla `PFD`, zamiast ciagnac `Projects` w nieskonczonosc.

Zakres nastepnego passu:

- bootstrap auth/session/context
- load/save service
- wydzielenie pierwszej warstwy typow i danych

Bez ruszania jeszcze samego edytora React Flow bardziej niz to konieczne.
