# Rating scale standardization - Severity / Occurrence / Detection - 2026-04-26

## Executive summary

Strony `Severity`, `Occurrence` i `Detection` zostały ujednolicone przez refaktor wspólnej warstwy `RatingScalePage`.

Nie wprowadzano trzech osobnych implementacji. Zmiana została wykonana na poziomie wspólnego modułu:

- `src/features/settings/rating-scale/RatingScalePage.tsx`
- `src/features/settings/rating-scale/RatingScaleTable.tsx`
- `src/features/settings/rating-scale/types.ts`
- `src/features/settings/rating-scale/utils.ts`

Efekt: wszystkie trzy strony korzystają z tego samego standardu tabeli, nagłówków, sortowania, ukrywania kolumn, statusów, akcji i edycji wiersza.

## Zmiany wykonane

### HIGH - wspólny standard zamiast lokalnych implementacji

Problem: logika widoku rating-scale była skupiona w jednym dużym komponencie, który mieszał pobieranie danych, cache, mutacje, sortowanie, układ tabeli i render wierszy.

Zmiana:

- `RatingScalePage` odpowiada teraz za dane, cache, mutacje i koordynację strony.
- `RatingScaleTable` odpowiada za render tabeli.
- `RatingScaleTableHeader` odpowiada za standard nagłówków, sortowanie, filtrowanie statusu i ukrywanie kolumn.
- `RatingScaleRow` odpowiada za tryb odczytu, edycję, save/cancel/restore defaults i status.
- Typy wspólne przeniesiono do `types.ts`.
- Helpery i stałe przeniesiono do `utils.ts`.

Status: **rozwiązane dla Severity / Occurrence / Detection**.

### HIGH - zgodność ze standardem Projects

Problem: `Projects` stał się pilotem, ale rating-scale nadal nie miał tak samo czytelnego podziału odpowiedzialności.

Zmiana:

- Tabela rating-scale używa tego samego wzorca kolumn: menu w nagłówku, sortowanie, hide/show column.
- Szerokości kolumn są liczone przez `getSettingsTableColumnWidths`.
- Akcje w tabeli korzystają ze wspólnego `SettingsTableActions`.
- Przyciski korzystają ze standardowych klas i stylów `rf-button` / `settingsCompactActionButtonStyle`.
- Status korzysta ze wspólnego `settingsInlineStatusStyle`.

Status: **rozwiązane częściowo**.

Uwaga: wizualnie standard jest spójny z aktualną warstwą settings. Docelowo można jeszcze wprowadzić jeden generyczny `SettingsDataTable`, wspólny również dla `Projects`.

### MEDIUM - TypeScript i utrzymywalność

Problem: typy i helpery były lokalnie zaszyte w komponencie strony, przez co trudniej było je testować i używać ponownie.

Zmiana:

- Dodano jawne typy:
  - `EffectiveRatingScaleRow`
  - `RatingScaleUiRow`
  - `RatingScaleCacheEntry`
  - `RatingScaleConfirmState`
  - `RatingScaleSortableColumn`
  - `RatingScaleHiddenColumnsState`
- Helpery `normalizeRows`, `splitName`, `parseExampleInputs`, `normalizeExampleInputs`, `readCache`, `writeCache` są poza komponentem.

Status: **rozwiązane**.

## Wyniki testów

Uruchomiono:

- `npm run typecheck` - PASS
- `npm run lint` - PASS
- `npm run build` - PASS
- HTTP smoke `/settings/severity` - 200
- HTTP smoke `/settings/occurrence` - 200
- HTTP smoke `/settings/detection` - 200

## Audyt po zmianach

### Architektura

Ocena: **8/10**

Wspólny moduł rating-scale ma teraz czytelny podział: strona, tabela, typy i helpery. To jest właściwy kierunek dla aplikacji, która ma wiele podobnych ekranów settings.

### UI / UX

Ocena: **8/10**

Trzy strony korzystają z tego samego wzorca tabeli, akcji, statusów i popupów potwierdzających. Nie powinno już dochodzić do rozjazdów pomiędzy `Severity`, `Occurrence` i `Detection`.

### TypeScript

Ocena: **8/10**

W obszarze `rating-scale` nie ma `any`, `TODO`, `FIXME`, `console.log` ani `dangerouslySetInnerHTML` po aktualnym przeglądzie.

### Testowalność

Ocena: **7/10**

Po wydzieleniu helperów i komponentów kod jest łatwiejszy do testowania. Nadal brakuje testów jednostkowych dla sortowania, filtrowania i mutacji override.

## Pozostałe ryzyka

- `RatingScaleTable.tsx` nadal zawiera zarówno header, jak i row component. To jest akceptowalne na tym etapie, ale docelowo można rozbić je do osobnych plików.
- Brakuje testów automatycznych dla edycji poziomów i restore defaults.
- RLS Supabase dla tabel override musi być potwierdzony w osobnym audycie bazy.
- Docelowy `SettingsDataTable` powinien połączyć wzorce `Projects` i `rating-scale`.

## Werdykt

`Severity`, `Occurrence` i `Detection` zostały przeniesione na wspólny, utrzymywalny standard. Ten etap jest zakończony na poziomie dobrego senior-level dla warstwy settings rating-scale.
