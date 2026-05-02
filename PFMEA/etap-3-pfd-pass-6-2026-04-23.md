# Etap 3 - PFD Pass 6

Data: 2026-04-23

## Cel

Domknac kolejny pass architektoniczny `PFD` przez wydzielenie node factories i logiki tworzenia symboli, tak aby route page nie trzymala juz lokalnie kolejnej grupy konstruktorow wezlow.

## Co zostalo zrobione

### 1. Dodanie factory dla wezlow i prostych edge'y

Dodano [src/features/pfd/pfd-node-factory.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-node-factory.ts>).

Trafily tam:

- `makeLocalNodeId(...)`
- `createDecisionNode(...)`
- `createStartStopNode(...)`
- `createCircleNode(...)`
- `createTriangleNode(...)`
- `createFrameNode(...)`
- `createProcessRefNode(...)`
- `createLinearStepEdge(...)`

To sa funkcje odpowiedzialne za tworzenie spójnych obiektow React Flow dla symboli `PFD`.

### 2. Oczyszczenie route page z node factories

W [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>) przepieto na factory:

- `addDecisionNearSelected`
- `addStartStopNearSelected`
- `addCircleNearSelected`
- `addTriangleNearSelected`
- `addFrameNearSelected`
- `addProcessRefNearSelected`

Efekt:

- route page nie buduje juz inline kolejnej grupy obiektow `Node<PfdData>` i `Edge`
- tworzenie symboli jest skupione poza komponentem strony
- utrzymanie spójności konfiguracji symboli będzie prostsze w kolejnych passach

### 3. Domkniecie warningow po refaktorze

Po wyniesieniu `makeLocalNodeId(...)` poprawilem zaleznosci `useCallback`, tak zeby `lint` wrocil do czystego stanu.

## Co to daje architektonicznie

Po szesciu passach `PFD` ma juz sensownie rozbite odpowiedzialnosci na:

- [src/features/pfd/types.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/types.ts>)
- [src/features/pfd/pfd-service.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-service.ts>)
- [src/features/pfd/pfmea-mini-service.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfmea-mini-service.ts>)
- [src/features/pfd/pfd-operations-service.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-operations-service.ts>)
- [src/features/pfd/pfd-flow-utils.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-flow-utils.ts>)
- [src/features/pfd/pfd-editor-utils.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-editor-utils.ts>)
- [src/features/pfd/pfd-node-factory.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-node-factory.ts>)

Najwazniejszy efekt:

- `PFD` przestalo byc tylko jednym, ciezkim route componentem
- najwazniejsze obszary logiki sa juz wyniesione do feature layer
- dalsze zmiany beda latwiejsze, bo logika jest grupowana tematycznie zamiast mieszac sie w jednym pliku

## Pozostale rzeczy w `PFD`

Nadal lokalnie zostaje:

- czesc dialogow `confirm` / `decisionConnect`
- sporo stanu toolbaru i paneli
- czesc handlerow klawiatury i UI orchestration

To jednak jest juz dobry checkpoint architektoniczny. Kolejny sensowny strumien prac nie musi dalej ciac `PFD` bez konca.

## Walidacja

- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run build` - OK
- `REGRESSION_ADMIN_EMAIL=riskflow360@gmail.com REGRESSION_ADMIN_PASSWORD=... npm run regression:org:customer-flow` - OK

## Decyzja na nastepny krok

To jest dobry moment, zeby:

1. zatrzymac sie na checkpointcie architektonicznym dla `PFD`
2. przejsc do zaplanowanej standaryzacji wspolnego UI w Etapie 3

Powod:

- architektura najciezszych modulow jest juz sensownie odchudzona
- dalsze rozcinanie samego `PFD` daje coraz mniejszy zwrot niz rozpoczecie wspolnego systemu komponentow UI
- temat spójności wizualnej byl od poczatku wpisany do raportu i teraz mamy na niego najlepszy moment
