# Supabase migration inventory

Data: 2026-05-02

## Cel

Celem tego etapu bylo uporzadkowanie obrazu lokalnych plikow SQL bez wykonywania zmian w live bazie. To jest inwentaryzacja i decyzja operacyjna, nie migracja danych.

## Zakres sprawdzenia

- Porownano pliki `*.sql` w `db/`.
- Porownano pliki `*.sql` w `supabase/migrations/`.
- Dla kazdego pliku policzono SHA256 i rozmiar.
- Sprawdzono, ktore pliki sa dokladnymi duplikatami po tresci.
- Nie usunieto, nie przemianowano i nie wykonano zadnego pliku SQL.

## Wynik

| Obszar | Wynik |
|---|---:|
| Pliki SQL w `db/` | 41 |
| Pliki SQL w `supabase/migrations/` | 14 |
| Migracje z dokladnym odpowiednikiem w `db/` | 14 |
| Pliki tylko w `db/` | 27 |
| Pliki tylko w `supabase/migrations/` | 0 |

## Decyzja kanoniczna

Od teraz jako kanoniczne zrodlo migracji nalezy traktowac:

`supabase/migrations/`

Katalog `db/` powinien pozostac tymczasowo jako archiwum/manual SQL, dopoki nie zostanie wykonany schema dump/diff i nie zostanie potwierdzone, ktore starsze pliki sa:

- juz zastosowane w live bazie,
- zastapione nowszymi migracjami,
- nadal wymagane do odtworzenia nowego srodowiska,
- niebezpieczne lub jednorazowe i nie powinny wejsc do kanonicznego lancucha migracji.

## Dokladne duplikaty

| Kanoniczna migracja | Odpowiednik w `db/` |
|---|---|
| `20260426211900_member_directory_champion_guard.sql` | `2026-04-26_supabase_member_directory_champion_guard.sql` |
| `20260426213000_set_watlow_license_10_seats.sql` | `2026-04-26_supabase_watlow_license_10_seats.sql` |
| `20260426214500_ensure_watlow_license_10_seats.sql` | `2026-04-26_supabase_watlow_license_insert_10_seats.sql` |
| `20260428223000_invitation_token_expiry_hardening.sql` | `2026-04-28_supabase_invitation_token_expiry_hardening.sql` |
| `20260502084500_live_security_remediation.sql` | `2026-05-02_supabase_live_security_remediation.sql` |
| `20260502085500_function_search_path_remediation.sql` | `2026-05-02_supabase_function_search_path_remediation.sql` |
| `20260502090500_unindexed_foreign_keys_remediation.sql` | `2026-05-02_supabase_unindexed_foreign_keys_remediation.sql` |
| `20260502092000_rls_initplan_remediation.sql` | `2026-05-02_supabase_rls_initplan_remediation.sql` |
| `20260502093500_multiple_permissive_policies_remediation.sql` | `2026-05-02_supabase_multiple_permissive_policies_remediation.sql` |
| `20260502094500_drop_codex_test_tmp.sql` | `2026-05-02_supabase_drop_codex_test_tmp.sql` |
| `20260502095000_function_lint_remediation.sql` | `2026-05-02_supabase_function_lint_remediation.sql` |
| `20260502100500_access_request_status_remediation.sql` | `2026-05-02_supabase_access_request_status_remediation.sql` |
| `20260502101000_access_request_unique_active_index.sql` | `2026-05-02_supabase_access_request_unique_active_index.sql` |
| `20260502101500_rpc_execute_scope_tightening.sql` | `2026-05-02_supabase_rpc_execute_scope_tightening.sql` |

## Pliki tylko w `db/`

Te pliki nie maja dokladnego odpowiednika w `supabase/migrations/`. Nie oznacza to automatycznie bledu. Oznacza to, ze nie sa jeszcze czescia uporzadkowanego, odtwarzalnego lancucha migracji.

