# Pass 8 - PCP cleanup

## Scope
- Cleaned `app/pcp/page.tsx` without changing visuals or styles.
- Focused on dead state, unused helpers, and stale legacy leftovers after earlier PCP refactors.

## Implemented changes
- Removed unused `useRef` import from the PCP page module.
- Removed unused surface constant `SURFACE_BORDER_STRONG`.
- Removed unused local `loading` state and its write-only updates from `loadAll`.
- Removed unused `ops` state and the redundant `setOps(...)` assignment.
- Removed unused `deleteRow` callback that was no longer reachable from the PCP UI.
- Removed unused `requiredRowCountByOperation` state and the temporary count bookkeeping that only supported the deleted callback.

## Result
- `app/pcp/page.tsx` no longer reports lint warnings.
- Global lint warnings dropped from `10` to `5`.
- Remaining warnings are now outside the main app modules:
  - `app/page.tsx` (`<img>`)
  - `src/components/Layout/AppHeader.tsx` (`<img>`)
  - `scripts/regression/pfmea/tree-save.js` (unused helpers/vars)

## Validation
- `npm run lint` -> PASS (`0 errors`, `5 warnings`)
- `npm run typecheck` -> PASS
- `npm run build` -> PASS

## Next recommended step
- Finish the remaining low-risk cleanup:
  - replace the two remaining `<img>` usages with `next/image` or a justified exception
  - clean the unused legacy helpers in `scripts/regression/pfmea/tree-save.js`
