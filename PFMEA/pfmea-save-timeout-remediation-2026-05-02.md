# PFMEA Save Timeout Remediation

Data: 2026-05-02

## Problem

Podczas zapisu PFMEA pojawial sie blad Postgresa:

`canceling statement due to statement timeout`

Najbardziej prawdopodobna przyczyna: zapis PFMEA wykonywal zbyt wiele operacji `update` na `pfmea_rows` oraz korzystał z goracych sciezek po `revision_id`, `operation_id`, `created_at` bez kompletu indeksow dla wiekszych rewizji.

## Zmiany w aplikacji

- `persistPfmeaDraftSnapshot` aktualizuje tylko realnie zmienione wiersze (`dirtyPfmeaIds`), zamiast wysylac update dla calego snapshotu.
- `persistPfmeaRowOrder` filtruje metadane i nie wykonuje update, jezeli `created_at`, `row_no` i group ids sa juz zgodne.
- `buildPfmeaRowsWithStableOrderMetadata` zachowuje istniejace `created_at`, wiec save nie wymusza ponownego timestampowania kazdego wiersza.
- Timeout zapisu PFMEA dostaje czytelniejszy komunikat uzytkownika.

## Zmiany w Supabase

Wdrożono migracje:

- `supabase/migrations/20260502113000_pfmea_save_timeout_indexes.sql`

Zweryfikowane indeksy live:

- `idx_pfmea_rows_operation_id`
- `idx_pfmea_rows_revision_operation`
- `idx_pfmea_rows_revision_created_id`
- `idx_operations_project_active_number`

## Walidacja

- `npm run check` - PASS
- `regression:pfmea-row-order` - PASS
- Supabase linked DB query potwierdzil istnienie indeksow.

## Pozostale ryzyko

Jesli timeout wroci przy bardzo duzych rewizjach, kolejnym krokiem powinno byc przeniesienie krytycznego draft/publish flow do jednej transakcyjnej funkcji RPC zamiast sekwencji operacji klienta.
