# Post-change application audit

Date: 2026-05-17

## Current completion estimate

Overall remediation status: 82-85%.

Plain-language meaning:

- The application is now stable enough for continued controlled development.
- The biggest functional risk, inconsistent PFMEA/RPN counting, has been fixed.
- The main remaining work is no longer broad feature repair. It is production hardening, test environment setup, Supabase operational checks and final UI/accessibility polish.

## What changed since the previous audit

### PFMEA metrics

Status: done.

- PFMEA no longer treats each physical table row as a separate risk.
- One risk is now one risk block: failure mode / effect / cause / current controls.
- Additional recommended actions under the same risk do not increase the risk count.
- PFMEA top summary now shows `PFMEA risks` instead of `PFMEA rows`.
- PFMEA save history now receives the same risk count definition.

Why this matters:

- The user sees the same business number in PFMEA, Projects, RPN Matrix and Progress Chart.
- Average RPN is no longer distorted by multiple action rows.

### Reports and Projects consistency

Status: done.

- `Projects List`, `RPN Matrix Report` and `Progress Chart` now use the same shared current-open-risk collector.
- The shared collector groups by `action_plan_group_id`, with fallback to PFMEA row numbering when group ids are missing.
- Closed/action rows can update current RPN for the risk block, but they do not create extra risks.

Remaining watch point:

- Very old PFMEA data without stable group ids and without reliable row numbering can still be less precise. Current and newly saved data should be consistent.

### Code hygiene

Status: improved.

- Removed unused `app/pfmea/pageBackup.tsx`.
- Removed unused `src/components/AuthGuard.tsx`.
- Removed the obsolete eslint ignore for the deleted PFMEA backup file.

Why this matters:

- Less dead code in the repo.
- Smaller audit surface.
- Lower chance that future work is done accidentally in the wrong file.

## Current architecture state

### Strong areas

- `PFMEA` is now largely componentized and covered by many smoke tests.
- `PFD` has extracted session, data, canvas, save and view-model layers.
- `PCP` has extracted service/model/table foundations.
- `Task Management` is split into page model, table controller, action controller and table components.
- `Reports` share filter components and risk calculation utilities.
- CI runs lint, typecheck, shared regression and build.

### Still-heavy files

These files remain the main technical-debt targets:

| File / area | Current risk | Practical meaning |
|---|---|---|
| `app/settings/ui-preview/page.tsx` | Low | Internal standards/demo page; not production-critical. |
| `app/pfd/page.tsx` | Medium | Still a large coordinator; changes to node/edge behavior should stay cautious. |
| `app/pfmea/page.tsx` | Medium | Much smaller than before, but still central to edit/session orchestration. |
| `app/pcp/page.tsx` | Medium | Needs final hook/table-controller extraction if PCP work continues. |
| `app/settings/invitations/page.tsx` | Medium | Auth/invite-sensitive area; should be cleaned with care. |
| `src/features/settings/CustomerAccessPanel.tsx` | Medium | Large component with important permission behavior. |

## Current validation

Latest validation after this pass:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run regression:pfmea-report-risk` passed.
- `npm run regression:shared` passed.
- `npm run build` passed.

## Remaining prioritized work

### P0 - before production

1. Rotate exposed/semi-exposed secrets
   - Plain language: any token or password that was pasted manually should be treated as no longer private.
   - Action: rotate Supabase keys/passwords where applicable and update local/hosting env.

2. Dedicated regression Supabase project
   - Plain language: browser tests should not modify the real working database.
   - Action: create separate regression org/project/user and set GitHub secrets:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `REGRESSION_EMAIL`
     - `REGRESSION_PASSWORD`
     - `PFMEA_REGRESSION_PROJECT_ID`
     - optionally `PCP_REGRESSION_PROJECT_ID`

3. Production deployment checklist
   - Plain language: before `riskflow360.com` goes live, verify env, redirects, auth URLs, backup and manual smoke flows.
   - Action: complete Supabase/hosting/domain checklist.

### P1 - high value, next engineering work

4. Live Supabase check after secure login
   - Run:
     - `npx supabase migration list --linked`
     - `npx supabase db lint --linked`
   - Do this only after secure `supabase login` or secure access token setup.

5. Browser regression suite
   - CI workflow already has browser regression wiring.
   - It is gated by missing test secrets, which is correct.
   - Once regression env exists, run it before each larger refactor.

6. PFD final pass
   - Keep business logic unchanged.
   - Extract only remaining safe controller pieces.
   - Protect PFD -> PFMEA linkage.

7. PCP final pass
   - Extract remaining table/edit orchestration when tests are ready.
   - Verify PFMEA -> PCP generated rows after action/risk changes.

### P2 - polish and hardening

8. Settings cleanup
   - Focus on `invitations`, `organizations`, `sites-departments`, `customer-access`.
   - Goal: reduce page-level state and duplicate table/header patterns.

9. Accessibility pass
   - Focus trap in modals.
   - Keyboard paths for custom selects and tables.
   - ARIA labels/description for charts.

10. Performance review
   - Do this after more real data or after a slow query appears.
   - Use measured query timings before adding indexes.

### P3 - later cleanup

11. `settings/ui-preview`
   - Keep as internal standard playground.
   - Refactor only if it starts slowing normal work.

12. React strict mode / ESLint debt
   - Enable only after remaining hook-heavy pages are smaller.

## Recommended next step

Next best step: set up the dedicated regression Supabase project and GitHub secrets.

Reason:

- The app is now stable enough that further big changes should be protected by real browser tests.
- This is safer than continuing large refactors against the active working database.

If we stay inside code instead, the next safest code step is a small PFD/PCP final pass, not another PFMEA rewrite.
