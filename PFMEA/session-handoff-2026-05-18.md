# RiskFlow 360 - session handoff

Date: 2026-05-18
Repository: `C:\Users\zieada\pfmea-app`
Branch: `main`
Remote: `https://github.com/zientekadamaz-hub/RiskFlow360.git`
Last confirmed commit: `0b9ed46 Standardize PCP header and table layout`

This document is the compact starting point for a new Codex/ChatGPT session. Do not restart the original audit from scratch. Treat the repository, commits, and this handoff as the source of truth.

## Current State

- The long audit/refactor session started on 2026-04-28 and has covered UI standardization, PFMEA, PFD, PCP, reports, Supabase migration alignment, GitHub setup, and demo/test data cleanup.
- The current working tree was clean immediately before creating this handoff.
- The main development folder is `C:\Users\zieada\pfmea-app`.
- Do not use the older OneDrive path as the working repo unless explicitly requested.
- The database currently contains test/demo data. User accepted that old project/PFMEA/PCP/PFD data was not valuable.

## Last Validation

After the latest PCP standardization:

- `npm run typecheck` - green
- `npm run lint` - green
- `npm run regression:shared` - green
- `npm run build` - green

Latest pushed commit before this handoff:

- `0b9ed46 Standardize PCP header and table layout`

## Recently Completed

### PCP UI Standardization

- PCP top header now uses shared `SettingsPageShell`.
- PCP summary tiles now use shared `SettingsSummaryGrid` and `SettingsSummaryTile`.
- PCP table now uses shared table wrapper/style patterns like Projects.
- PCP table scope was changed from PFMEA-style classes to PCP-specific classes.
- Table now fills available width while keeping horizontal scroll when visible columns exceed the viewport.
- PCP logic, save flow, edit behavior, and PFMEA-to-PCP linkage were intentionally not changed in that UI pass.

Touched areas:

- `app/pcp/page.tsx`
- `src/features/pcp/pcp-table.tsx`
- `src/features/pcp/pcp-table-cells.tsx`
- `scripts/regression/pcp-table-smoke.js`
- `scripts/regression/pcp-table-cells-smoke.js`

### PCP/PFMEA Link Fix

- PCP now aligns seed selection with actual PFMEA risk color from Risk Matrix.
- Yellow rows no longer auto-enter PCP unless explicitly selected by PCP checkbox.
- Orange/red risks can still be selected according to current business logic.
- Existing PCP rows linked to no-longer-selected PFMEA rows are filtered out in the PCP view.

Key files:

- `src/features/pcp/pcp-service.ts`
- `src/features/pcp/pcp-utils.ts`
- `app/pcp/page.tsx`

### Projects / Reports RPN Consistency

- Projects list stats were fixed to map PFMEA stats by revision id.
- Projects now prefers `current_open_revision_id` over draft revision id for displayed PFMEA stats.
- Projects, RPN Matrix, and Progress Chart were aligned around the shared current/open risk logic.
- Recent issue fixed: after saving a project, Projects table no longer loses `Risks` and `Avg RPN`.

Key files:

- `src/features/projects/projects-service.ts`
- `src/features/reports/pfmea-report-query.ts`
- `src/features/reports/progress-chart/progress-chart-service.ts`

### PFMEA Status

- PFMEA is functionally stable for current/demo data.
- Manual checks passed for:
  - adding failure/effect/cause/action rows in current data,
  - preserving text edits,
  - saving revisions,
  - RPN/PCP behavior,
  - closed action residual RPN logic.
- Old/historical FMEA data may still contain inconsistent row metadata. User explicitly chose not to diagnose or repair old FMEA data right now.
- PFMEA page was heavily reduced and refactored; approximate current size: `1050` lines.

### PFD Status

- PFD has already had several extraction/refactor passes.
- Approximate current page size: `1082` lines.
- PFD remains a candidate for further cleanup, but it is not currently the active bug area.

### Supabase Status

- Supabase CLI login was completed.
- Migration drift was resolved on the test database.
- Local and remote migration state were aligned after rollout.
- `npx supabase db lint --linked --schema public --fail-on none` previously reported no schema errors.
- No further Supabase migration should be done without a separate plan.
- Full browser regression is still not fully configured because the following env values were not confirmed:
  - `REGRESSION_EMAIL`
  - `REGRESSION_PASSWORD`
  - `PFMEA_REGRESSION_PROJECT_ID`

Useful reports:

- `PFMEA/supabase-migration-drift-2026-05-17.md`
- `PFMEA/supabase-migration-rollout-2026-05-17.md`
- `PFMEA/post-change-application-audit-2026-05-17.md`
- `PFMEA/refactor-progress-and-supabase-check-2026-05-17.md`

## Current File Sizes

Approximate page line counts at handoff:

- `app/pfmea/page.tsx`: `1050`
- `app/pfd/page.tsx`: `1082`
- `app/pcp/page.tsx`: `783`
- `app/task-management/page.tsx`: `217`

## Current Open Work

### Immediate Manual Check

1. Open PCP in the running app.
2. Verify visually:
   - top frame matches Projects standard,
   - PCP table no longer has empty unused space on the right,
   - table header/cells look consistent with Projects,
   - edit mode still works.

If PCP visual check is accepted, continue with the next cleanup stage.

### Next Recommended Development Step

Continue the post-audit cleanup in this order:

1. Finish PCP cleanup only if visual/manual issues remain after the new standardization.
2. Move to Task Management / Actions:
   - verify table/header standard,
   - verify actions linked from PFMEA,
   - check open/closed/cancelled action behavior,
   - keep UI consistent with Projects/PCP.
3. Re-check Reports:
   - RPN Matrix,
   - Progress Chart,
   - Projects summary,
   - all should count the same open risks and use the same residual/open RPN logic.
4. Prepare production readiness checklist for `riskflow360.com`:
   - env variables,
   - Supabase auth settings,
   - RLS review,
   - domain and deployment target,
   - backup/restore plan,
   - browser regression setup.

## Rules To Preserve

- Do not redesign the product. Preserve current visual language.
- Use shared UI standards from `src/components/rf-ui` wherever possible.
- Do not break PFMEA row insertion, text persistence, revision save, RPN reporting, or PCP selection.
- Do not diagnose old historical FMEA data unless user explicitly asks.
- Do not run destructive database operations without explicit plan.
- Use `apply_patch` for manual edits.
- Run after meaningful changes:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run regression:shared`
  - `npm run build`
- Commit and push stable green checkpoints to `main`.

## Suggested First Message For New Session

Use this in a new chat:

```text
Kontynuujemy prace nad RiskFlow 360 w repo C:\Users\zieada\pfmea-app.
Przeczytaj PFMEA/session-handoff-2026-05-18.md i kontynuuj od aktualnego stanu.
Nie zaczynaj audytu od nowa. Najpierw sprawdź git status, ostatni commit i potem przejdź do kolejnego kroku z dokumentu.
```

## Known Caveats

- GitHub plugin/connector setup was inconsistent earlier. Terminal `git push origin main` worked recently.
- GitHub Desktop is logged into `zientekadamaz-hub`.
- Supabase data is test/demo data.
- Full browser automation is still pending env setup.
- The most recent PCP visual change is validated by automated checks, but still needs user visual confirmation in browser.
