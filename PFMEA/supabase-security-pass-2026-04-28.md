# Supabase security pass - 2026-04-28

## Zakres
- Sprawdzenie migracji hardeningowych w poprawnym repozytorium: `C:\Users\zieada\pfmea-app`.
- Weryfikacja publicznej powierzchni `anon`, RPC `security definer`, RLS dla sesji edycji oraz przeplywu zaproszen.
- Dodatkowy fix dla bezterminowych tokenow zaproszen.

## Najwazniejsze ustalenia

### 1. `control_plan_rows` nie ma juz otwartego CRUD
Priorytet: Wysoki, status: zamkniete we wczesniejszych migracjach.

Pliki:
- `db/2026-04-22_supabase_critical_auth_hardening.sql`
- `db/control_plan_rows_rls.sql`

Ocena:
- Stary bootstrap `control_plan_rows_rls.sql` nie tworzy juz szerokich polityk.
- Realne polityki sa org/project-scoped i rozdzielaja select od write.

Rekomendacja:
- Trzymac ten model jako wzorzec dla pozostalych tabel modulowych.

### 2. Sesje i historia edycji sa zawężone do projektu/organizacji
Priorytet: Wysoki, status: zamkniete we wczesniejszych migracjach.

Plik:
- `db/2026-04-22_supabase_session_history_hardening.sql`

Ocena:
- Polityki `*_all_auth` sa usuwane.
- Nowe reguly sprawdzaja czlonkostwo w organizacji, role edytora i wlasciciela blokady.
- `pfd_session_events` sa widoczne glownie dla odbiorcy lub global admina.

Ryzyko resztkowe:
- Progi przejmowania blokad sa oparte o `48 hours`; UX powinien jasno komunikowac kiedy blokada jest stara i mozna ja przejac.

### 3. Publiczne RPC sa ograniczone do intencjonalnych wejsc
Priorytet: Sredni, status: akceptowalne z poprawka dla tokenow.

Intencjonalnie publiczne:
- `submit_access_request(...)`
- `get_invitation_preview(uuid)`
- `activate_invited_user(uuid, text)`

Ocena:
- `submit_access_request` ma walidacje dlugosci, formatu email, limit liczby zaproszen oraz throttle per email.
- `get_invitation_preview` i `activate_invited_user` wymagaja tokenu UUID, ale poprzednio nie egzekwowaly konsekwentnie `expires_at`.

Poprawka:
- Dodano migracje:
  - `db/2026-04-28_supabase_invitation_token_expiry_hardening.sql`
  - `supabase/migrations/20260428223000_invitation_token_expiry_hardening.sql`

Nowe zachowanie:
- istniejace pending zaproszenia bez `expires_at` dostaja termin `now() + 14 days`;
- nowe zaproszenia dostaja `expires_at = now() + 14 days`;
- resend/status `PENDING` rotuje token i ustawia nowe `expires_at`;
- `get_invitation_preview`, `activate_invited_user` i `accept_invitation(p_token)` odrzucaja token bez daty waznosci lub po terminie;
- granty RPC pozostaja zgodne z modelem: preview/activation dla `anon`, akceptacja i zarzadzanie dla `authenticated`.

### 4. Bezposredni insert do `organization_invitations`
Priorytet: Sredni, status: ograniczone.

Ocena:
- Wczesniejszy pass `db/2026-04-22_supabase_least_privilege_pass_2.sql` odbiera `authenticated` prawo `insert` na `organization_invitations`.
- Aplikacja tworzy zaproszenia przez RPC `create_org_invitation`, a nie przez direct insert.

Rekomendacja:
- Docelowo przeniesc rowniez aktualizacje imienia/nazwiska zaproszenia za RPC, zeby mozna bylo dalej ograniczyc direct `update`.

## Quick wins po tym pass
1. Pokazac w UI zaproszen date wygasniecia linku.
2. Dodac komunikat "link wygasl, wyslij ponownie" na `/waiting-for-invite`.
3. Ujednolicic tekst bledu dla wygasnietego tokenu miedzy loginem i waiting page.

## Rekomendacje strategiczne
1. Zamknac caly przeplyw zaproszen w RPC/API routes, a potem odebrac klientowi bezposrednie `update/delete` na `organization_invitations`.
2. Dodac regresje SQL/API dla: wygaslego tokenu, rotacji tokenu przy resend, proby aktywacji hasla po wygasnieciu.
3. Wygenerowac aktualny snapshot schematu Supabase do repo, bo czesc bazowych tabel, triggerow i polityk istnieje tylko jako stan historyczny, nie jako kompletna migracja od zera.

## Walidacja
- `npm run lint` - passed
- `npm run typecheck` - passed
- `git diff --check` - passed dla dotknietych plikow; Git pokazuje jedynie ostrzezenia CRLF/LF dla istniejacych plikow frontendu.

## Live deployment - 2026-04-28
- Projekt Supabase: `piewgtoldsnyynueztos`
- `supabase link` zakonczony powodzeniem przez `npx supabase`.
- Migracja `20260426214500` zostala oznaczona jako `applied`, poniewaz stan live DB juz odzwierciedlal jej efekt: organizacja `WATLOW` ma `seats_purchased = 10`, `invites_allowed_total = 10`, `valid_to = null`.
- Migracja `20260428223000_invitation_token_expiry_hardening.sql` zostala wykonana przez `npx supabase db query --linked -f ...`.
- Historia migracji zostala naprawiona przez `npx supabase migration repair 20260428223000 --status applied --linked`.
- `npx supabase migration list --linked` pokazal zgodnosc local/remote dla:
  - `20260426211900`
  - `20260426213000`
  - `20260426214500`
  - `20260428223000`

Uwaga:
- Dodatkowe zapytania walidacyjne po deployu zostaly czasowo zablokowane przez Supabase pooler komunikatem `ECIRCUITBREAKER: too many authentication failures`, po wczesniejszej probie `db push` z niepoprawnym DB password.
- Zalecane jest powtorzenie walidacji po odczekaniu kilku minut:
  - pending invitations without expiry = `0`
  - `get_invitation_preview`, `activate_invited_user`, `accept_invitation(p_token)` zawieraja warunki `expires_at`
  - granty RPC pozostaja zgodne z modelem `anon/authenticated/service_role`.
