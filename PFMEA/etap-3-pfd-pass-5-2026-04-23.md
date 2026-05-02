# Etap 3 - PFD Pass 5

Data: 2026-04-23

## Cel

Wyciagnac z [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>) kolejny obszar czysto edytorowej logiki React Flow: mutacje edge'ow, obsluge selection oraz snapowanie dragowania.

## Co zostalo zrobione

### 1. Dodanie helperow edytora

Dodano [src/features/pfd/pfd-editor-utils.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-editor-utils.ts>).

Trafily tam:

- `applySelectionToEdges(...)`
- `removeDanglingUpdatedEdge(...)`
- `updateEdgeConnection(...)`
- `pruneRecentConnectionKeys(...)`
- `appendConnectionEdge(...)`
- `snapDraggedNode(...)`

To sa helpery czysto edytorowe, niezalezne od wygladu strony i niezalezne od Supabase.

### 2. Oczyszczenie route page z mutacji edge'ow

W [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>) przepieto na helpery:

- `onSelectionChange`
- `onEdgeUpdateEnd`
- `onEdgeUpdate`
- `commitConnection`
- `onNodeDrag`

Efekt:

- route page nie trzyma juz lokalnie kolejnej grupy transformacji tablic `edges`
- logika recent-key pruning i budowania edge'a nie siedzi juz inline w komponencie
- snap dragowania wezla jest skupiony poza widokiem

## Co to daje architektonicznie

Po tym passie `PFD` ma juz rozdzielone:

- dane i sesje
- mini-panel PFMEA
- operacje procesu
- helpery flow/geometrii
- helpery mutacji edytora

To jest kolejny krok od monolitu do modulu feature-level, w ktorym route page przestaje byc jednoczesnie:

- warstwa danych
- warstwa pomocnicza
- warstwa interakcyjna
- warstwa UI

## Czego jeszcze nie ruszalismy

Nadal zostaje lokalnie w [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>):

- tworzenie czesci symboli i lokalnych node factories
- logika dialogow `confirm` / `decisionConnect`
- sporo stanu toolbaru i side-paneli
- czesc handlerow UI i skrótów klawiaturowych

To sa nadal sensowne kandydaty na kolejne passy Etapu 3.

## Walidacja

- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run build` - OK
- `REGRESSION_ADMIN_EMAIL=riskflow360@gmail.com REGRESSION_ADMIN_PASSWORD=... npm run regression:org:customer-flow` - OK

## Decyzja na nastepny krok

Najrozsadniejszy kolejny krok:

- jeszcze jeden pass na `PFD`, ale juz bardziej pod dialogi i node factories
- po tym bedziemy mieli dobry moment, zeby zatrzymac sie na checkpointcie architektonicznym i wejsc w zaplanowana standaryzacje wspolnego UI

Nadal bez ruszania wygladu w tym strumieniu prac.
