import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { PfmeaConfirmDialogConfig } from './pfmea-confirm-dialog'
import {
  hasFailureModeContext,
  hasPfmeaTextValue,
  isCauseContinuationEmpty,
  isEffectContinuationEmpty,
  isFailureModeContinuationEmpty,
  isRecommendedActionContinuationEmpty,
  patchHasAnyValue,
} from './pfmea-continuation-utils'
import {
  isPlaceholderRowId,
  normalizePfmeaRowNo,
  pickPfmeaGroupIds,
  type PfmeaRowHierarchy,
} from './pfmea-hierarchy-utils'
import { stripPfmeaGroupIdsFromPayload } from './pfmea-payload-utils'
import { asInt1to10, computeDerived } from './pfmea-risk-utils'
import {
  getPfmeaCauseContinuationSourceRow,
  getPfmeaRecommendedActionContinuationSourceRow,
} from './pfmea-row-context-utils'
import { makeEmptyPfmeaPayload } from './pfmea-row-factory-utils'
import {
  buildPfmeaCauseContinuationInsertPayload,
  buildPfmeaEffectContinuationInsertPayload,
  buildPfmeaFailureModeContinuationInsertPayload,
  buildPfmeaRecommendedActionContinuationInsertPayload,
} from './pfmea-row-insert-payload-utils'
import { findEquivalentPfmeaRow } from './pfmea-row-match-utils'
import {
  insertPfmeaRowAfterAnchorWithOrderMetadata,
  insertPfmeaRowAtSortIndex,
  reindexPfmeaRows,
  sortPfmeaRows,
} from './pfmea-row-order-utils'
import {
  getEmptyPfmeaTransientRowIds,
  removePfmeaHighlightKeysForRows,
  removePfmeaIdsFromList,
  removePfmeaTransientIdsFromSets,
} from './pfmea-transient-row-utils'
import type { PfmeaRow, ProjectView } from './pfmea-types'
import { normalizeClassValue, normalizePfmeaPcpValue } from './pfmea-value-utils'
import type { PfmeaRowOrderUpdate } from './pfmea-service'

type PfmeaEditState = { rowId: string; col: keyof PfmeaRow } | null
type PlaceholderMaterializeRef = MutableRefObject<Partial<Record<string, Promise<string>>>>
type PlaceholderMaterializedIdRef = MutableRefObject<Partial<Record<string, string>>>
type ComputeDerivedFromContext = (row: PfmeaRow) => { derived: Partial<PfmeaRow> }
type PersistPfmeaRowOrder = (
  revisionId: string,
  sourceRows?: PfmeaRow[],
  preparedUpdates?: PfmeaRowOrderUpdate[]
) => Promise<void>

export type UsePfmeaRowEditingControllerParams = {
  applyPendingCellValues: (row: PfmeaRow) => PfmeaRow
  clearPendingCellValuesForRow: (rowId: string, options?: { refresh?: boolean }) => void
  clearPendingCellValuesForRows: (rowIds: string[]) => void
  computeDerivedFromContext: ComputeDerivedFromContext
  draftRevisionIdOverride: string | null
  ensureDraftIfNeeded: () => Promise<string | null>
  loadAll: (forceRevisionId?: string | null) => Promise<void>
  markPfmeaDirty: (id: string) => void
  persistPfmeaRowOrder: PersistPfmeaRowOrder
  pfmeaGroupIdsSupportedRef: MutableRefObject<boolean | null>
  placeholderMaterializedIdRef: PlaceholderMaterializedIdRef
  placeholderMaterializeRef: PlaceholderMaterializeRef
  project: ProjectView | null
  readOnly: boolean
  rowHierarchyByIdRef: MutableRefObject<Map<string, PfmeaRowHierarchy>>
  rowsRef: MutableRefObject<PfmeaRow[]>
  runPendingCellUpdate: (task: Promise<void>) => Promise<void>
  setConfirmDialog: Dispatch<SetStateAction<PfmeaConfirmDialogConfig | null>>
  setDeletedPfmeaIds: Dispatch<SetStateAction<string[]>>
  setDirtyPfmeaIds: Dispatch<SetStateAction<string[]>>
  setEdit: Dispatch<SetStateAction<PfmeaEditState>>
  setErr: Dispatch<SetStateAction<string>>
  setExpandedOperationId: Dispatch<SetStateAction<string | null>>
  setHighlightedMissingCells: Dispatch<SetStateAction<string[] | null>>
  setRows: Dispatch<SetStateAction<PfmeaRow[]>>
  supabase: SupabaseClient
  tableRows: PfmeaRow[]
  transientCauseContinuationIdsRef: MutableRefObject<Set<string>>
  transientEffectContinuationIdsRef: MutableRefObject<Set<string>>
  transientFailureModeContinuationIdsRef: MutableRefObject<Set<string>>
  transientRecommendedActionContinuationIdsRef: MutableRefObject<Set<string>>
  workingRevisionId: string | null
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return String(error)
}

