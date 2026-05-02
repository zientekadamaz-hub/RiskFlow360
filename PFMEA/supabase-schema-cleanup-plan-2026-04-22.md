# Supabase Schema Cleanup Plan - 2026-04-22

## Cel
- uporzadkowac martwe lub legacy obiekty w Supabase
- nie kasowac niczego pochopnie przy istniejacym drifcie miedzy kodem a live schema
- przygotowac bezpieczna kolejnosc cleanupu

## Executive Summary
Po review live bazy i repo widac trzy klasy problemow:

1. sa obiekty z bardzo wysokim prawdopodobienstwem bycia martwymi
2. sa kolumny wygladajace na legacy, ale czesc z nich nadal jest trzymana przez aktualny model danych
3. jest drift miedzy kodem a baza:
   - kod odwoluje sie do `process_module_revisions`, ale tej tabeli nie ma live
   - kod odwoluje sie do `pfmea_row_backups`, ale tej tabeli nie ma live

To oznacza, ze cleanup trzeba robic jako:
- najpierw alignment kodu i schematu
- potem dopiero usuwanie widokow i kolumn

## Twarde Dane Z Live Bazy
- `projects.current_revision_id`: `0 / 2` rekordow ma wartosc
- `projects.user_id`: `2 / 2` rekordow ma wartosc
- `projects.standard`: `2 / 2` rekordow ma wartosc
- `access_requests.requested_seats`: `0 / 0` rekordow ma wartosc
- `operations.description`: `0 / 48` rekordow ma wartosc
- `operations.special_characteristic = true`: `0 / 48` rekordow
- `organization_invitations.expires_at`: `0 / 3` rekordow ma wartosc

## Obiekty Live O Wysokim Prawdopodobienstwie Legacy

### Widoki
| Obiekt | Ocena | Status | Uzasadnienie |
|---|---|---|---|
| `org_invitations_list` | HIGH | `delete after confirmation` | cienki pass-through na `organization_invitations`, brak usage w app |
| `org_license_usage` | HIGH | `delete after confirmation` | raportowy view, brak usage w app |
| `processes` | HIGH | `deprecate then delete` | stary model oparty o `projects.current_revision_id` |
| `severity_effective` | HIGH | `delete after confirmation` | zastapione przez RPC `get_*_effective` |

### Kolumny
| Obiekt | Ocena | Status | Uzasadnienie |
|---|---|---|---|
| `projects.current_revision_id` | HIGH | `deprecate then delete` | `0 / 2` uzyc live, trzyma przy zyciu stary view `processes` |
| `access_requests.requested_seats` | HIGH | `delete when contract confirmed` | route zapisuje `requested_invites`, pole wyglada na porzucona zmiane wymagan |
| `operations.description` | HIGH | `delete after code scan confirmation` | `0 / 48` wartosci i brak aktywnego usage w app |
| `operations.special_characteristic` | HIGH | `delete after code scan confirmation` | `0 / 48` aktywnych wartosci i brak usage w app |
| `organization_invitations.expires_at` | MEDIUM | `either implement or remove` | logika jeszcze istnieje, ale tworzenie zaproszen ustawia `null` |
| `projects.user_id` | MEDIUM | `deprecate, not delete now` | pole nadal wypelnione i wystepuje w view, ale model auth jest org-based |
| `projects.standard` | MEDIUM | `keep or redefine` | nadal wypelnione, ale obecnie wyglada na placeholder domenowy |

## Drift Kod-Baza

### `process_module_revisions`
Status:
- kod odwoluje sie w:
  - `app/projects/page.tsx`
  - `app/pfd/page.tsx`
  - `app/pfmea/page.tsx`
  - `app/pcp/page.tsx`
- live schema nie ma tej tabeli

Interpretacja:
- to nie jest zwykla martwa tabela
- to jest legacy fallback w kodzie, ktory zostal po starszym modelu wersjonowania

Ocena:
- `CRITICAL` jako debt spojnoscowy

Rekomendacja:
- usunac lub przepiac fallbacki na aktualne zrodlo rewizji
- dopiero potem uznac temat za zamkniety

