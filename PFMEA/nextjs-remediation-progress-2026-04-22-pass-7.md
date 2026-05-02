# Pass 7 - PFMEA cleanup

## Scope
- Cleaned `app/pfmea/page.tsx` without changing visuals or styles.
- Focused on dead code, unstable hooks, draft/session helpers, and reducing lint noise in the largest legacy screen.

## Implemented changes
- Removed unused PFMEA-only helpers, styles, export helpers, and dead local state that no longer influenced rendering.
- Simplified session start/close actions by removing unnecessary hook wrapping where it only created dependency drift.
- Stabilized callback dependencies for row editing, keyboard navigation, and revision fetch/update flows.
- Converted the PFMEA revision-scope fetch helper to a stable callback so publish/reorder callbacks no longer depend on a recreated function.
- Removed unused organization/export plumbing from PFMEA after confirming it was no longer rendered.
- Kept all existing UI structure intact; no CSS, layout, or visual language changes were introduced.

## Result
- `app/pfmea/page.tsx` no longer reports lint warnings.
- Global lint warnings dropped from `36` before the PFMEA pass to `10`.
- Remaining warnings are now outside PFMEA and mostly live in:
  - `app/pcp/page.tsx`
  - `app/page.tsx`
  - `src/components/Layout/AppHeader.tsx`
  - `scripts/regression/pfmea/tree-save.js`

## Validation
- `npm run lint` -> PASS (`0 errors`, `10 warnings`)
- `npm run typecheck` -> PASS
- `npm run build` -> PASS

## Next recommended step
- Move to `PCP`, which is now the largest remaining application hotspot.
