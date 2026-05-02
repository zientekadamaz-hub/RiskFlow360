# Next.js Remediation Progress - 2026-04-22 - Pass 2

## Zakres

Ten przebieg obejmowal tylko poprawki funkcjonalne, bez zmian wygladu i stylow.

## Wprowadzone zmiany

- `HIGH` `app/settings/layout.tsx`
  Naprawiono weryfikacje dostepu do settings. Layout nie opiera sie juz na `organization_members.limit(1)`, tylko na `get_my_header`, czyli na kontekście aktywnej organizacji.
- `HIGH` `app/settings/severity/page.tsx`
  Usunieto `any`, `@ts-ignore` i fallbacki typowane prowizorycznie. Przepieto pobieranie sesji i aktywnej organizacji na wspolne helpery klienta.
- `HIGH` `app/settings/occurrence/page.tsx`
  Analogicznie usunieto niebezpieczne obejscia typowania i uporzadkowano odczyt sesji / org context bez ruszania UI.
- `HIGH` `app/settings/detection/page.tsx`
  Analogicznie usunieto `any`, poprawiono subskrypcje auth i cache hydration zgodnie z wymaganiami React 19.
- `MEDIUM` `src/components/Layout/AppHeader.tsx`
  Uporzadkowano typowanie sesji, cleanup subskrypcji auth i event listenerow. To poprawia stabilnosc bez zmiany markupu i stylu headera.
- `LOW` `app/layout.tsx`
  Zmieniono `lang` z `en` na `pl`.

## Efekt

- Settings znow korzysta z poprawnego kontekstu organizacji po rollbacku warstwy wizualnej.
- Zniknely twarde bledy lint zwiazane z `settings` i `AppHeader`.
- Zmiany nie ingerowaly w CSS, layouty ani komponenty wizualne.

## Walidacja

Uruchomione:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

Wyniki:

- `lint`: `0 errors`, `63 warnings`
- `typecheck`: `PASS`
- `build`: `PASS`

## Co nadal pozostaje otwarte

- `HIGH` Legacy warnings w `pfmea`, `pfd`, `pcp`, `projects`, `risk-matrix`, `scripts/regression`.
- `HIGH` Broken links i niespojnosci nawigacji z pierwotnego audytu nie byly jeszcze ruszane w tym passie.
- `CRITICAL` Ryzyka SQL / RLS pozostaja bez zmian.
- `HIGH` Monolityczne moduly `PFMEA/PFD/PCP` nadal wymagaja osobnego refaktoru.

## Rekomendowany nastepny krok

Kolejny pass powinien skupic sie na:

1. redukcji warningow i antywzorcow w `projects` oraz `AppHeader`,
2. naprawie broken links / martwej nawigacji bez zmiany stylow,
3. przygotowaniu osobnego hardening pass dla SQL/RLS i krytycznych flow zapisu.