### `pfmea_row_backups`
Status:
- kod odwoluje sie w `app/pfmea/page.tsx`
- repo ma stary SQL `db/pfmea_row_backups.sql`
- live schema nie ma tej tabeli
- w kodzie istnieje juz guard `isMissingPfmeaBackupStorageError(...)`, czyli autor przewidzial brak tabeli

Interpretacja:
- funkcja jest juz de facto optional / nieaktywna
- to bardzo mocny sygnal, ze feature jest polmartwy

Ocena:
- `HIGH` jako dead-feature debt

Rekomendacja:
- zdecydowac:
  - albo przywracamy feature i tworzymy tabele swiadomie
  - albo usuwamy backup flow z kodu i stary SQL z repo

## Matryca Cleanupu

### Keep
- `access_requests.notes_admin`
- `access_requests.handled_by`
- `access_requests.handled_at`
- wszystkie tabele rating defaults / overrides
- `projects_with_revision`

Powod:
- brak dowodu, ze sa martwe
- czesc z nich ma sens jako backoffice albo aktywna warstwa domenowa

### Deprecate
- `processes`
- `projects.current_revision_id`
- `projects.user_id`
- `projects.standard`
- `organization_invitations.expires_at`
- wszystkie kodowe referencje do `process_module_revisions`
- wszystkie kodowe referencje do `pfmea_row_backups`

Powod:
- wymagaja najpierw odciecia lub doprecyzowania kontraktu

### Delete Po Potwierdzeniu
- `org_invitations_list`
- `org_license_usage`
- `severity_effective`
- `access_requests.requested_seats`
- `operations.description`
- `operations.special_characteristic`

Powod:
- wysoki sygnal legacy i brak aktywnego usage

## Rekomendowana Kolejnosc Wdrazania

### Etap 1 - Alignment kodu z live schema
1. usunac fallbacki do `process_module_revisions`
2. zdecydowac los `pfmea_row_backups`
3. odpalic `lint`, `typecheck`, `build`

Efekt:
- repo przestaje udawac, ze korzysta z obiektow, ktorych nie ma w live DB

### Etap 2 - Cleanup widokow legacy
1. potwierdzic brak uzycia poza frontendem
2. usunac:
   - `org_invitations_list`
   - `org_license_usage`
   - `severity_effective`
3. zdeprecjonowac `processes`

Efekt:
- uproszczenie public schema
- mniej legacy warstw kompatybilnosci

### Etap 3 - Cleanup kolumn niskiej wartosci
1. usunac:
   - `access_requests.requested_seats`
   - `operations.description`
   - `operations.special_characteristic`
2. podjac decyzje dla `organization_invitations.expires_at`

Efekt:
- mniej martwych pol
- prostsze kontrakty tabel

### Etap 4 - Decyzje domenowe
1. zdecydowac, czy `projects.standard` ma realna wartosc biznesowa
2. zdecydowac, czy `projects.user_id` ma zostac jako audit/owner, czy zniknac
3. po tym usunac `projects.current_revision_id` i finalnie `processes`

Efekt:
- zamkniecie starego modelu rewizji i owner-based leftovers

## Ryzyka
- mozliwe istnieje zewnetrzny usage widokow przez reczne zapytania, dashboard lub export
- `projects.user_id` i `projects.standard` sa wypelnione, wiec nie wolno ich usuwac bez decyzji domenowej
- `organization_invitations.expires_at` ma nadal zywa logike w funkcjach SQL, wiec usuniecie bez refaktoru byloby nieczyste

## Najblizszy Bezpieczny Krok
Najbezpieczniej wykonac teraz:

1. cleanup kodu z referencji do `process_module_revisions`
2. decyzje i cleanup wokol `pfmea_row_backups`
3. dopiero potem pierwsza migracje kasujaca martwe widoki i kolumny

## Finalna Ocena
Tak, w Supabase sa realne kandydaty do cleanupu.

Najwazniejszy wniosek nie brzmi jednak:
- "usunmy kilka nieuzywanych kolumn"

Tylko:
- "najpierw domknijmy drift miedzy repo i live schema, potem wycinajmy legacy warstwy"
