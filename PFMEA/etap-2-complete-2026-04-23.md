# Etap 2 - Zakonczony

Data: 2026-04-23

## Cel etapu

Stabilizacja i domkniecie modelu dostepu oraz flow organizacyjnych:

- invite-only auth
- spojnosc modelu rol
- regresje organizacyjne
- rzeczywisty, granularny model `customer`
- potwierdzenie nadawania, laczenia i cofania grantow

## Co zostalo domkniete

### 1. Invite-only auth

- signup z frontu nie jest juz normalna sciezka wejscia
- aktywacja nowego uzytkownika odbywa sie przez token zaproszenia
- flow `waiting-for-invite` i `set password` jest podpiety do invite-first modelu

### 2. Model rol

- globalny `admin` zostal oddzielony od rol organizacyjnych
- organizacyjne `admin` zostalo usuniete na rzecz `champion`
- `viewer` i `customer` maja juz wyraznie rozdzielone scenariusze

### 3. Customer access

- wdrozono tabele i RPC do granularnych grantow:
  - [db/2026-04-23_supabase_customer_access_model.sql](</c:/Users/zieada/pfmea-app/db/2026-04-23_supabase_customer_access_model.sql>)
- wdrozono strone zarzadzania dostepem:
  - [app/settings/customer-access/page.tsx](</c:/Users/zieada/pfmea-app/app/settings/customer-access/page.tsx>)
- wdrozono guardy w modulach:
  - [app/projects/page.tsx](</c:/Users/zieada/pfmea-app/app/projects/page.tsx>)
  - [app/pfd/page.tsx](</c:/Users/zieada/pfmea-app/app/pfd/page.tsx>)
  - [app/pfmea/page.tsx](</c:/Users/zieada/pfmea-app/app/pfmea/page.tsx>)
  - [app/pcp/page.tsx](</c:/Users/zieada/pfmea-app/app/pcp/page.tsx>)

### 4. Supabase hardening znalezione podczas testow

- `projects_with_revision` zostal przelaczony na `security_invoker = true`
  - [db/2026-04-23_supabase_projects_with_revision_security_invoker.sql](</c:/Users/zieada/pfmea-app/db/2026-04-23_supabase_projects_with_revision_security_invoker.sql>)
- `process_revisions` dostal minimalny `SELECT` dla `authenticated` i policy zgodna z `customer_access_grants`
  - [db/2026-04-23_supabase_process_revisions_customer_select.sql](</c:/Users/zieada/pfmea-app/db/2026-04-23_supabase_process_revisions_customer_select.sql>)

### 5. Stabilizacja harnessu regresji

- poprawiono helper logowania:
  - [scripts/regression/_shared/browserAuth.js](</c:/Users/zieada/pfmea-app/scripts/regression/_shared/browserAuth.js>)
- dodano scenariusze:
  - [scripts/regression/org/customer-flow.js](</c:/Users/zieada/pfmea-app/scripts/regression/org/customer-flow.js>)
  - [scripts/regression/org/customer-revoke-flow.js](</c:/Users/zieada/pfmea-app/scripts/regression/org/customer-revoke-flow.js>)
  - [scripts/regression/org/customer-multi-grant-flow.js](</c:/Users/zieada/pfmea-app/scripts/regression/org/customer-multi-grant-flow.js>)

## Co zostalo potwierdzone testami

### Viewer

- `npm run regression:org:viewer-flow` - OK
- viewer:
  - aktywuje konto z zaproszenia
  - nie ma dostepu do `settings`

### Customer - pojedynczy grant

- `npm run regression:org:customer-flow` - OK
- customer:
  - dostaje tylko `PFD`
  - widzi tylko `PFD`
  - nie widzi `PFMEA` ani `PCP`
  - nie ma dostepu do `settings`
  - nie wejdzie recznie na niegrantowane moduly

### Customer - revoke

- `npm run regression:org:customer-revoke-flow` - OK
- po cofnieciu grantu:
  - projekt znika z listy
  - customer wraca do stanu `No granted modules yet`
  - reczne wejscie na modul jest blokowane

### Customer - wiele grantow

- `npm run regression:org:customer-multi-grant-flow` - OK
- customer:
  - dostaje `PFD + PFMEA`
  - widzi oba grantowane moduly
  - dalej nie widzi `PCP`
  - moze wejsc tylko na grantowane moduly

### Quality gates

- `npm run check` - OK

## Wniosek

Etap 2 mozna uznac za zakonczony.

Najwazniejsze ryzyka tego etapu zostaly zamkniete:

- auth jest invite-first
- role sa bardziej spójne
- flow organizacyjne maja realne e2e
- model `customer` nie jest juz tylko placeholderem
- grant, revoke i multi-grant sa potwierdzone na zywo
- znaleziony podczas testow problem z view/RLS zostal naprawiony w Supabase

## Co zostaje na Etap 3

- rozbijanie monolitow `Projects / PFD / PFMEA / PCP`
- dalsze przenoszenie logiki DB z widokow do services/repositories
- ograniczenie klientowych hotspotow i poprawa testowalnosci
- dalsze porzadkowanie architektury Next.js / shell / layout
