import type { PfmeaRow } from './pfmea-types'
import {
  isCauseContinuationEmpty,
  isEffectContinuationEmpty,
  isFailureModeContinuationEmpty,
  isRecommendedActionContinuationEmpty,
} from './pfmea-continuation-utils'

export type PfmeaTransientRowKind = 'cause' | 'recommendedAction' | 'failureMode' | 'effect'

export type PfmeaTransientRowSets = {
  causeContinuationIds: ReadonlySet<string>
  recommendedActionContinuationIds: ReadonlySet<string>
  failureModeContinuationIds: ReadonlySet<string>
  effectContinuationIds: ReadonlySet<string>
}

export function getPfmeaTransientRowKind(id: string, sets: PfmeaTransientRowSets): PfmeaTransientRowKind | null {
  if (sets.causeContinuationIds.has(id)) return 'cause'
  if (sets.recommendedActionContinuationIds.has(id)) return 'recommendedAction'
  if (sets.failureModeContinuationIds.has(id)) return 'failureMode'
  if (sets.effectContinuationIds.has(id)) return 'effect'
  return null
}

export function isPfmeaTransientRowEmpty(id: string, row: PfmeaRow, sets: PfmeaTransientRowSets) {
  const kind = getPfmeaTransientRowKind(id, sets)
  if (kind === 'cause') return isCauseContinuationEmpty(row)
  if (kind === 'recommendedAction') return isRecommendedActionContinuationEmpty(row)
  if (kind === 'failureMode') return isFailureModeContinuationEmpty(row)
  if (kind === 'effect') return isEffectContinuationEmpty(row)
  return false
}

export function getPfmeaTransientRowIds(sets: PfmeaTransientRowSets) {
  return new Set<string>([
    ...sets.causeContinuationIds,
    ...sets.recommendedActionContinuationIds,
    ...sets.failureModeContinuationIds,
    ...sets.effectContinuationIds,
  ])
}

export function getEmptyPfmeaTransientRowIds(
  rows: PfmeaRow[],
  sets: PfmeaTransientRowSets,
  applyPendingCellValues: (row: PfmeaRow) => PfmeaRow
) {
  const transientIds = getPfmeaTransientRowIds(sets)
  if (transientIds.size === 0) return []

  const rowsById = new Map(rows.map((row) => [row.id, row] as const))
  const idsToDelete: string[] = []

  for (const id of transientIds) {
    const row = rowsById.get(id)
    if (!row) continue
    if (isPfmeaTransientRowEmpty(id, applyPendingCellValues(row), sets)) idsToDelete.push(id)
  }

  return idsToDelete
}
