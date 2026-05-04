# Audit status and next work order

Data: 2026-05-03

Zrodla:

- `PFMEA/final-audit-summary-2026-05-02.md`
- `PFMEA/implementation-report-2026-05-02.md`
- `PFMEA/post-change-application-audit-2026-05-02.md`
- `PFMEA/supabase-live-audit-2026-05-02.md`
- `PFMEA/further-changes-backlog-2026-05-02.md`
- `PFMEA/supabase-operational-check-2026-05-02.md`

## Status ogolny

Aplikacja jest po pierwszej duzej rundzie stabilizacji. Zrobione zostaly najwazniejsze bezpieczne poprawki: UI standard, header, error handling, helpery PFMEA/PCP, PCP service layer foundation, raporty RPN, optymalizacja zapisu PFMEA, Supabase lint/remediation i logiczny/Supabase CLI backup danych.

Nie jest to jeszcze koniec refaktoryzacji. Glowne otwarte obszary to: rotacja sekretow, srodowisko regresyjne, dalsze wydzielanie service layer dla PFD/PFMEA, hardening RPC/auth, konsolidacja migracji i pelniejsza dostepnosc UI.

## Co jest zrobione

| Obszar | Status | Uwagi |
|---|---|---|
| Build/lint/typecheck/check | DONE | Po ostatniej rundzie PFMEA service: lint PASS, typecheck PASS, build PASS, regression shared PASS. |
| Risk Matrix typecheck | DONE | Naprawiony typ timeout/query result. |
| Routing raportow | DONE | `/reports/progress` prowadzi do `/reports/progress-chart`; usunieto konflikt `/reports -> /projects`. |
| UI standard | DONE / CONTINUE | Standard jest rozbity na `src/components/rf-ui/*`; PFMEA top summary uzywa teraz standardowej szerokosci kafelkow przez `summaryMaxWidth`. Pozostaja legacy importy do stopniowego przepinania. |
| Header globalny | DONE | Prezentacja headera rozbita na mniejsze komponenty; logika auth/cache nadal centralnie w `AppHeader`. |
| Error handling foundation | DONE / CONTINUE | `src/lib/error-utils.ts` istnieje i jest uzywany w kluczowych miejscach; pozostale legacy flow do przepiecia przy refaktorach. |
| Accessibility foundation | PARTIAL | Header i standardowe dialogi poprawione; zostaje focus trap, custom select, tabele i wykresy. |
| PFMEA helper extraction | PARTIAL / ADVANCED | Duza czesc czystej logiki jest w `src/features/pfmea/*-utils.ts`; dodatkowo `pfmea-service` obsluguje author/role/project view/history, edit session startup, draft ensure, pobieranie wierszy rewizji, restore snapshot, batch update dirty rows, row order persistence, publish RPC/history wrapper, fallback history insert i cleanup draft rows po publikacji. Rozpoczeto fizyczne odchudzanie UI: top summary, save revision modal, confirm dialog, revision history modal, toolbar/column filter, table header, delete cell, wspolne popup positioning helpers, merged cell helpers, `TdRead`, `TdText`, `TdScaleSelect`, `TdClassSelect`, `TdPcpToggle`, `TdDate`, `TdSelect`, column config, column visibility hook, sticky merged cell hook, dirty draft persistence hook, pending cell values hook, transient tracking hook, pending cell update queue hook, risk matrix config hook, scale options hook, save timing logger, save draft revision resolver, post-publish orchestration helper, page style constants, PFMEA domain types oraz wspolny `editorBase` sa wydzielone z `app/pfmea/page.tsx`. |
| PFMEA save timeout mitigation | DONE / MONITOR | Dirty rows, indeksy, timing instrumentation, lżejszy refresh i RPC publish/history wdrozone. Trzeba monitorowac realne czasy. |
| PCP service layer | DONE FOUNDATION | `src/features/pcp/pcp-utils.ts` zawiera helpery, a `src/features/pcp/pcp-service.ts` zawiera bezpiecznie wydzielone operacje Supabase/danych. Strona PCP nadal trzyma UI i stan. |
| PFD service/page separation | OPEN | Nadal wymaga osobnego etapu. |
| Reports RPN consistency | DONE | RPN Matrix i Progress Chart uzywaja open revision dla projektow `OPEN` i wspolnego current-risk calculation. |
| Supabase live lint/remediation | DONE / CONTINUE | Brak schema errors; naprawione RLS/search_path/FK indexes/RLS initplan/multiple policies/Early Access duplicate/RPC grants. |
| Supabase logical backup | DONE | `PFMEA/supabase-backup-2026-05-02/` zawiera logiczny snapshot JSON z manifestem i checksumami. |
| Canonical `pg_dump` backup | DONE | Po naprawie Windows/WSL/Docker wykonano Supabase CLI dump public schema i public data z checksumami. Backupi sa lokalnie ignorowane przez git. |
| CI smoke quality gate | DONE / CONTINUE | `regression:shared` jest w check/CI; brak browser regression env. |

