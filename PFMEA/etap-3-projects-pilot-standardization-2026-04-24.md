# Etap 3 - Projects Pilot Standardization - 2026-04-24

## Cel
Potraktowac `Projects` jako pierwsza referencyjna implementacje standardow UI i architektury opartych na `settings/ui-preview`.

## Zastosowane standardy z `ui-preview`
- wspolny `SettingsPageShell` dla top frame
- wspolny toolbar row dla akcji strony
- wspolny panel filtrow i grup filtrow
- wspolny styl tabeli, naglowka tabeli i wrappera tabeli
- wspolny pattern `label + icon` w naglowku tabeli
- wspolny ikonowy przycisk akcji (trash)
- wspolny confirm dialog
- wspolny styl popupu i wewnetrznej rounded tabeli
- wspolny model kafli summary, w tym `RPN frame accents`

## Co zostalo wydzielone do warstwy wspoldzielonej
W `src/features/settings/invitation-shell.tsx`:
- `settingsToolbarRowStyle`
- `settingsFilterPanelStyle`
- `settingsFilterGroupStyle`
- `settingsFilterGroupHeaderStyle`
- `settingsFilterGroupLabelStyle`
- `settingsFilterClearButtonStyle`
- `settingsFilterChipStyle(...)`
- `settingsTableHeaderLabelStyle`
- `SettingsTableHeaderLabel`
- `settingsIconButtonStyle`
- `settingsIconGlyphStyle`
- `settingsModalCardStyle`
- `settingsModalTitleStyle`
- `settingsModalBodyStyle`
- `settingsModalActionsStyle`
- `settingsDangerInlineStyle`
- `settingsDangerInlineAccentStyle`
- `SettingsConfirmDialog`
- `settingsRiskSummaryTileStyle(...)`

W `src/features/projects/`:
- `types.ts`
- `utils.ts`
- `projects-service.ts`
- `icons.tsx`
- `view-styles.ts`
- `ProjectsFiltersPanel.tsx`
- `ProjectsSummaryTiles.tsx`
- `RevisionDetailsPopover.tsx`

## Co zostalo uporzadkowane na `Projects`
- top frame i summary zostaly oparte o wspolny shell
- przyciski strony przestaly opierac sie na lokalnych bazach stylu
- filtry sa renderowane przez osobny komponent i wspolny standard panelu
- tabela uzywa wspolnego wrappera, naglowkow i komorek
- naglowki tabeli uzywaja wspolnego wzorca `tekst + ikonka`
- popup rewizji jest osobnym komponentem
- confirm delete nie jest juz lokalnym overlayem inline
- summary `RPN` nie ma juz zdublowanych wariantow koloru miedzy preview i realna strona

## Co pozostalo lokalne dla `Projects`
- orkiestracja stanu strony
- create/edit/delete flow
- logika filtrow i ich zapisu do `localStorage`
- logika customer access
- mapowanie i render konkretnych kolumn tabeli
- tresci biznesowe i nazwy akcji

## Usuniete niespojnosci
- `Projects` nie korzysta juz z lokalnego confirm modala innego niz standard
- filtr panel nie jest juz osobnym, lokalnym wariantem stylu
- kolorowe kafle risk summary nie sa juz definiowane osobno w preview i osobno w `Projects`
- ikonowy przycisk trash ma ten sam standardowy fundament co preview
- naglowki tabeli i ich ikonki sa oparte o jeden pattern

## Walidacja
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run regression:org:customer-flow`

Wszystkie przeszly.

## Kolejne kroki
1. Wyciac z `Projects` pozostale feature-specific sekcje widoku do mniejszych komponentow:
   - `ProjectsTable`
   - `ProjectsCreateRow`
   - `ProjectsEditRow`
   - `ProjectsEmptyState`
2. Zmigrowac kolejna strone procesowa na te same prymitywy:
   - rekomendacja: `PFMEA` albo `PCP`
3. Dopiero po drugim ekranie zamknac standard jako stabilny i uzywac go do dalszej migracji calej aplikacji.
