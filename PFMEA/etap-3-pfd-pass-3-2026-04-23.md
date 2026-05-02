# Etap 3 - PFD Pass 3

Data: 2026-04-23

## Cel

Wyciagnac z [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>) kolejne operacje bazodanowe zwiazane z `operations`, tak zeby route page nie wykonywala juz lokalnie kolejnej grupy mutacji Supabase.

## Co zostalo zrobione

### 1. Dodanie warstwy serwisowej dla `operations`

Dodano [src/features/pfd/pfd-operations-service.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-operations-service.ts>).

Trafily tam:

- `patchOperationRecord(...)`
- `createOperationRecord(...)`
- `renumberOperationRecords(...)`
- `archiveOperationsAndDeletePfmea(...)`
- `resequenceOperationRecords(...)`

Zakres:

- aktualizacja pojedynczej operacji
- tworzenie nowej operacji
- hurtowe renumberowanie `operation_number`
- archiwizacja operacji wraz z usunieciem powiazanych `pfmea_rows`
- resekwencjonowanie calej listy operacji

### 2. Przepiecie `PFD` page na serwis

W [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>) przepieto na serwis:

- `patchOperation`
- `addOperationAtEnd`
- `addOperationAfterSelected`
- usuwanie operacji w `deleteSelected`
- `resequenceOperations`

Efekt:

- route page nie robi juz bezposrednio kolejnej grupy `insert/update/delete` do `operations`
- logika mutacji danych procesu zaczyna byc skupiona poza komponentem strony

### 3. Domkniecie spojnosci mini-panelu

Przy okazji przepialem `openPfmeaFor` na [src/features/pfd/pfmea-mini-service.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfmea-mini-service.ts>), zeby odczyt `pfmea_rows` nie byl juz zdublowany lokalnie w page.

## Co to daje architektonicznie

Po trzech passach `PFD` ma juz wyraznie wydzielone warstwy:

- [src/features/pfd/types.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/types.ts>)
- [src/features/pfd/pfd-service.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-service.ts>)
- [src/features/pfd/pfmea-mini-service.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfmea-mini-service.ts>)
- [src/features/pfd/pfd-operations-service.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-operations-service.ts>)

Najwazniejszy efekt:

- `PFD` page jest coraz bardziej kontenerem UI i stanu edytora, a coraz mniej lokalna warstwa danych / CRUD

To nadal nie jest koniec refaktoru `PFD`, ale kolejny duzy obszar monolitu zostal odchudzony bez ryzyka wizualnej regresji.

## Czego jeszcze nie ruszalismy

Nadal zostalo sporo lokalnej logiki:

- mutacje i helpery stricte React Flow
- tworzenie/usuwanie symboli nienależących do `operations`
- czesc logiki selekcji, dragowania i geometrii
- lokalny stan dialogow i toolbarow

To bedzie material na kolejne passy Etapu 3.

## Walidacja

- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run build` - OK
- `REGRESSION_ADMIN_EMAIL=riskflow360@gmail.com REGRESSION_ADMIN_PASSWORD=... npm run regression:org:customer-flow` - OK

## Decyzja na nastepny krok

Najrozsadniejszy kolejny krok:

- wejsc w helpery i mutacje React Flow w `PFD`
- wydzielic pierwsza warstwe czysto edytorowych helperow poza route page

Nadal bez ruszania wygladu i przed planowana standaryzacja wspolnego UI.
