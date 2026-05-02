# Etap 1 - Hardening Pass 1

Data: 2026-04-23

## Cel

Domknac najbardziej ryzykowne problemy z audytu w obszarach:
- publiczny surface Supabase / RLS
- publiczny request-access
- bezposrednie mutacje danych z poziomu komponentu

## Zmiany wykonane

### 1. Supabase - live hardening

Zamkniete zostaly broad policies i publiczny write surface dla danych aplikacyjnych:

- pozostale policy z rola `public` dla tabel aplikacyjnych zostaly przepiete na `authenticated`
- `site_departments` zostalo domkniete do modelu `admin/champion` dla `INSERT` i `DELETE`
- `submit_access_request(...)` istnieje live jako `SECURITY DEFINER`
- bezposredni `INSERT` do `public.access_requests` dla `anon/authenticated` zostal usuniety
- policy `access_requests_insert_public` nie wystepuje juz live
- wykonanie `submit_access_request(...)` zostalo zostawione tylko dla:
  - `anon`
  - `authenticated`
  - `service_role`

### 2. Request access - backend workflow

Kod aplikacji nie zapisuje juz requestow bezposrednio do tabeli:

- [app/api/request-access/route.ts](</c:/Users/zieada/pfmea-app/app/api/request-access/route.ts>)
  - korzysta teraz z kontrolowanego RPC
  - zwraca `409` dla konfliktow typu duplicate / pending / recent
- [src/lib/request-access-service.ts](</c:/Users/zieada/pfmea-app/src/lib/request-access-service.ts>)
  - nowy serwis dla `submit_access_request(...)`
- [src/lib/request-access.ts](</c:/Users/zieada/pfmea-app/src/lib/request-access.ts>)
  - ostrzejsza walidacja wejscia
  - limity dlugosci pol
  - sensowny limit `requestedInvites`

Efekt:
- formularz request-access nie zapisuje juz bezposrednio do tabeli
- jest throttling / duplicate protection po stronie bazy
- powierzchnia abuse jest istotnie mniejsza

### 3. Refaktor techniczny bez zmiany UI

Wydzielona zostala warstwa danych dla settings/sites-departments:

- nowy plik: [site-departments-service.ts](</c:/Users/zieada/pfmea-app/src/features/settings/site-departments-service.ts>)
- zaktualizowany widok: [page.tsx](</c:/Users/zieada/pfmea-app/app/settings/sites-departments/page.tsx>)

Zakres:
- odczyt kontekstu organizacji
- load listy site/departments
- replace site/departments
- delete site
- toggle active

Efekt:
- komponent nie wykonuje juz bezposrednio calej logiki danych
- zniknely lokalne `as any` fallbacki timeoutowe
- strona jest latwiejsza do testowania i dalszego dzielenia

## Walidacja

### Repo

- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run build` - OK

### Live Supabase

Potwierdzone po wykonaniu zmian:

- brak policy z rola `public` dla tabel aplikacyjnych z tego passu
- `access_requests` nie ma direct privileges dla `anon/authenticated`
- `submit_access_request` ma `EXECUTE` dla `anon`, `authenticated`, `service_role`
- `site_departments_insert` i `site_departments_delete` sa scoped do `is_org_admin_or_champion_v2(...)`

## Problemy zamkniete

### CRITICAL

- publiczny insert surface do `access_requests`
- broad policy roles `public` dla czesci danych aplikacyjnych

### HIGH

- zbyt szeroki write access dla `site_departments`
- bezposrednia logika DML w komponencie settings/sites-departments

## Pozostale ryzyka po Etapie 1

To nie sa juz tematy na ten pass, ale nadal wymagaja kolejnych etapow:

- flow "Set password" w [app/login/page.tsx](</c:/Users/zieada/pfmea-app/app/login/page.tsx>) nadal bazuje na `supabase.auth.signUp(...)`, wiec auth layer nie jest jeszcze w pelni invite-only
- nadal istnieja duze monolityczne moduły `projects`, `pfd`, `pfmea`, `pcp`
- testy automatyczne nadal sa za slabe wzgledem ciezaru systemu
- model `customer` nie jest jeszcze zaprojektowany i wdrozony end-to-end

## Rekomendacja na kolejny pass

Etap 1 mozna uznac za zamkniety funkcjonalnie. Nastepny logiczny ruch:

1. domknac auth/invitation flow na poziomie "invite-only"
2. wejsc w stabilizacje testow i krytycznych user flows
3. dalej rozbijac duze moduły na serwisy / feature slices bez ruszania UX
