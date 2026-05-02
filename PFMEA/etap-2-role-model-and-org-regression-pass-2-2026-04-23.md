# Etap 2 - Role Model And Org Regression Pass 2

Data: 2026-04-23

## Cel

1. usunac niespojnosc modelu roli `admin` na poziomie organizacji
2. ustawic poprawny globalny admin dla konta wlasciciela
3. wykonac pierwszy realny end-to-end test:
   - nowa organizacja
   - champion invitation
   - champion activation
   - engineer invitation
   - engineer activation
   - ograniczenie dostepu engineer do settings

## Zmiany wykonane

### 1. Normalizacja modelu roli

Plik:
- [2026-04-23_supabase_role_model_normalization.sql](</c:/Users/zieada/pfmea-app/db/2026-04-23_supabase_role_model_normalization.sql>)

Live Supabase:
- `riskflow360@gmail.com` ma teraz `profiles.global_role = 'admin'`
- `organization_members.role = 'admin'` zostalo wyzerowane
- wszystkie legacy membershipy `admin` zostaly zamienione na `champion`
- `is_org_admin_or_champion_v2(...)` honoruje teraz:
  - globalny `admin`
  - organizacyjny `champion`

Potwierdzenie:
- `riskflow360@gmail.com` => `global_role = admin`, `org_role = champion`
- `organization_members.role = 'admin'` => `0` rekordow

### 2. Aplikacja - usuniecie org admin z logiki UI

Zmienione pliki:
- [client-session.ts](</c:/Users/zieada/pfmea-app/src/lib/auth/client-session.ts>)
- [AppHeader.tsx](</c:/Users/zieada/pfmea-app/src/components/Layout/AppHeader.tsx>)
- [invitations page](</c:/Users/zieada/pfmea-app/app/settings/invitations/page.tsx>)

Zakres:
- `settings` sa dostepne juz tylko dla:
  - `global admin`
  - `org champion`
- `champion invite` jest mozliwy juz tylko dla:
  - `global admin`
  - `org champion`

### 3. Invite-only activation - compatibility fix

Poprawiony plik:
- [2026-04-23_supabase_invite_only_activation.sql](</c:/Users/zieada/pfmea-app/db/2026-04-23_supabase_invite_only_activation.sql>)

Naprawione:
- usuniety insert do `auth.users.confirmed_at` (generated column)
- usuniety insert do `auth.identities.email` (generated column)

Efekt:
- `activate_invited_user(...)` dziala z aktualnym live schematem Supabase Auth

### 4. Stabilizacja helpera regresji

Poprawiony plik:
- [browserAuth.js](</c:/Users/zieada/pfmea-app/scripts/regression/_shared/browserAuth.js>)

Naprawione:
- helper logowania nie wyklada sie juz na przejsciowym stanie login page podczas auto-restore sesji

## Wynik realnego przebiegu E2E

Uruchomione:
- `npm run regression:org:invite-flow`

Wynik:
- `OK`

Przebieg potwierdzony end-to-end:

1. global admin zalogowal sie poprawnie
2. utworzyl nowa organizacje
3. system wygenerowal secure champion invitation link
4. champion ustawil pierwsze haslo z linku
5. champion wszedl do `settings/invitations`
6. champion zaprosil engineer
7. engineer ustawil pierwsze haslo z linku
8. engineer skonczyl na `/`
9. engineer nie dostal dostepu do `settings`

Przebieg:
- `organizationName = RF360 ORG 1776951902387-292`
- `championEmail = rf360-champion-1776951902387-292@example.test`
- `engineerEmail = rf360-engineer-1776951902387-292@example.test`

## Walidacja

- `npm run regression:org:invite-flow` - OK
- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run build` - OK

## Najwazniejszy wniosek

Core biznesowy flow dla:
- tworzenia organizacji
- uruchomienia championa
- zapraszania kolejnego usera
- aktywacji konta z invitation link

dziala juz realnie end-to-end bez potrzeby prawdziwej skrzynki mailowej.

## Rekomendacja co dalej

Najbardziej sensowne nastepne kroki:

1. dodac drugi scenariusz e2e:
   - `viewer` lub `customer` restricted access
2. dodac osobny pass dla realnej poczty testowej:
   - tylko jesli chcesz testowac dostarczalnosc maili
3. wrocic do dalszego rozbijania monolitow:
   - `projects`
   - `pfd`
   - `pfmea`
   - `pcp`