## Co zostaje do zrobienia

| Kolejnosc | ID | Obszar | Status | Dlaczego teraz / pozniej |
|---:|---|---|---|---|
| 1 | B-002 | Rotacja sekretow | OPEN | Tokeny/hasla byly recznie przekazywane. To jest najwyzszy priorytet bez zmian w kodzie. |
| 2 | B-024 | Kanoniczny backup `pg_dump` | DONE | Supabase CLI dump public schema/data wykonany 2026-05-03; przed kolejnymi migracjami schema-changing robic swiezy dump. |
| 3 | B-003 | Dedykowane srodowisko regresyjne | OPEN | Bez tego nie nalezy odpalac browserowych testow na aktywnej bazie. |
| 4 | B-020/B-013 | Pomiar PFMEA save timings | OPEN | Trzeba raz zapisac PFMEA i ocenic realne bottlenecki po optymalizacjach. |
| 5 | B-021 | PCP service layer | DONE FOUNDATION | Wykonano bezpieczne wydzielenie `pcp-service`; nastepny PCP krok to tylko opcjonalny hook tabeli i browser smoke. |
| 6 | PFD service layer | OPEN | Najlepszy kolejny refaktor techniczny: analogiczny do PCP, ale nadal ostroznie, bo dotyka PFD nodes/edges i revision flow. |
| 7 | B-005 | PFMEA service/UI layer | PARTIAL / ADVANCED | Wydzielono bezpieczne elementy serwisu: edit session startup, ensure draft, pobieranie wierszy rewizji, restore snapshot, batch update dirty rows, row order persistence, publish RPC/history wrapper, fallback history insert i cleanup draft rows po publikacji. Dodatkowo rozpoczęto fizyczne wydzielanie komponentow UI PFMEA. Pozostaje pelna orkiestracja save/publish oraz najwiekszy komponent: table/cell editor. |
| 8 | B-017 | RPC/server route hardening | OPEN | Wymaga decyzji architektonicznej i service role env; lepiej po regression env. |
| 9 | B-018 | Leaked password protection | OPEN | Do wlaczenia w Supabase Dashboard, jesli plan pozwala. Niski koszt, ale wymaga admin dashboard. |
| 10 | B-009 | Indeksy/report performance review | OPEN | Robic po wiekszej probce danych lub po konkretnym wolnym query. |
| 11 | B-012 | Pelny accessibility pass | PARTIAL | Wazne przed produkcja/enterprise, ale nie blokuje refaktoru service layer. |
| 12 | B-010/B-015 | ESLint debt / React strict mode | PARTIAL / BLOCKED | Wlaczyc dopiero po zmniejszeniu hook debt w PFMEA/PFD/PCP. |
| 13 | B-001 | Konsolidacja migracji | PARTIAL / BLOCKED | Backup jest juz wykonany, ale nadal potrzebny schema diff i plan rolloutu. |

## Rekomendowana najblizsza sekwencja

1. Zrotowac ujawnione sekrety Supabase i zaktualizowac lokalne/hostingowe env.
2. Przygotowac osobna organizacje/projekt regresyjny i wlaczyc browser smoke tests.
3. Przejsc do PFD service/session/publish separation, wzorujac sie na PCP service.
4. Kontynuowac PFMEA cleanup: domknac pozostala save/publish orchestration oraz loader projektu/wierszy. Plik strony jest juz glownie kontenerem stanu, efektow, loaderow i glownego renderu tabeli.
5. Przed kazda kolejna migracja schema-changing wykonac swiezy Supabase CLI dump.
6. Wlaczyc kolejne hardeningi Supabase/auth: leaked password protection, trwaly rate limit, ewentualne server routes dla wrazliwych RPC.

## Czego teraz nie robic

- Nie robic destrukcyjnych migracji bez kanonicznego backupu.
- Nie commitowac `PFMEA/supabase-backup-2026-05-02/`, bo zawiera realne dane.
- Nie wlaczac `reactStrictMode` globalnie przed zmniejszeniem legacy hook debt.
- Nie odpalac browser regression na aktywnej bazie produkcyjnej.
- Nie usuwac nowych indeksow oznaczonych jako `unused_index` bez czasu na zebranie ruchu i pomiarow.

## Najblizsza decyzja

Najbardziej praktyczny kolejny krok po wykonaniu PCP service layer:

- albo zrobic commit/push obecnego stabilnego punktu,
- albo kontynuowac technicznie z PFD service layer,
- rownolegle przygotowac regression project, zeby bezpiecznie uruchamiac browserowe testy mutujace dane.