| Plik | Rozmiar | Ocena |
|---|---:|---|
| `2026-04-22_supabase_anon_surface_reduction.sql` | 1419 | Wymaga diffu schematu i polityk |
| `2026-04-22_supabase_critical_auth_hardening.sql` | 10888 | Wymaga diffu schematu i polityk |
| `2026-04-22_supabase_dead_views_columns_cleanup.sql` | 599 | Wymaga potwierdzenia, czy jest jednorazowy |
| `2026-04-22_supabase_invites_projects_hardening.sql` | 14609 | Wymaga diffu schematu i funkcji |
| `2026-04-22_supabase_least_privilege_pass_1.sql` | 1206 | Wymaga diffu uprawnien |
| `2026-04-22_supabase_least_privilege_pass_2.sql` | 2308 | Wymaga diffu uprawnien |
| `2026-04-22_supabase_processes_legacy_cleanup.sql` | 354 | Wymaga potwierdzenia, czy jest jednorazowy |
| `2026-04-22_supabase_session_history_hardening.sql` | 21080 | Wymaga diffu schematu, indeksow i polityk |
| `2026-04-23_supabase_admin_access_requests.sql` | 2837 | Wymaga diffu z aktualnym modelem access requests |
| `2026-04-23_supabase_admin_organizations.sql` | 8638 | Wymaga diffu z aktualnym modelem organizations |
| `2026-04-23_supabase_customer_access_model.sql` | 16526 | Wymaga diffu z aktualnym modelem customer access |
| `2026-04-23_supabase_invite_only_activation.sql` | 5144 | Wymaga diffu flow auth/invitations |
| `2026-04-23_supabase_least_privilege_pass_3.sql` | 460 | Wymaga diffu uprawnien |
| `2026-04-23_supabase_process_revisions_customer_select.sql` | 988 | Wymaga diffu polityk SELECT |
| `2026-04-23_supabase_professional_invitation_flow.sql` | 4497 | Wymaga diffu flow invitations |
| `2026-04-23_supabase_projects_with_revision_security_invoker.sql` | 1354 | Wymaga diffu widokow/funkcji |
| `2026-04-23_supabase_role_model_normalization.sql` | 939 | Wymaga diffu modelu rol |
| `2026-04-23_supabase_rpc_surface_hardening_pass_1.sql` | 6192 | Wymaga diffu EXECUTE grants |
| `2026-04-23_supabase_stage1_hardening_pass_1.sql` | 5323 | Wymaga diffu security baseline |
| `2026-04-24_remove_oliwia_from_org.sql` | 385 | Jednorazowy data fix, nie powinien byc kanoniczna migracja |
| `2026-04-26_supabase_risk_matrix_system_defaults.sql` | 1583 | Wymaga sprawdzenia, czy defaulty sa w live i w seedzie |
| `control_plan_rows_rls.sql` | 2268 | Wymaga diffu polityk PCP/control plan |
| `pcp_editing.sql` | 2248 | Wymaga diffu funkcji/tabel PCP |
| `pcp_sample_size.sql` | 301 | Wymaga diffu kolumn/defaultow PCP |
| `pfd_editing.sql` | 2635 | Wymaga diffu funkcji/tabel PFD |
| `pfmea_editing.sql` | 2209 | Wymaga diffu funkcji/tabel PFMEA |
| `pfmea_row_backups.sql` | 629 | Wymaga diffu tabel backup/history |

## Ryzyka

| Ryzyko | Priorytet | Komentarz |
|---|---|---|
| Nowe srodowisko zbudowane tylko z `supabase/migrations/` moze nie miec calego starszego schematu | P0 | 27 plikow jest poza kanonicznym lancuchem |
| Nowe srodowisko zbudowane recznie z calego `db/` moze wykonac jednorazowe lub historyczne skrypty | P0 | Szczegolnie data fix `remove_oliwia_from_org` |
| Rownolegle utrzymywanie `db/` i `supabase/migrations/` powoduje dryf | P1 | Aktualnie wszystkie nowe migracje sa zdublowane |
| Brak jawnego deployment checklist zwieksza ryzyko wykonania skryptu na zlym projekcie | P1 | Dodano osobna checkliste |

## Rekomendowany plan bezpiecznego domkniecia

1. Utrzymac `supabase/migrations/` jako jedyne miejsce nowych migracji.
2. Nie dodawac nowych kopii do `db/`, chyba ze plik jest wyraznie oznaczony jako manual audit artifact.
3. Wykonac `supabase db dump --schema public` dla live oraz dla lokalnego/staging.
4. Porownac dump z suma plikow w `supabase/migrations/`.
5. Dla kazdego pliku `db/`-only nadac status:
   - `canonicalize`,
   - `already applied`,
   - `manual-only`,
   - `reject/obsolete`.
6. Dopiero po tej klasyfikacji przenosic wybrane pliki do `supabase/migrations/` z nowymi timestampami i komentarzem.
7. Po kazdej migracji uruchomic advisor security/performance, `supabase db lint --linked`, smoke auth i smoke reports.

## Wykonane dzialania w tym etapie

- Wykonano lokalne porownanie po SHA256.
- Ustalono aktualny stan duplikatow.
- Zapisano raport inwentaryzacyjny.
- Nie wykonano zmian w bazie.
- Nie wykonano destrukcyjnych zmian w plikach.

