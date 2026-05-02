# Supabase deployment checklist

Ten dokument opisuje bezpieczny przeplyw pracy dla zmian Supabase w RiskFlow 360.

## Zasada kanoniczna

Nowe migracje dodawaj do:

`supabase/migrations/`

Katalog `db/` traktuj jako archiwum/manual SQL, dopoki starsze pliki nie zostana sklasyfikowane przez schema dump/diff.

## Przed migracja

1. Potwierdz projekt Supabase i srodowisko.
   - Sprawdz project ref.
   - Sprawdz, czy pracujesz na staging, a nie przypadkowo na produkcji.
2. Zrob backup lub snapshot bazy.
   - Preferowane: Supabase Dashboard backup/snapshot.
   - Alternatywa CLI, gdy Docker Desktop dziala:
     ```powershell
     npx supabase db dump --linked --schema public --file PFMEA/supabase-live-public-schema-dump-YYYY-MM-DD.sql
     ```
   - Alternatywa bez Dockera: lokalny `pg_dump` z PostgreSQL client tools.
   - Jezeli CLI zwroci blad Docker daemon / missing `pg_dump`, nie traktuj pustego pliku dump jako backupu.
3. Sprawdz lokalny stan repo:
   - `git status --short`
4. Uruchom lokalne walidacje:
   - `npm run regression:shared`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
5. Sprawdz liste migracji:
   - `Get-ChildItem supabase/migrations -Filter *.sql | Sort-Object Name`
6. Przeczytaj kazda nowa migracje przed uruchomieniem.
   - Szukaj `drop`, `delete`, `truncate`, `alter table ... drop column`, `revoke`, `grant`, zmian RLS i funkcji `security definer`.

## Kolejnosc wdrozenia

1. Staging/test project.
2. Advisor security/performance.
3. `supabase db lint --linked`.
4. Smoke test aplikacji:
   - login/logout,
   - Projects,
   - PFMEA/PFD/PCP,
   - Customer Access,
   - Organizations,
   - RPN Matrix,
   - Progress Chart.
5. Dopiero potem produkcja.

## Po migracji

1. Uruchom:
   - `supabase db lint --linked`
2. Sprawdz advisors:
   - security,
   - performance.
3. Zweryfikuj najwazniejsze tabele i polityki:
   - `organizations`,
   - `organization_members`,
   - `projects`,
   - `process_revisions`,
   - `pfmea_rows`,
   - `control_plan_rows`,
   - `customer_project_access`,
   - `access_requests`,
   - `risk_matrix_config`.
4. Zweryfikuj RPC/permissions:
   - funkcje `security definer`,
   - `EXECUTE` dla `anon`,
   - `EXECUTE` dla `authenticated`.
5. Zapisz wynik do raportu w `PFMEA/`.

## Auth hardening

Do sprawdzenia recznie w Supabase Dashboard:

- leaked password protection,
- signups policy,
- redirect URLs,
- email confirmation,
- password reset URL,
- MFA policy, jesli zostanie wlaczona.

## Seed scripts

Skrypt demo seed jest zablokowany domyslnie. Uruchamiaj go tylko swiadomie:

```powershell
$env:ALLOW_DEMO_SEED="YES"
npm run seed:watlow-demo
```

Nie uruchamiaj seedow na produkcji bez potwierdzonego celu i aktualnego backupu.

## Regula stop

Zatrzymaj wdrozenie, jezeli migracja:

- moze usunac dane,
- zmienia auth/RLS bez testow regresyjnych,
- wymaga nieprzetestowanego service role flow,
- zmienia kontrakt API/RPC uzywany przez frontend,
- nie ma jasnej sciezki rollbacku.
