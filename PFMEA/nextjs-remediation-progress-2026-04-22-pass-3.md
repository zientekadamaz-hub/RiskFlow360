# Next.js Remediation Progress - 2026-04-22 - Pass 3

## Zakres

Ten przebieg obejmowal kolejne poprawki funkcjonalne i jakosciowe bez zmian wygladu i stylow.

## Wprowadzone zmiany

- `HIGH` `next.config.ts`
  Dodano redirecty dla niezaimplementowanych tras:
  - `/actions`
  - `/reports`
  - `/reports/progress`
  - `/task-management`

  Wszystkie prowadza teraz do `/projects`, zamiast zwracac `404`.

- `MEDIUM` `src/components/Layout/AppHeader.tsx`
  Uporzadkowano callbacki i zaleznosci hookow:
  - `clearCloseTimer`
  - `closeAll`
  - `scheduleCloseMenu`
  - `openMenuNow`

  Dzieki temu zeszly warningi dotyczace swiezo ruszanej logiki dropdownow i cleanupu.

- `MEDIUM` `app/projects/page.tsx`
  Usunieto martwy kod i warningi w obszarze projektow:
  - nieuzywany stan `orgName`
  - nieuzywana funkcja `loadOrgName`
  - nieuzywana funkcja `updateProjectStatus`
  - nieuzywany styl `iconSquareSm`
  - destrukturyzacje `products` zamienione na bezpieczny fallback bez warningow
  - `getSessionUser` przepiete na `useCallback`

## Efekt

- Linki z landing page i headera nie prowadza juz do nieistniejacych stron.
- Redukcja warningow lint z `63` do `54`.
- `AppHeader` i `projects` sa czystsze i bardziej przewidywalne utrzymaniowo.
- Brak zmian wizualnych w UI.

## Walidacja

Uruchomione:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

Wyniki:

- `lint`: `0 errors`, `54 warnings`
- `typecheck`: `PASS`
- `build`: `PASS`

## Otwarte tematy po tym passie

- `HIGH` Warningi legacy w `pfmea`, `pfd`, `pcp`, `risk-matrix`, `settings/*`, `scripts/regression`.
- `MEDIUM` Nadal pozostal warning `useEffect` w `projects` oraz trzy analogiczne warningi w stronach `severity/occurrence/detection`.
- `MEDIUM` `app/page.tsx` i `AppHeader` nadal maja warning `no-img-element`.
- `CRITICAL` SQL/RLS i save orchestration nadal bez zmian.

## Rekomendowany nastepny krok

1. Domknac remaining warnings w `projects` i `settings/*`.
2. Zrobic pass po `risk-matrix`, bo to kolejny mniejszy legacy hotspot.
3. Dopiero potem wejsc glebiej w `PFD/PFMEA/PCP`, zeby nie mieszac szybkich winow z duzym refaktorem.
