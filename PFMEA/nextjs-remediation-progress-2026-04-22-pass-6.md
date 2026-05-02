# Pass 6 - PFD cleanup

## Scope
- Removed dead state and dead helper logic from `app/pfd/page.tsx`.
- Stabilized hook dependencies in the PFD mini-PFMEA keyboard navigation flow.
- Removed one unused local style variable from `app/pfd/_lib/nodes/ProcessRefNode.tsx`.
- No visual or styling changes were introduced.

## Implemented changes
- Removed unused `organizationName` state and its loading flow from `app/pfd/page.tsx`.
- Removed unused `revisionAuthor`, `lockRemainingText`, `sessionNow`, and the related interval effect.
- Removed unused champion-role tracking from `loadUserContext` because the state was no longer consumed anywhere in PFD.
- Removed unused `forceUnlockSession` callback.
- Fixed `patchFrame` dependencies.
- Stabilized `colOrder`, `nextCell`, and `prevCell` with `useMemo` / `useCallback` so `handleCellKeyDown` no longer carries unstable dependencies.
- Removed unused `chipBg` from `app/pfd/_lib/nodes/ProcessRefNode.tsx`.

## Result
- `app/pfd/page.tsx` no longer reports lint warnings.
- `app/pfd/_lib/nodes/ProcessRefNode.tsx` no longer reports lint warnings.
- Overall lint warnings dropped from `43` to `36`.

## Validation
- `npm run lint` -> PASS (`0 errors`, `36 warnings`)
- `npm run typecheck` -> PASS
- `npm run build` -> PASS

## Remaining hotspots
- `app/pfmea/page.tsx`
- `app/pcp/page.tsx`
- `src/components/Layout/AppHeader.tsx`
- `app/page.tsx`
- `scripts/regression/pfmea/tree-save.js`
