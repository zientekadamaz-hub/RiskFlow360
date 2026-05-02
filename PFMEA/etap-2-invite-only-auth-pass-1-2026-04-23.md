# Etap 2 - Invite-only Auth Pass 1

Data: 2026-04-23

## Cel

Domknac najwazniejszy remaining risk po Etapie 1:
- usunac otwarty `signUp()` z flow zaproszen
- przejsc na profesjonalny, token-based activation flow
- wyłączyć zwykly signup w Supabase Auth

## Zmiany wykonane

### 1. Supabase - invite-only activation

Dodane live funkcje:

- `public.get_invitation_preview(uuid)`
- `public.activate_invited_user(uuid, text)`

Plik migracji:
- [2026-04-23_supabase_invite_only_activation.sql](</c:/Users/zieada/pfmea-app/db/2026-04-23_supabase_invite_only_activation.sql>)

Co robią:
- `get_invitation_preview(...)`
  - sprawdza, czy token wskazuje na nadal oczekujace zaproszenie
  - zwraca email, organizacje i podstawowe dane zaproszenia
- `activate_invited_user(...)`
  - przyjmuje tylko `PENDING` invitation token
  - waliduje sile hasla
  - tworzy wpis w `auth.users`
  - tworzy wpis w `auth.identities`
  - korzysta z istniejacych triggerow do zalozenia `profiles`
  - odrzuca probe aktywacji, jesli konto dla tego emaila juz istnieje

Granty:
- obie funkcje maja `SECURITY DEFINER`
- `EXECUTE` tylko dla `anon`, `authenticated`, `service_role`

### 2. Supabase Auth config

Live config zostal zmieniony na:
- `disable_signup = true`

Efekt:
- zwykly publiczny signup jest juz zablokowany na poziomie Auth
- nowe konto moze powstac tylko przez kontrolowany flow zaproszenia

### 3. Aplikacja - login / waiting flow

Zmienione pliki:
- [app/login/page.tsx](</c:/Users/zieada/pfmea-app/app/login/page.tsx>)
- [app/waiting-for-invite/page.tsx](</c:/Users/zieada/pfmea-app/app/waiting-for-invite/page.tsx>)
- [invitation-auth.ts](</c:/Users/zieada/pfmea-app/src/lib/auth/invitation-auth.ts>)

Najwazniejsze zmiany:
- `Set password` nie uzywa juz `supabase.auth.signUp(...)`
- login page pobiera preview zaproszenia po tokenie
- aktywacja konta idzie przez `activate_invited_user(...)`
- po aktywacji aplikacja loguje usera normalnie przez `signInWithPassword(...)`
- `waiting-for-invite` pokazuje konkretny kontekst zaproszenia zamiast czysto ogolnego ekranu

## Walidacja

### Repo

- `rg` nie znajduje juz `auth.signUp(...)` w `app/` i `src/`
- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run build` - OK

### Live Supabase

Potwierdzone:

- `disable_signup = true`
- `activate_invited_user` istnieje i jest `SECURITY DEFINER`
- `get_invitation_preview` istnieje i jest `SECURITY DEFINER`
- granty `EXECUTE` sa ustawione dla:
  - `anon`
  - `authenticated`
  - `service_role`

## Problem rozwiazany

### CRITICAL

Bylo:
- nowy zaproszony user dostawal "Set password", ale technicznie flow opieral sie na otwartym `signUp()` z browsera
- zwykle sign-upy w Supabase byly wlaczone (`disable_signup = false`)

Jest:
- aktywacja nowego usera wymaga waznego invitation tokena
- zwykly signup jest wylaczony na poziomie Supabase Auth

## Ograniczenia tej tury

- nie robilem produkcyjnego end-to-end na realnym nowym invited emailu, zeby nie generowac niepotrzebnych kont testowych w live projekcie
- flow jest zweryfikowany technicznie przez:
  - live funkcje
  - granty
  - config auth
  - brak `signUp()` w kodzie
  - poprawny build aplikacji

## Rekomendowany kolejny krok

Najbardziej sensowny nastepny ruch:

1. dopiac e2e dla:
   - invitation first-password activation
   - invitation accept after activation
   - password recovery
2. wejsc w rozbijanie najwiekszych modulow klientowych:
   - `projects`
   - `pfd`
   - `pfmea`
   - `pcp`
3. zaprojektowac granularny model `customer access`
