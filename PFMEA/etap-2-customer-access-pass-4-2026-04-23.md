# Etap 2 - Customer Access + Regression Stabilization

Data: 2026-04-23

## Zakres

- domkniecie modelu `customer` z granularnym dostepem per `project + module`
- dodanie strony ustawien do nadawania grantow dla klienta
- dodanie i uruchomienie realnego e2e dla `customer`
- naprawa flaky helpera logowania w regresji

## Zmiany w aplikacji

### Customer access model

- dodano strone [app/settings/customer-access/page.tsx](</c:/Users/zieada/pfmea-app/app/settings/customer-access/page.tsx>)
- dodano serwis [src/features/settings/customer-access-service.ts](</c:/Users/zieada/pfmea-app/src/features/settings/customer-access-service.ts>)
- dodano helper [src/lib/customer-access.ts](</c:/Users/zieada/pfmea-app/src/lib/customer-access.ts>)
- dodano nawigacje do `Customer Access` w:
  - [src/lib/routing.ts](</c:/Users/zieada/pfmea-app/src/lib/routing.ts>)
  - [src/components/Layout/AppHeader.tsx](</c:/Users/zieada/pfmea-app/src/components/Layout/AppHeader.tsx>)

### Guardy dla customer

- [app/projects/page.tsx](</c:/Users/zieada/pfmea-app/app/projects/page.tsx>)
  - customer widzi tylko grantowane moduly
- [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>)
  - customer musi miec grant `PFD`
- [app/pfmea/page.tsx](</c:/Users/zieada/pfmea-app/app/pfmea/page.tsx>)
  - customer musi miec grant `PFMEA`
- [app/pcp/page.tsx](</c:/Users/zieada/pfmea-app/app/pcp/page.tsx>)
  - customer musi miec grant `PCP`

### Invitation flow

- [app/settings/invitations/page.tsx](</c:/Users/zieada/pfmea-app/app/settings/invitations/page.tsx>)
  - rola `customer` jest juz dostepna do zapraszania

### Stabilizacja regresji

- [scripts/regression/_shared/browserAuth.js](</c:/Users/zieada/pfmea-app/scripts/regression/_shared/browserAuth.js>)
  - helper nie myli juz strony glownej z wymuszonym redirectem do logowania
  - jesli user jest zalogowany, ale nie dociera do targetu, zwraca prawdziwszy blad

## Zmiany w Supabase

- wdrozono migracje [db/2026-04-23_supabase_customer_access_model.sql](</c:/Users/zieada/pfmea-app/db/2026-04-23_supabase_customer_access_model.sql>)
- dodano:
  - tabele `customer_access_grants`
  - RPC:
    - `list_customer_access_candidates(...)`
    - `list_customer_access_grants(...)`
    - `set_customer_access_grant(...)`
- rozszerzono `create_org_invitation(...)` o role `customer`
- zaktualizowano polityki odczytu tak, aby `customer` mial dostep tylko do jawnie grantowanych modulow

## Testy i walidacja

### Quality gates

- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run build` - OK

### E2E

- `npm run regression:org:viewer-flow` - OK
- `npm run regression:org:customer-flow` - OK

## Co potwierdzono praktycznie

### Viewer

- admin tworzy organizacje
- champion aktywuje konto
- champion zaprasza `viewer`
- viewer aktywuje konto
- viewer nie ma dostepu do `settings`

### Customer

- admin tworzy organizacje
- champion aktywuje konto
- champion tworzy `site/department`
- champion tworzy projekt
- champion zaprasza `customer`
- customer aktywuje konto
- champion nadaje dostep tylko do `PFD`
- customer widzi tylko `PFD`
- customer nie widzi `PFMEA` ani `PCP`
- customer nie ma dostepu do `settings`
- reczne wejscie na niegrantowane `/pfmea` i `/pcp` konczy sie powrotem do `/projects`

## Aktualny stan

- model `customer` jest juz aktywny i dziala end-to-end
- stabilnosc testow regresyjnych dla `viewer/customer` jest przywrocona
- bez zmian wizualnych jako celu tej iteracji

## Nastepny sensowny krok

- jesli chcemy domknac Etap 2:
  - dodac e2e dla wielu grantow naraz (`PFD + PFMEA`, `PFMEA + PCP`)
  - dodac test revocation, czyli cofniecia dostepu customerowi
  - sprawdzic, czy customer ma miec dostep tylko do aktualnych draft/open danych czy wybranych rewizji
