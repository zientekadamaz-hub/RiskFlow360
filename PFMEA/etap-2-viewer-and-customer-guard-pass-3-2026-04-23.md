# Etap 2 - Viewer And Customer Guard Pass 3

Data: 2026-04-23

## Cel

1. potwierdzic realnie flow dla roli `viewer`
2. potwierdzic, ze `customer` nie jest jeszcze wystawiony w produkcie
3. utrzymac bezpieczna granice: nie wlaczac `customer`, dopoki nie ma granularnego modelu dostepu

## Zmiany wykonane

### 1. Nowy scenariusz regresji dla `viewer`

Dodany plik:
- [viewer-flow.js](</c:/Users/zieada/pfmea-app/scripts/regression/org/viewer-flow.js>)

Nowy script:
- `npm run regression:org:viewer-flow`

Scenariusz:

1. global admin tworzy nowa organizacje
2. champion aktywuje konto z secure link
3. champion przechodzi do `settings/invitations`
4. test potwierdza, ze `CUSTOMER` nie jest dostepny w selectorze roli
5. champion wysyla invitation dla `VIEWER`
6. viewer aktywuje konto z secure link
7. test sprawdza, ze viewer nie ma settings-level access

### 2. Guard dla `customer`

Dodany helper:
- [invitationFlow.js](</c:/Users/zieada/pfmea-app/scripts/regression/_shared/invitationFlow.js>)

Nowe zachowanie testowe:
- skrypt czyta opcje z role selecta na `settings/invitations`
- test failuje, jesli `CUSTOMER` pojawi sie w UI przed wdrozeniem docelowego modelu dostepu

### 3. Dokumentacja i DX

Zaktualizowane:
- [package.json](</c:/Users/zieada/pfmea-app/package.json>)
- [scripts/regression/README.md](</c:/Users/zieada/pfmea-app/scripts/regression/README.md>)

## Wynik realnego przebiegu

Uruchomione:
- `npm run regression:org:viewer-flow`

Wynik:
- `OK`

Potwierdzony przebieg:

1. admin utworzyl nowa organizacje
2. champion ustawil pierwsze haslo z linku
3. champion wszedl do `settings/invitations`
4. `CUSTOMER` nie byl widoczny jako rola invitation
5. champion zaprosil `VIEWER`
6. viewer ustawil pierwsze haslo z linku
7. viewer skonczyl na `/`
8. viewer nie dostal dostepu do `settings`

Przebieg:
- `organizationName = RF360 VIEWER-ORG 1776952362996-412`
- `championEmail = rf360-viewer-champion-1776952362996-412@example.test`
- `viewerEmail = rf360-viewer-user-1776952362996-412@example.test`

## Dlaczego `customer` nadal nie jest wlaczony

To jest decyzja celowa i technicznie uzasadniona.

Aktualny stan:
- `customer` istnieje w enumie `app_role`
- ale `create_org_invitation(...)` nadal akceptuje tylko:
  - `champion`
  - `engineer`
  - `viewer`

To jest poprawne na teraz, bo:
- obecne RLS w wielu miejscach nadal daje szeroki org-level read zwyklym czlonkom organizacji
- gdyby `customer` byl teraz zwyklym memberem org, dostalby za szeroki dostep
- docelowy `customer` wymaga osobnego modelu:
  - access per projekt / modul / rewizja
  - nie pelnego czlonkostwa org jak `viewer`

## Walidacja

- `npm run regression:org:viewer-flow` - OK
- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run build` - OK

## Wniosek

Po tej turze mamy juz realnie potwierdzone flow dla:
- `champion`
- `engineer`
- `viewer`

oraz swiadomie utrzymany guard dla:
- `customer`

## Rekomendowany kolejny krok

Nastepny sensowny etap to juz projekt i wdrozenie modelu `customer access`, np.:

1. tabela grantow dostepu:
   - `customer_access_grants`
2. zakres grantu:
   - organizacja
   - projekt
   - modul (`PFD` / `PFMEA` / `PCP`)
   - opcjonalnie tylko konkretna rewizja
3. UI dla championa:
   - nadawanie dostepu klientowi do konkretnych modulow
4. dopiero potem:
   - wlaczenie `customer` w invitation flow
   - osobny e2e dla customer
