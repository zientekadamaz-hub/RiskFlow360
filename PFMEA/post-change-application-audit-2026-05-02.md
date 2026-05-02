# Output C - Post-change application audit

Data: 2026-05-02

## Current architectural state

The application is buildable and materially more standardized than at the start of the audit cycle.

- Shared UI primitives exist in `src/components/rf-ui/*` for tokens, tables, forms, dialogs, layout, status, summary, buttons, popovers and risk matrix presentation.
- Header presentation has been split into smaller components while auth/session orchestration remains centralized in `AppHeader`.
- PFMEA business helpers have been extracted into dedicated `src/features/pfmea/*-utils.ts` modules with smoke tests.
- PCP now has first extracted helpers in `src/features/pcp/pcp-utils.ts`.
- Risk color logic is centralized in `src/lib/risk-engine.ts`, reducing mismatch between PFMEA, Projects and reports.
- Supabase remediation files and live audit artifacts are captured under `PFMEA/`, `db/` and `supabase/migrations/`.

## Remaining technical debt

1. PFMEA page remains the largest risk.
   Severity: High.  
   The page still combines UI rendering, edit-session handling, Supabase calls, draft/publish orchestration, row mutation and validation. Helpers reduce local complexity, but the save flow should eventually move into a tested service/hook boundary.

2. PFD and PCP pages remain monolithic.
   Severity: Medium.  
   PFD already has service/helper modules, but the page still owns a large amount of UI state. PCP has only the first helper extraction.

3. Supabase migration history is not canonical yet.
   Severity: High.  
   New work is stored in `supabase/migrations/`, but older SQL still exists only under `db/`. A schema dump/diff is needed before consolidation.

4. Browser/end-to-end regression is not active in CI.
   Severity: High.  
   Lightweight smoke tests are good for helpers, but auth, edit sessions, PFMEA save and report visual behavior still need a dedicated test org/project.

## Remaining inconsistencies

- Some legacy pages still import through compatibility adapters instead of the new `@/components/rf-ui` modules directly.
- Table-heavy pages still use local cell components; full convergence should happen gradually to avoid layout regressions.
- Error handling is improved through `src/lib/error-utils.ts`, but not every legacy path uses domain-specific messages yet.
- `riskflow-current-dev.out.log` is modified by the local dev server and should not be treated as application code.

## Security findings

- No new secret was written to repo.
- Earlier manually shared Supabase credentials should still be rotated after the work is accepted.
- Auth leaked password protection remains a dashboard-side Supabase setting.
- Several `SECURITY DEFINER` RPC functions are intentionally callable by app roles. This is acceptable for current architecture but should be reviewed before enterprise rollout.
- Early Access duplicate request protection is improved by DB-level constraints from prior remediation.

## Performance findings

- PFMEA save timeout was mitigated with targeted indexes and reduced row update churn.
- PFMEA save now includes timing instrumentation for the next real-world measurement.
- The post-save refresh no longer reloads the full PFMEA view when the saved snapshot is already available.
- Prepared RPC `publish_pfmea_revision_with_history` should reduce one client round-trip and make history insert transactional after deployment.
- Remaining unknown: exact split of the user-observed ~10s save until a new timing sample is captured from the browser console.

## Accessibility findings

- Header menu keyboard support and standard dialog semantics were improved.
- Remaining work: focus trap in modals, custom select keyboard paths, chart descriptions, and table navigation semantics.

## Test coverage

Current validated commands:

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run regression:shared` | PASS |
| `npm run build` | PASS |
| `npm run check` | PASS |

New/covered smoke tests include app header, error utils, PCP utils, PFMEA risk, hierarchy, operation, payload, PCP selection, publish parsing/fallback, revision, row factory, row matching, row order, save timing, values and shared risk engine.

## Production readiness summary

Status: improved, buildable, but not fully production-hardened.

The current version is safer than the pre-audit state because shared helpers and quality gates catch more regressions, and PFMEA save has concrete mitigations. The remaining blockers for stronger production readiness are not visual redesign issues; they are operational and architectural:

- canonical migration source,
- dedicated regression environment,
- staged deployment of the PFMEA publish/history RPC,
- continued decomposition of PFMEA/PFD/PCP page-level orchestration,
- stronger Supabase auth/security dashboard settings.

## Recommended next-phase work

1. Deploy `20260502193000_pfmea_publish_with_history_rpc.sql` after authenticating Supabase CLI.
2. Save PFMEA once on the same project and capture `PFMEA save timings`.
3. If save still exceeds acceptable time, move row-order metadata persist into a dedicated RPC or batch endpoint.
4. Create a regression Supabase org/project and enable browser smoke tests in CI with safe test credentials.
5. Continue incremental service extraction: PFMEA save service first, then PCP save/publish service, then PFD edit-session service.
