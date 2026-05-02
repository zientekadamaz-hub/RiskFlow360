# Etap 2 - Regression Structure Pass 1

Data: 2026-04-23

## Cel

Przygotowac strukture testowa dla flow:
- tworzenie nowej organizacji
- aktywacja championa z invitation link
- wysylanie zaproszenia przez championa
- aktywacja zaproszonego usera
- podstawowa weryfikacja uprawnien

bez uzalezniania sie od prawdziwej skrzynki mailowej.

## Zmiany wykonane

### Nowe helpery regresji

- [testAccounts.js](</c:/Users/zieada/pfmea-app/scripts/regression/_shared/testAccounts.js>)
  - generuje unikalne syntaktycznie poprawne adresy testowe
  - generuje nazwy organizacji
  - generuje bezpieczne hasla testowe

- [invitationFlow.js](</c:/Users/zieada/pfmea-app/scripts/regression/_shared/invitationFlow.js>)
  - helper do tworzenia organizacji z championem
  - helper do wysylania invitation przez championa
  - helper do aktywacji usera z invitation link w swiezym context
  - helper do sprawdzenia, ze engineer nie dostaje dostepu do settings

### Nowy scenariusz e2e

- [invite-flow.js](</c:/Users/zieada/pfmea-app/scripts/regression/org/invite-flow.js>)

Scenariusz:

1. admin loguje sie do `/settings/organizations`
2. tworzy nowa organizacje z pending champion invite
3. champion aktywuje konto z secure link
4. champion loguje sie do `/settings/invitations`
5. champion wysyla invite dla engineer
6. engineer aktywuje konto z secure link
7. test sprawdza, ze engineer nie ma settings-level access

### Integracja z repo

- dodany script npm:
  - `npm run regression:org:invite-flow`
- zaktualizowany:
  - [scripts/regression/README.md](</c:/Users/zieada/pfmea-app/scripts/regression/README.md>)

### Drobna poprawka pod automatyzacje

- [app/login/page.tsx](</c:/Users/zieada/pfmea-app/app/login/page.tsx>)
  - dodane stabilne `name` attributes dla pol login/reset/set-password
  - bez zmiany wygladu

## Najwazniejszy efekt

Core flow organizacja -> champion -> engineer mozna testowac bez prawdziwej skrzynki mailowej.

To jest mozliwe, bo:
- system generuje invitation links w UI
- test kopiuje te linki bezposrednio z aplikacji
- syntaktycznie poprawne unikalne maile typu `...@example.test` wystarczaja do testu logiki produktu

## Czego jeszcze nie testujemy w tej turze

Nie testujemy jeszcze:
- realnej dostarczalnosci emaili
- zawartosci szablonow email
- opoznien / problemow SMTP

To powinno byc osobnym pass'em z prawdziwa skrzynka testowa.

## Walidacja

- `node --check scripts/regression/org/invite-flow.js` - OK
- `node --check scripts/regression/_shared/invitationFlow.js` - OK
- `node --check scripts/regression/_shared/testAccounts.js` - OK
- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run build` - OK

## Dane potrzebne do pierwszego realnego uruchomienia

Do odpalenia nowego scenariusza potrzebne beda tylko:

- `REGRESSION_ADMIN_EMAIL`
- `REGRESSION_ADMIN_PASSWORD`
- opcjonalnie `REGRESSION_TEST_EMAIL_DOMAIN`

Nie potrzeba jeszcze prawdziwego mailboxa.

## Rekomendowany nastepny krok

1. wykonac pierwszy realny przebieg `regression:org:invite-flow` na dedykowanym adminie testowym
2. po tym dopiero zdecydowac, czy chcesz:
   - osobny pass z realna poczta testowa
   - czy najpierw dalej rozbijac monolity `projects/pfd/pfmea/pcp`
