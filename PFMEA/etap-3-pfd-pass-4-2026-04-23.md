# Etap 3 - PFD Pass 4

Data: 2026-04-23

## Cel

Wyciagnac z [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>) czyste helpery edytora React Flow i geometrii, tak zeby route page nie byla juz magazynem dla funkcji pomocniczych niezaleznych od UI.

## Co zostalo zrobione

### 1. Dodanie warstwy helperow edytora

Dodano [src/features/pfd/pfd-flow-utils.ts](</c:/Users/zieada/pfmea-app/src/features/pfd/pfd-flow-utils.ts>).

Trafily tam:

- `isOperationNode(...)`
- `isLinearStepNode(...)`
- `sortOperationsByNumber(...)`
- `sortLinearSteps(...)`
- `findLinearTail(...)`
- `findSmallestFree10(...)`
- `isOperationId(...)`
- `nodeRect(...)`
- `overlapRatio(...)`
- `sanitizeNodes(...)`
- `sanitizeEdges(...)`
- typ `PfdFlowEdge`

To sa funkcje czysto pomocnicze, niewiazane bezposrednio z renderingiem strony.

### 2. Oczyszczenie route page

W [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>):

- usunieto lokalne definicje tych helperow
- przepieto wywolania na `src/features/pfd/pfd-flow-utils.ts`
- uproszczono importy i lokalne typy

Najwazniejsze miejsca, ktore korzystaja teraz z helpera feature-level:

- sanitizacja `nodes/edges` przy ladowaniu canvasu i draftu
- wyznaczanie taila liniowego procesu
- sortowanie krokow operacyjnych
- logika geometrii i snapowania przy dragowaniu
- identyfikacja operacji przy selekcji

## Co to daje architektonicznie

To jest wazny krok, bo `PFD` page przestaje mieszac trzy rozne odpowiedzialnosci naraz:

- UI ekranu
- dane i mutacje Supabase
- wewnetrzne helpery edytora/flow

Po tym passie mamy juz osobna warstwe dla:

- danych i sesji
- mini-panelu PFMEA
- operacji procesu
- helperow React Flow / geometrii

Czyli `PFD` zaczyna przypominac prawdziwy modul feature-level, a nie pojedynczy, monolityczny route component.

## Czego jeszcze nie ruszalismy

Nadal zostalo w `PFD` sporo lokalnego ciezaru:

- czesc mutacji edge/node i dialogow
- tworzenie symboli nienależących do `operations`
- logika toolbaru i zachowan interakcyjnych
- komponenty i stany dialogow nadal sa skupione w jednym pliku

To nadal jest dobry material na kolejne passy Etapu 3.

## Walidacja

- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run build` - OK
- `REGRESSION_ADMIN_EMAIL=riskflow360@gmail.com REGRESSION_ADMIN_PASSWORD=... npm run regression:org:customer-flow` - OK

## Decyzja na nastepny krok

Najrozsadniejszy kolejny krok:

- dalej rozcinac `PFD`, ale juz w kierunku mutacji node/edge i lokalnych dialogow
- po jeszcze 1-2 takich passach mozna bedzie wejsc w zaplanowany strumien standaryzacji wspolnego UI

Czyli nadal priorytetem pozostaje architektura i utrzymywalnosc bez ruszania wygladu.
