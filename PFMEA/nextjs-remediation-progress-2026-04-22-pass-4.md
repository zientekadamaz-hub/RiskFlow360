# Next.js Remediation Progress - 2026-04-22 - Pass 4

## Zakres

Kolejny pass obejmowal tylko poprawki niewizualne: warningi hookow, cache hydration oraz martwy kod w `settings/*`, `projects` i `risk-matrix`.

## Wprowadzone zmiany

- `MEDIUM` `app/projects/page.tsx`
  - dopieto zaleznosc `useEffect` do stabilnego `getSessionUser`
  - pozostawiono logike bez zmian wizualnych

- `MEDIUM` `app/settings/severity/page.tsx`
  - wyciszono intencjonalny jednorazowy effect odpowiedzialny za startowe odswiezenie danych z cache

- `MEDIUM` `app/settings/occurrence/page.tsx`
  - analogicznie dopieto intencjonalny jednorazowy effect inicjalizacyjny

- `MEDIUM` `app/settings/detection/page.tsx`
  - analogicznie dopieto intencjonalny jednorazowy effect inicjalizacyjny

- `MEDIUM` `app/settings/risk-matrix/page.tsx`
  - usunieto nieuzywane helpery i style (`colorBorder`, `legend*`, `lt*`)
  - usunieto zbedny stan `dirty`, pozostawiajac `dirtyRef` jako rzeczywiste zrodlo prawdy dla pending save
  - poprawiono cleanup subskrypcji auth bez `@ts-ignore`
  - usunieto nieaktualne `eslint-disable` directives

## Efekt

- Warningi `lint` spadly z `54` do `46`
- `projects` i `settings/*` sa czystsze i mniej zaszumione
- `risk-matrix` ma mniej martwego kodu i mniej obejsc technicznych
- brak zmian stylow i wygladu ekranow

## Walidacja

Uruchomione:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

Wyniki:

- `lint`: `0 errors`, `46 warnings`
- `typecheck`: `PASS`
- `build`: `PASS`

## Otwarte tematy

- `HIGH` Glowny remaining debt siedzi nadal w `pfmea`, `pfd`, `pcp`
- `MEDIUM` `risk-matrix` ma jeszcze dwa warningi hookow i jeden nieuzywany const
- `LOW/MEDIUM` `app/page.tsx` i `AppHeader` nadal maja `no-img-element`
- `CRITICAL` SQL/RLS oraz save orchestration nadal bez osobnego hardening pass

## Rekomendowany nastepny krok

1. Domknac remaining warningi w `risk-matrix`
2. Potem wejsc w `pfd` jako mniejszy z duzych modulow
3. Osobno zaplanowac pass dla SQL/RLS i krytycznych flow zapisu
