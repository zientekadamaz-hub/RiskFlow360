# WATLOW Demo Data Seed - 2026-04-24

## Cel
Przygotowac dane demonstracyjne dla organizacji `WATLOW`, tak aby na stronie `Projects` bylo widac:
- rozne statusy projektow
- rozne rewizje
- komentarze rewizji w popupie
- rozne poziomy `RPN`
- wiecej niz jeden `site/department`

## Co zostalo dodane / zmienione

### Nowe `site / department`
- `Berlin / Maintenance`
- `Krakow / Engineering`
- `Krakow / Quality`
- `Poznan / Laboratory`
- `Wroclaw / Production`

Istniejace:
- `Tychy / Production`

### Projekty demonstracyjne
- `Cartridge Heater Assembly` -> `OPEN`, rev `2.3.1`, avg RPN `420`
- `Sensor Lead Brazing` -> `OPEN`, rev `1.2.1`, avg RPN `222.5`
- `Nozzle Calibration` -> `OPEN`, rev `1.1.1`, avg RPN `130`
- `Insulation Potting` -> `OPEN`, rev `1.1.1`, avg RPN `57`
- `Terminal Crimp Preparation` -> `DRAFT`, rev `1.1.0`, avg RPN `104`
- `Power Cable Routing` -> `DRAFT`, rev `0.1.0`, avg RPN `164`
- `Export Packaging Validation` -> `OBSOLETE`, rev `1.1.1`, avg RPN `72`
- `Thermostat Housing Review` -> `OPEN`, rev `3.2.1`, avg RPN `190`
- `Seal Inspection Pilot` -> `DRAFT`, rev `1.0.0`, bez ryzyk
- `Connector Weld Audit` -> `OPEN`, rev `2.2.1`, avg RPN `228`

## Co zostalo dodane do danych projektu
- `process_revisions`
- `operations`
- `pfmea_rows`
- `pfd_change_history`
- `pfmea_change_history`
- `pcp_change_history`

## Efekt na UI
- Na `Projects` widac teraz:
  - `OPEN`
  - `DRAFT`
  - `OBSOLETE`
- Popup rewizji ma przykladowe komentarze dla `PFD / PFMEA / PCP`
- `Avg RPN` pokazuje rozne zakresy ryzyka
- filtry `Site` i `Department` maja juz sensowne, rozne wartosci

## Technicznie
- seed zostal zapisany jako powtarzalny skrypt:
  [watlow-demo-data.mjs](</c:/Users/zieada/pfmea-app/scripts/seed/watlow-demo-data.mjs>)

## Walidacja
- live verification wykonana po seedzie
- `npm run lint`
- `node --check scripts/seed/watlow-demo-data.mjs`

Wszystko przeszlo.