function setPatchValue(patch: Partial<PfmeaRow>, key: keyof PfmeaRow, value: unknown) {
  ;(patch as Partial<Record<keyof PfmeaRow, unknown>>)[key] = value
}

function transientSetsFrom(params: UsePfmeaRowEditingControllerParams) {
  return {
    causeContinuationIds: params.transientCauseContinuationIdsRef.current,
    recommendedActionContinuationIds: params.transientRecommendedActionContinuationIdsRef.current,
    failureModeContinuationIds: params.transientFailureModeContinuationIdsRef.current,
    effectContinuationIds: params.transientEffectContinuationIdsRef.current,
  }
}

export function usePfmeaRowEditingController(params: UsePfmeaRowEditingControllerParams) {
  const cleanupEmptyTransientRows = async () => {
    const idsToDelete = getEmptyPfmeaTransientRowIds(
      params.rowsRef.current,
      transientSetsFrom(params),
      params.applyPendingCellValues
    )

    if (idsToDelete.length === 0) return params.rowsRef.current

    const deleteResults = await Promise.all(idsToDelete.map((id) => params.supabase.from('pfmea_rows').delete().eq('id', id)))
    for (const result of deleteResults) {
      if (result.error) throw result.error
    }

    const idsToDeleteSet = new Set(idsToDelete)
    const nextTransientSets = removePfmeaTransientIdsFromSets(transientSetsFrom(params), idsToDeleteSet)
    params.transientCauseContinuationIdsRef.current = nextTransientSets.causeContinuationIds
    params.transientRecommendedActionContinuationIdsRef.current = nextTransientSets.recommendedActionContinuationIds
    params.transientFailureModeContinuationIdsRef.current = nextTransientSets.failureModeContinuationIds
    params.transientEffectContinuationIdsRef.current = nextTransientSets.effectContinuationIds
    params.clearPendingCellValuesForRows(idsToDelete)

    const nextRows = reindexPfmeaRows(params.rowsRef.current.filter((row) => !idsToDeleteSet.has(row.id)))
    params.rowsRef.current = nextRows
    params.setRows(nextRows)
    params.setDirtyPfmeaIds((prev) => removePfmeaIdsFromList(prev, idsToDeleteSet))
    params.setDeletedPfmeaIds((prev) => removePfmeaIdsFromList(prev, idsToDeleteSet))
    params.setHighlightedMissingCells((prev) => removePfmeaHighlightKeysForRows(prev, idsToDeleteSet))
    params.setEdit((prev) => (prev && idsToDeleteSet.has(prev.rowId) ? null : prev))

    return nextRows
  }

  function getInsertedCreatedAtForAnchor(anchorRow: PfmeaRow) {
    const opId = anchorRow.operation_id || anchorRow.operations?.id || null
    const sourceRows = params.tableRows.some((item) => item.id === anchorRow.id)
      ? params.tableRows
      : sortPfmeaRows(params.rowsRef.current)
    const visibleRows = sourceRows.filter((item) => {
      if (isPlaceholderRowId(item.id)) return false
      return (item.operation_id || item.operations?.id || null) === opId
    })

    const anchorIndex = visibleRows.findIndex((item) => item.id === anchorRow.id)
    const currentTime = new Date(anchorRow.created_at || new Date().toISOString()).getTime()
    const nextRow = anchorIndex >= 0 ? visibleRows[anchorIndex + 1] ?? null : null
    const nextTime = nextRow ? new Date(nextRow.created_at || anchorRow.created_at || new Date().toISOString()).getTime() : Number.NaN

    if (Number.isFinite(currentTime) && Number.isFinite(nextTime) && nextTime > currentTime) {
      return new Date(currentTime + Math.max(1, Math.floor((nextTime - currentTime) / 2))).toISOString()
    }
    if (Number.isFinite(currentTime)) {
      return new Date(currentTime + 1).toISOString()
    }
    return new Date().toISOString()
  }

  function commitInsertedPfmeaRow(finalRev: string, anchorRowId: string, nextRow: PfmeaRow) {
    const visibleRows = params.tableRows.some((item) => item.id === anchorRowId)
      ? params.tableRows
      : sortPfmeaRows(params.rowsRef.current)
    const { orderedRows, updates } = insertPfmeaRowAfterAnchorWithOrderMetadata(
      visibleRows,
      sortPfmeaRows(params.rowsRef.current),
      anchorRowId,
      nextRow
    )

    params.rowsRef.current = orderedRows
    params.setRows(orderedRows)
    void params.persistPfmeaRowOrder(finalRev, orderedRows, updates).catch((error: unknown) => {
      params.setErr(errorMessage(error))
    })

    return orderedRows
  }

  const resolveContinuationRowsForRevision = async (row: PfmeaRow, anchorRow: PfmeaRow, revisionId: string) => {
    const rowAlreadyCurrent = row.revision_id === revisionId && params.rowsRef.current.some((item) => item.id === row.id)
    const anchorAlreadyCurrent = anchorRow.revision_id === revisionId && params.rowsRef.current.some((item) => item.id === anchorRow.id)
    if (rowAlreadyCurrent && anchorAlreadyCurrent) return { row, anchorRow }

    await params.loadAll(revisionId)

    const mapRow = (source: PfmeaRow) => {
      if (source.revision_id === revisionId) {
        const direct = params.rowsRef.current.find((item) => item.id === source.id)
        if (direct) return direct
      }

      const inferredRowNo = normalizePfmeaRowNo(source.row_no) ?? params.rowHierarchyByIdRef.current.get(source.id)?.rowLabel ?? null
      const sourceForMapping =
        inferredRowNo && inferredRowNo !== source.row_no ? ({ ...source, row_no: inferredRowNo } as PfmeaRow) : source
      const mapped = findEquivalentPfmeaRow(params.rowsRef.current, sourceForMapping)
      if (!mapped) throw new Error('Failed to map PFMEA row into the current draft revision.')
      return mapped
    }

    return {
      anchorRow: mapRow(anchorRow),
      row: mapRow(row),
    }
  }

  const addCauseContinuationRow = async (row: PfmeaRow, anchorRow: PfmeaRow = row) => {
    if (params.readOnly || isPlaceholderRowId(row.id)) return
    params.setErr('')

    try {
      const effectiveRow = params.applyPendingCellValues(row)
      if (!hasPfmeaTextValue(effectiveRow.cause)) {
        params.setEdit({ rowId: row.id, col: 'cause' })
        return
      }

      const revId = await params.ensureDraftIfNeeded()
      const finalRev = revId ?? params.workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const { row: targetRow, anchorRow: targetAnchorRow } = await resolveContinuationRowsForRevision(row, anchorRow, finalRev)
      const targetSourceRow = getPfmeaCauseContinuationSourceRow(targetRow, params.tableRows, params.applyPendingCellValues)
      const opId = targetRow.operation_id || targetRow.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(targetAnchorRow)

      const payload = buildPfmeaCauseContinuationInsertPayload(targetRow, targetSourceRow, finalRev, insertedCreatedAt)
      const insertPayload = params.pfmeaGroupIdsSupportedRef.current === false
        ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>)
        : payload

      const insertRes = await params.supabase.from('pfmea_rows').insert([insertPayload]).select('id').single()
      if (insertRes.error) throw insertRes.error

      const newId = insertRes.data?.id
      if (!newId) throw new Error('Failed to create PFMEA row.')

      params.markPfmeaDirty(newId)
      params.transientCauseContinuationIdsRef.current.add(newId)
      params.setExpandedOperationId(opId)
      const nextRow = {
        ...targetSourceRow,
        ...payload,
        id: newId,
        revision_id: finalRev,
        created_at: insertedCreatedAt,
        __sortIndex: targetAnchorRow.__sortIndex,
      } as PfmeaRow
      commitInsertedPfmeaRow(finalRev, targetAnchorRow.id, nextRow)
      params.setEdit({ rowId: newId, col: 'cause' })
    } catch (error: unknown) {
      params.setErr(errorMessage(error))
    }
  }

  const addFailureModeContinuationRow = async (row: PfmeaRow, anchorRow: PfmeaRow = row) => {
    if (params.readOnly || isPlaceholderRowId(row.id)) return
    params.setErr('')

    try {
      const revId = await params.ensureDraftIfNeeded()
      const finalRev = revId ?? params.workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const { row: targetRow, anchorRow: targetAnchorRow } = await resolveContinuationRowsForRevision(row, anchorRow, finalRev)
      const opId = targetRow.operation_id || targetRow.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(targetAnchorRow)
      const payload = buildPfmeaFailureModeContinuationInsertPayload(targetRow, finalRev, insertedCreatedAt)
      const insertPayload = params.pfmeaGroupIdsSupportedRef.current === false
        ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>)
        : payload

      const insertRes = await params.supabase.from('pfmea_rows').insert([insertPayload]).select('id').single()
      if (insertRes.error) throw insertRes.error

      const newId = insertRes.data?.id
      if (!newId) throw new Error('Failed to create PFMEA row.')

      params.markPfmeaDirty(newId)
      params.transientFailureModeContinuationIdsRef.current.add(newId)
      params.setExpandedOperationId(opId)
      const nextRow = {
        ...targetRow,
        ...payload,
        id: newId,
        revision_id: finalRev,
        created_at: insertedCreatedAt,
        __sortIndex: targetAnchorRow.__sortIndex,
      } as PfmeaRow
      commitInsertedPfmeaRow(finalRev, targetAnchorRow.id, nextRow)
      params.setEdit({ rowId: newId, col: 'failure_mode' })
    } catch (error: unknown) {
      params.setErr(errorMessage(error))
    }
  }

  const addEffectContinuationRow = async (row: PfmeaRow, anchorRow: PfmeaRow = row) => {
    if (params.readOnly || isPlaceholderRowId(row.id)) return
    params.setErr('')

    try {
      const effectiveRow = params.applyPendingCellValues(row)
      if (!hasFailureModeContext(effectiveRow)) {
        params.setEdit({ rowId: row.id, col: 'failure_mode' })
        return
      }

      const revId = await params.ensureDraftIfNeeded()
      const finalRev = revId ?? params.workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const { row: targetRow, anchorRow: targetAnchorRow } = await resolveContinuationRowsForRevision(row, anchorRow, finalRev)
      const targetEffectiveRow = params.applyPendingCellValues(targetRow)
      const opId = targetRow.operation_id || targetRow.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(targetAnchorRow)
      const payload = buildPfmeaEffectContinuationInsertPayload(targetRow, targetEffectiveRow, finalRev, insertedCreatedAt)
      const insertPayload = params.pfmeaGroupIdsSupportedRef.current === false
        ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>)
        : payload

      const insertRes = await params.supabase.from('pfmea_rows').insert([insertPayload]).select('id').single()
      if (insertRes.error) throw insertRes.error

      const newId = insertRes.data?.id
      if (!newId) throw new Error('Failed to create PFMEA row.')

      params.markPfmeaDirty(newId)
      params.transientEffectContinuationIdsRef.current.add(newId)
      params.setExpandedOperationId(opId)
      const nextRow = {
        ...targetRow,
        ...payload,
        id: newId,
        revision_id: finalRev,
        created_at: insertedCreatedAt,
        __sortIndex: targetAnchorRow.__sortIndex,
      } as PfmeaRow
      commitInsertedPfmeaRow(finalRev, targetAnchorRow.id, nextRow)
      params.setEdit({ rowId: newId, col: 'effect' })
    } catch (error: unknown) {
      params.setErr(errorMessage(error))
    }
  }

  const addRecommendedActionContinuationRow = async (row: PfmeaRow, anchorRow: PfmeaRow = row) => {
    if (params.readOnly || isPlaceholderRowId(row.id)) return
    params.setErr('')

    try {
      const effectiveRow = params.applyPendingCellValues(row)
      if (!hasPfmeaTextValue(effectiveRow.recommended_action)) {
        params.setEdit({ rowId: row.id, col: 'recommended_action' })
        return
      }

      const revId = await params.ensureDraftIfNeeded()
      const finalRev = revId ?? params.workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const { row: targetRow, anchorRow: targetAnchorRow } = await resolveContinuationRowsForRevision(row, anchorRow, finalRev)
      const targetSourceRow = getPfmeaRecommendedActionContinuationSourceRow(targetRow, params.tableRows, params.applyPendingCellValues)
      const opId = targetRow.operation_id || targetRow.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(targetAnchorRow)
      const payload = buildPfmeaRecommendedActionContinuationInsertPayload(targetRow, targetSourceRow, finalRev, insertedCreatedAt)
      const insertPayload = params.pfmeaGroupIdsSupportedRef.current === false
        ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>)
        : payload

      const insertRes = await params.supabase.from('pfmea_rows').insert([insertPayload]).select('id').single()
      if (insertRes.error) throw insertRes.error

      const newId = insertRes.data?.id
      if (!newId) throw new Error('Failed to create PFMEA row.')

      params.markPfmeaDirty(newId)
      params.transientRecommendedActionContinuationIdsRef.current.add(newId)
      params.setExpandedOperationId(opId)
      const nextRow = {
        ...targetSourceRow,
        ...payload,
        id: newId,
        revision_id: finalRev,
        created_at: insertedCreatedAt,
        __sortIndex: targetAnchorRow.__sortIndex,
      } as PfmeaRow
      commitInsertedPfmeaRow(finalRev, targetAnchorRow.id, nextRow)
      params.setEdit({ rowId: newId, col: 'recommended_action' })
    } catch (error: unknown) {
      params.setErr(errorMessage(error))
    }
  }

  const updateCellWithDerived = async (row: PfmeaRow, patch: Partial<PfmeaRow>) => {
    if (params.readOnly) return
    params.setErr('')

    const task = (async () => {
      try {
        const guarded: Partial<PfmeaRow> = { ...patch }
        ;(['severity', 'occurrence', 'detection', 'occurrence2', 'detection2'] as (keyof PfmeaRow)[]).forEach((key) => {
          if (!(key in guarded)) return
          const value = guarded[key]
          if (value === null) return
          setPatchValue(guarded, key, asInt1to10(value))
        })
        if ('pcp' in guarded) {
          guarded.pcp = normalizePfmeaPcpValue(guarded.pcp)
        }
        if ('class' in guarded) {
          guarded.class = normalizeClassValue(guarded.class ?? null)
        }

        const isPlaceholder = isPlaceholderRowId(row.id)
        if (isPlaceholder && !patchHasAnyValue(guarded)) return

        const hadDraftBeforeEdit = !!params.project?.current_draft_revision_id
        const revId = await params.ensureDraftIfNeeded()
        const finalRev = revId ?? params.workingRevisionId
        if (!finalRev) throw new Error('No working revision found.')

        let targetRow = row
        let reloadedDraftRows = false
        if (!isPlaceholder && row.revision_id !== finalRev) {
          await params.loadAll(finalRev)
          reloadedDraftRows = true
          const inferredRowNo = normalizePfmeaRowNo(row.row_no) ?? params.rowHierarchyByIdRef.current.get(row.id)?.rowLabel ?? null
          const rowForMapping = inferredRowNo && inferredRowNo !== row.row_no ? ({ ...row, row_no: inferredRowNo } as PfmeaRow) : row
          const mappedRow = findEquivalentPfmeaRow(params.rowsRef.current, rowForMapping)
          if (!mappedRow) throw new Error('Failed to map PFMEA row into the current draft revision.')
          targetRow = mappedRow
          params.clearPendingCellValuesForRow(row.id, { refresh: true })
          params.setEdit((prev) => (prev && prev.rowId === row.id ? { ...prev, rowId: mappedRow.id } : prev))
        }

        const merged: PfmeaRow = { ...targetRow, ...guarded }
        const localPatch: Partial<PfmeaRow> = { ...guarded, ...params.computeDerivedFromContext(merged).derived }

        if (isPlaceholder) {
          const payload = {
            ...makeEmptyPfmeaPayload(row.operation_id, finalRev, pickPfmeaGroupIds(row)),
            ...localPatch,
          }
          const insertPayload = params.pfmeaGroupIdsSupportedRef.current === false
            ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>)
            : payload
          const insertRes = await params.supabase.from('pfmea_rows').insert([insertPayload]).select('id,created_at').single()
          if (insertRes.error) throw insertRes.error
          const newId = insertRes.data?.id
          if (!newId) throw new Error('Failed to create PFMEA row.')

          const createdAt = ((insertRes.data as { created_at?: string | null } | null)?.created_at ?? '').trim() || new Date().toISOString()

          params.markPfmeaDirty(newId)
          params.placeholderMaterializedIdRef.current[row.id] = newId
          params.clearPendingCellValuesForRow(row.id, { refresh: true })
          params.setRows((prev) => {
            if (prev.some((item) => item.id === newId)) return prev
            const nextRow = {
              ...row,
              ...makeEmptyPfmeaPayload(row.operation_id, finalRev, pickPfmeaGroupIds(row)),
              ...localPatch,
              id: newId,
              revision_id: finalRev,
              created_at: createdAt,
              __sortIndex: row.__sortIndex,
            } as PfmeaRow
            return insertPfmeaRowAtSortIndex(prev, nextRow, row.__sortIndex)
          })
          params.setEdit((prev) => (prev && prev.rowId === row.id ? { ...prev, rowId: newId } : prev))
        } else {
          const updatePayload = params.pfmeaGroupIdsSupportedRef.current === false
            ? stripPfmeaGroupIdsFromPayload(localPatch as Record<string, unknown>)
            : localPatch
          const res = await params.supabase.from('pfmea_rows').update(updatePayload).eq('id', targetRow.id).eq('revision_id', finalRev)
          if (res.error) throw res.error

          const nextRow = { ...targetRow, ...localPatch } as PfmeaRow
          if (params.transientCauseContinuationIdsRef.current.has(targetRow.id) && !isCauseContinuationEmpty(nextRow)) {
            params.transientCauseContinuationIdsRef.current.delete(targetRow.id)
          }
          if (
            params.transientRecommendedActionContinuationIdsRef.current.has(targetRow.id) &&
            !isRecommendedActionContinuationEmpty(nextRow)
          ) {
            params.transientRecommendedActionContinuationIdsRef.current.delete(targetRow.id)
          }
          if (params.transientFailureModeContinuationIdsRef.current.has(targetRow.id) && !isFailureModeContinuationEmpty(nextRow)) {
            params.transientFailureModeContinuationIdsRef.current.delete(targetRow.id)
          }
          if (params.transientEffectContinuationIdsRef.current.has(targetRow.id) && !isEffectContinuationEmpty(nextRow)) {
            params.transientEffectContinuationIdsRef.current.delete(targetRow.id)
          }
          params.markPfmeaDirty(targetRow.id)
          const nextRows = params.rowsRef.current.map((item) => (item.id === targetRow.id ? ({ ...item, ...localPatch } as PfmeaRow) : item))
          params.rowsRef.current = nextRows
          params.setRows(nextRows)
        }

        if (reloadedDraftRows || !hadDraftBeforeEdit) await params.loadAll(finalRev)
      } catch (error: unknown) {
        params.setErr(errorMessage(error))
      }
    })()

    await params.runPendingCellUpdate(task)
  }

  const ensureRowForEditing = async (row: PfmeaRow) => {
    if (!isPlaceholderRowId(row.id)) return row.id

    const cached = params.placeholderMaterializedIdRef.current[row.id]
    if (cached) return cached

    const pending = params.placeholderMaterializeRef.current[row.id]
    if (pending) return pending

    const task = (async () => {
      const revId = await params.ensureDraftIfNeeded()
      const finalRev = revId ?? params.workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const effectiveRow = params.applyPendingCellValues(row)
      const pendingPatch: Partial<PfmeaRow> = {}
      const editableFields: (keyof PfmeaRow)[] = [
        'failure_mode',
        'effect',
        'severity',
        'characteristic',
        'class',
        'cause',
        'occurrence',
        'current_prevention',
        'current_detection',
        'detection',
        'recommended_action',
        'responsible',
        'target_date',
        'action_status',
        'occurrence2',
        'detection2',
      ]
      for (const field of editableFields) {
        setPatchValue(pendingPatch, field, effectiveRow[field])
      }
      ;(['severity', 'occurrence', 'detection', 'occurrence2', 'detection2'] as (keyof PfmeaRow)[]).forEach((field) => {
        if (!(field in pendingPatch)) return
        const value = pendingPatch[field]
        if (value === null) return
        setPatchValue(pendingPatch, field, asInt1to10(value))
      })
      if ('class' in pendingPatch) {
        pendingPatch.class = normalizeClassValue(pendingPatch.class ?? null)
      }

      const merged = { ...row, ...pendingPatch } as PfmeaRow
      const payload = {
        ...makeEmptyPfmeaPayload(row.operation_id, finalRev, pickPfmeaGroupIds(row)),
        ...pendingPatch,
        ...computeDerived(merged),
      }
      const insertPayload = params.pfmeaGroupIdsSupportedRef.current === false
        ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>)
        : payload
      const ins = await params.supabase.from('pfmea_rows').insert([insertPayload]).select('id,created_at').single()
      if (ins.error) throw ins.error
      const newId = ins.data?.id
      if (!newId) throw new Error('Failed to create PFMEA row.')

      const createdAt = ((ins.data as { created_at?: string | null } | null)?.created_at ?? '').trim() || new Date().toISOString()

      params.markPfmeaDirty(newId)
      params.clearPendingCellValuesForRow(row.id, { refresh: true })
      params.setRows((prev) => {
        if (prev.some((item) => item.id === newId)) return prev
        const nextRow = {
          ...row,
          ...payload,
          id: newId,
          revision_id: finalRev,
          created_at: createdAt,
          __sortIndex: row.__sortIndex,
        } as PfmeaRow
        return insertPfmeaRowAtSortIndex(prev, nextRow, row.__sortIndex)
      })
      params.placeholderMaterializedIdRef.current[row.id] = newId
      return newId
    })()

    params.placeholderMaterializeRef.current[row.id] = task
    try {
      return await task
    } finally {
      delete params.placeholderMaterializeRef.current[row.id]
    }
  }

  const startEditCell = async (row: PfmeaRow, col: keyof PfmeaRow) => {
    const opId = row.operation_id || row.operations?.id || null
    if (opId) params.setExpandedOperationId(opId)
    if (params.readOnly) return
    if (isPlaceholderRowId(row.id)) {
      const cachedRowId = params.placeholderMaterializedIdRef.current[row.id]
      const pendingRow = params.placeholderMaterializeRef.current[row.id]
      if (cachedRowId || pendingRow) {
        try {
          const rowId = await ensureRowForEditing(row)
          params.setEdit({ rowId, col })
        } catch (error: unknown) {
          params.setErr(errorMessage(error))
        }
        return
      }
      params.setEdit({ rowId: row.id, col })
      return
    }
    try {
      const rowId = await ensureRowForEditing(row)
      params.setEdit({ rowId, col })
    } catch (error: unknown) {
      params.setErr(errorMessage(error))
    }
  }

  const materializePlaceholderRowForAdd = async (row: PfmeaRow) => {
    if (!isPlaceholderRowId(row.id)) return params.applyPendingCellValues(row)

    const effectiveRow = params.applyPendingCellValues(row)
    const rowId = await ensureRowForEditing(row)
    const materializedRow = params.rowsRef.current.find((item) => item.id === rowId)
    if (materializedRow) return materializedRow

    return {
      ...row,
      ...effectiveRow,
      id: rowId,
      revision_id: params.draftRevisionIdOverride ?? params.workingRevisionId ?? row.revision_id,
      created_at: row.created_at || new Date().toISOString(),
    } as PfmeaRow
  }

  const deleteRow = async (id: string) => {
    if (params.readOnly) return
    params.setConfirmDialog({
      title: 'Delete PFMEA row',
      body: 'Are you sure you want to delete this PFMEA row?',
      dangerNote: 'DATA WILL BE PERMANENTLY LOST',
      onConfirm: async () => {
        params.setErr('')
        try {
          const currentRow = params.rowsRef.current.find((row) => row.id === id)
          if (!currentRow) return true

          const opId = currentRow.operation_id || currentRow.operations?.id || null
          const rowsForOperation = params.rowsRef.current.filter(
            (row) => !isPlaceholderRowId(row.id) && (row.operation_id || row.operations?.id || null) === opId
          )
          const removeRowLocally = () => {
            const idsToRemove = new Set([id])
            const nextTransientSets = removePfmeaTransientIdsFromSets(transientSetsFrom(params), idsToRemove)
            params.transientCauseContinuationIdsRef.current = nextTransientSets.causeContinuationIds
            params.transientRecommendedActionContinuationIdsRef.current = nextTransientSets.recommendedActionContinuationIds
            params.transientFailureModeContinuationIdsRef.current = nextTransientSets.failureModeContinuationIds
            params.transientEffectContinuationIdsRef.current = nextTransientSets.effectContinuationIds
            params.clearPendingCellValuesForRow(id)
            params.setRows((prev) => reindexPfmeaRows(prev.filter((row) => row.id !== id)))
            params.setDirtyPfmeaIds((prev) => removePfmeaIdsFromList(prev, idsToRemove))
            params.setDeletedPfmeaIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
            params.setHighlightedMissingCells((prev) => removePfmeaHighlightKeysForRows(prev, idsToRemove))
            params.setEdit((prev) => (prev?.rowId === id ? null : prev))
          }

          if (rowsForOperation.length === 1) {
            await params.ensureDraftIfNeeded()
            const finalRev = params.draftRevisionIdOverride ?? params.project?.current_draft_revision_id ?? params.project?.current_open_revision_id ?? null
            if (!finalRev) throw new Error('No working revision found.')

            const clearedPatch = {
              ...makeEmptyPfmeaPayload(currentRow.operation_id, finalRev, pickPfmeaGroupIds(currentRow)),
              revision_id: currentRow.revision_id || finalRev,
              operation_id: currentRow.operation_id,
            }
            const res = await params.supabase
              .from('pfmea_rows')
              .update({
                failure_mode: clearedPatch.failure_mode,
                effect: clearedPatch.effect,
                severity: clearedPatch.severity,
                characteristic: clearedPatch.characteristic,
                pcp: clearedPatch.pcp,
                class: clearedPatch.class,
                cause: clearedPatch.cause,
                occurrence: clearedPatch.occurrence,
                current_prevention: clearedPatch.current_prevention,
                current_detection: clearedPatch.current_detection,
                detection: clearedPatch.detection,
                rpn: clearedPatch.rpn,
                oxd: clearedPatch.oxd,
                recommended_action: clearedPatch.recommended_action,
                responsible: clearedPatch.responsible,
                target_date: clearedPatch.target_date,
                action_status: clearedPatch.action_status,
                occurrence2: clearedPatch.occurrence2,
                detection2: clearedPatch.detection2,
                rpn2: clearedPatch.rpn2,
                oxd2: clearedPatch.oxd2,
                rpn_current: clearedPatch.rpn_current,
                oxd_current: clearedPatch.oxd_current,
              })
              .eq('id', id)
            if (res.error) throw res.error

            params.markPfmeaDirty(id)
            params.setRows((prev) =>
              prev.map((row) =>
                row.id === id
                  ? ({
                      ...row,
                      failure_mode: '',
                      effect: '',
                      severity: null,
                      characteristic: '',
                      pcp: null,
                      class: null,
                      cause: '',
                      occurrence: null,
                      current_prevention: '',
                      current_detection: '',
                      detection: null,
                      rpn: null,
                      oxd: null,
                      recommended_action: '',
                      responsible: '',
                      target_date: null,
                      action_status: null,
                      occurrence2: null,
                      detection2: null,
                      rpn2: null,
                      oxd2: null,
                      rpn_current: null,
                      oxd_current: null,
                    } as PfmeaRow)
                  : row
              )
            )
            return true
          }

          await params.ensureDraftIfNeeded()
          const res = await params.supabase.from('pfmea_rows').delete().eq('id', id)
          if (res.error) throw res.error

          removeRowLocally()
          return true
        } catch (error: unknown) {
          params.setErr(errorMessage(error))
          return false
        }
      },
    })
  }

  return {
    addCauseContinuationRow,
    addEffectContinuationRow,
    addFailureModeContinuationRow,
    addRecommendedActionContinuationRow,
    cleanupEmptyTransientRows,
    deleteRow,
    materializePlaceholderRowForAdd,
    startEditCell,
    updateCellWithDerived,
  }
}
