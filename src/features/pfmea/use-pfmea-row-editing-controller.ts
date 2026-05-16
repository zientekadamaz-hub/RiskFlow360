import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { patchHasAnyValue } from './pfmea-continuation-utils'
import { buildPfmeaPendingEditablePatch, buildPfmeaPlaceholderInsertPayload, normalizePfmeaEditablePatch } from './pfmea-cell-edit-utils'
import { isPlaceholderRowId, normalizePfmeaRowNo, type PfmeaRowHierarchy } from './pfmea-hierarchy-utils'
import { stripPfmeaGroupIdsFromPayload } from './pfmea-payload-utils'
import { findEquivalentPfmeaRow } from './pfmea-row-match-utils'
import { insertPfmeaRowAtSortIndex } from './pfmea-row-order-utils'
import { getPfmeaTransientRowKind, isPfmeaTransientRowEmpty } from './pfmea-transient-row-utils'
import type { PfmeaRow, ProjectView } from './pfmea-types'

export type PfmeaEditCell = { rowId: string; col: keyof PfmeaRow } | null

type ClearPendingCellValuesForRow = (rowId: string, options?: { refresh?: boolean }) => void

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return String(error)
}

export type UsePfmeaRowEditingControllerParams = {
  applyPendingCellValues: (row: PfmeaRow) => PfmeaRow
  clearPendingCellValuesForRow: ClearPendingCellValuesForRow
  computeDerivedForRow: (row: PfmeaRow) => Partial<PfmeaRow>
  draftRevisionIdOverride: string | null
  ensureDraftIfNeeded: () => Promise<string | null>
  loadAll: (forceRevisionId?: string | null) => Promise<void>
  markPfmeaDirty: (id: string) => void
  pfmeaGroupIdsSupportedRef: MutableRefObject<boolean | null>
  placeholderMaterializeRef: MutableRefObject<Partial<Record<string, Promise<string>>>>
  placeholderMaterializedIdRef: MutableRefObject<Partial<Record<string, string>>>
  project: ProjectView | null
  readOnly: boolean
  rowHierarchyByIdRef: MutableRefObject<Map<string, PfmeaRowHierarchy>>
  rowsRef: MutableRefObject<PfmeaRow[]>
  runPendingCellUpdate: (task: Promise<void>) => Promise<void>
  setEdit: Dispatch<SetStateAction<PfmeaEditCell>>
  setErr: Dispatch<SetStateAction<string>>
  setExpandedOperationId: Dispatch<SetStateAction<string | null>>
  setRows: Dispatch<SetStateAction<PfmeaRow[]>>
  supabase: SupabaseClient
  transientCauseContinuationIdsRef: MutableRefObject<Set<string>>
  transientEffectContinuationIdsRef: MutableRefObject<Set<string>>
  transientFailureModeContinuationIdsRef: MutableRefObject<Set<string>>
  transientRecommendedActionContinuationIdsRef: MutableRefObject<Set<string>>
  workingRevisionId: string | null
}

export function usePfmeaRowEditingController(params: UsePfmeaRowEditingControllerParams) {
  const {
    applyPendingCellValues,
    clearPendingCellValuesForRow,
    computeDerivedForRow,
    draftRevisionIdOverride,
    ensureDraftIfNeeded,
    loadAll,
    markPfmeaDirty,
    pfmeaGroupIdsSupportedRef,
    placeholderMaterializeRef,
    placeholderMaterializedIdRef,
    project,
    readOnly,
    rowHierarchyByIdRef,
    rowsRef,
    runPendingCellUpdate,
    setEdit,
    setErr,
    setExpandedOperationId,
    setRows,
    supabase,
    transientCauseContinuationIdsRef,
    transientEffectContinuationIdsRef,
    transientFailureModeContinuationIdsRef,
    transientRecommendedActionContinuationIdsRef,
    workingRevisionId,
  } = params

  const projectCurrentDraftRevisionId = project?.current_draft_revision_id

  const clearTransientMarkerIfFilled = useCallback(
    (row: PfmeaRow) => {
      const transientSets = {
        causeContinuationIds: transientCauseContinuationIdsRef.current,
        recommendedActionContinuationIds: transientRecommendedActionContinuationIdsRef.current,
        failureModeContinuationIds: transientFailureModeContinuationIdsRef.current,
        effectContinuationIds: transientEffectContinuationIdsRef.current,
      }
      const kind = getPfmeaTransientRowKind(row.id, transientSets)
      if (!kind || isPfmeaTransientRowEmpty(row.id, row, transientSets)) return

      if (kind === 'cause') transientCauseContinuationIdsRef.current.delete(row.id)
      if (kind === 'recommendedAction') transientRecommendedActionContinuationIdsRef.current.delete(row.id)
      if (kind === 'failureMode') transientFailureModeContinuationIdsRef.current.delete(row.id)
      if (kind === 'effect') transientEffectContinuationIdsRef.current.delete(row.id)
    },
    [
      transientCauseContinuationIdsRef,
      transientEffectContinuationIdsRef,
      transientFailureModeContinuationIdsRef,
      transientRecommendedActionContinuationIdsRef,
    ]
  )

  const updateCellWithDerived = useCallback(
    async (row: PfmeaRow, patch: Partial<PfmeaRow>) => {
      if (readOnly) return
      setErr('')

      const task = (async () => {
        try {
          const guarded = normalizePfmeaEditablePatch(patch)

          const isPlaceholder = isPlaceholderRowId(row.id)
          if (isPlaceholder && !patchHasAnyValue(guarded)) return

          const hadDraftBeforeEdit = !!projectCurrentDraftRevisionId
          const revId = await ensureDraftIfNeeded()
          const finalRev = revId ?? workingRevisionId
          if (!finalRev) throw new Error('No working revision found.')

          let targetRow = row
          let reloadedDraftRows = false
          if (!isPlaceholder && row.revision_id !== finalRev) {
            await loadAll(finalRev)
            reloadedDraftRows = true
            const inferredRowNo = normalizePfmeaRowNo(row.row_no) ?? rowHierarchyByIdRef.current.get(row.id)?.rowLabel ?? null
            const rowForMapping = inferredRowNo && inferredRowNo !== row.row_no ? ({ ...row, row_no: inferredRowNo } as PfmeaRow) : row
            const mappedRow = findEquivalentPfmeaRow(rowsRef.current, rowForMapping)
            if (!mappedRow) throw new Error('Failed to map PFMEA row into the current draft revision.')
            targetRow = mappedRow
            clearPendingCellValuesForRow(row.id, { refresh: true })
            setEdit((prev) => (prev && prev.rowId === row.id ? { ...prev, rowId: mappedRow.id } : prev))
          }

          const merged: PfmeaRow = { ...targetRow, ...guarded }
          const localPatch: Partial<PfmeaRow> = { ...guarded, ...computeDerivedForRow(merged) }

          if (isPlaceholder) {
            const payload = buildPfmeaPlaceholderInsertPayload(row, finalRev, localPatch)
            const insertRes = await supabase
              .from('pfmea_rows')
              .insert([
                pfmeaGroupIdsSupportedRef.current === false
                  ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>)
                  : payload,
              ])
              .select('id,created_at')
              .single()
            if (insertRes.error) throw insertRes.error
            const newId = insertRes.data?.id
            if (!newId) throw new Error('Failed to create PFMEA row.')

            const createdAt =
              ((insertRes.data as { created_at?: string | null } | null)?.created_at ?? '').trim() || new Date().toISOString()

            markPfmeaDirty(newId)
            placeholderMaterializedIdRef.current[row.id] = newId
            clearPendingCellValuesForRow(row.id, { refresh: true })
            setRows((prev) => {
              if (prev.some((x) => x.id === newId)) return prev
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
            setEdit((prev) => (prev && prev.rowId === row.id ? { ...prev, rowId: newId } : prev))
          } else {
            const res = await supabase
              .from('pfmea_rows')
              .update(
                pfmeaGroupIdsSupportedRef.current === false
                  ? stripPfmeaGroupIdsFromPayload(localPatch as Record<string, unknown>)
                  : localPatch
              )
              .eq('id', targetRow.id)
              .eq('revision_id', finalRev)
            if (res.error) throw res.error

            const nextRow = { ...targetRow, ...localPatch } as PfmeaRow
            clearTransientMarkerIfFilled(nextRow)
            markPfmeaDirty(targetRow.id)
            const nextRows = rowsRef.current.map((x) => (x.id === targetRow.id ? ({ ...x, ...localPatch } as PfmeaRow) : x))
            rowsRef.current = nextRows
            setRows(nextRows)
          }

          if (reloadedDraftRows || !hadDraftBeforeEdit) await loadAll(finalRev)
        } catch (e: unknown) {
          setErr(errorMessage(e))
        }
      })()

      await runPendingCellUpdate(task)
    },
    [
      clearPendingCellValuesForRow,
      clearTransientMarkerIfFilled,
      computeDerivedForRow,
      ensureDraftIfNeeded,
      loadAll,
      markPfmeaDirty,
      pfmeaGroupIdsSupportedRef,
      placeholderMaterializedIdRef,
      projectCurrentDraftRevisionId,
      readOnly,
      rowHierarchyByIdRef,
      rowsRef,
      runPendingCellUpdate,
      setEdit,
      setErr,
      setRows,
      supabase,
      workingRevisionId,
    ]
  )

  const ensureRowForEditing = useCallback(
    async (row: PfmeaRow) => {
      if (!isPlaceholderRowId(row.id)) return row.id

      const cached = placeholderMaterializedIdRef.current[row.id]
      if (cached) return cached

      const pending = placeholderMaterializeRef.current[row.id]
      if (pending) return pending

      const task = (async () => {
        const revId = await ensureDraftIfNeeded()
        const finalRev = revId ?? workingRevisionId
        if (!finalRev) throw new Error('No working revision found.')

        const effectiveRow = applyPendingCellValues(row)
        const pendingPatch = buildPfmeaPendingEditablePatch(effectiveRow)
        const payload = buildPfmeaPlaceholderInsertPayload(row, finalRev, pendingPatch)
        const ins = await supabase
          .from('pfmea_rows')
          .insert([
            pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload,
          ])
          .select('id,created_at')
          .single()
        if (ins.error) throw ins.error
        const newId = ins.data?.id
        if (!newId) throw new Error('Failed to create PFMEA row.')

        const createdAt = ((ins.data as { created_at?: string | null } | null)?.created_at ?? '').trim() || new Date().toISOString()

        markPfmeaDirty(newId)
        clearPendingCellValuesForRow(row.id, { refresh: true })
        setRows((prev) => {
          if (prev.some((x) => x.id === newId)) return prev
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
        placeholderMaterializedIdRef.current[row.id] = newId
        return newId
      })()

      placeholderMaterializeRef.current[row.id] = task
      try {
        return await task
      } finally {
        delete placeholderMaterializeRef.current[row.id]
      }
    },
    [
      applyPendingCellValues,
      clearPendingCellValuesForRow,
      ensureDraftIfNeeded,
      markPfmeaDirty,
      pfmeaGroupIdsSupportedRef,
      placeholderMaterializeRef,
      placeholderMaterializedIdRef,
      setRows,
      supabase,
      workingRevisionId,
    ]
  )

  const startEditCell = useCallback(
    async (row: PfmeaRow, col: keyof PfmeaRow) => {
      const opId = row.operation_id || row.operations?.id || null
      if (opId) setExpandedOperationId(opId)
      if (readOnly) return
      if (isPlaceholderRowId(row.id)) {
        const cachedRowId = placeholderMaterializedIdRef.current[row.id]
        const pendingRow = placeholderMaterializeRef.current[row.id]
        if (cachedRowId || pendingRow) {
          try {
            const rowId = await ensureRowForEditing(row)
            setEdit({ rowId, col })
          } catch (e: unknown) {
            setErr(errorMessage(e))
          }
          return
        }
        setEdit({ rowId: row.id, col })
        return
      }
      try {
        const rowId = await ensureRowForEditing(row)
        setEdit({ rowId, col })
      } catch (e: unknown) {
        setErr(errorMessage(e))
      }
    },
    [ensureRowForEditing, placeholderMaterializeRef, placeholderMaterializedIdRef, readOnly, setEdit, setErr, setExpandedOperationId]
  )

  const materializePlaceholderRowForAdd = useCallback(
    async (row: PfmeaRow) => {
      if (!isPlaceholderRowId(row.id)) return applyPendingCellValues(row)

      const effectiveRow = applyPendingCellValues(row)
      const rowId = await ensureRowForEditing(row)
      const materializedRow = rowsRef.current.find((item) => item.id === rowId)
      if (materializedRow) return materializedRow

      return {
        ...row,
        ...effectiveRow,
        id: rowId,
        revision_id: draftRevisionIdOverride ?? workingRevisionId ?? row.revision_id,
        created_at: row.created_at || new Date().toISOString(),
      } as PfmeaRow
    },
    [applyPendingCellValues, draftRevisionIdOverride, ensureRowForEditing, rowsRef, workingRevisionId]
  )

  return {
    ensureRowForEditing,
    materializePlaceholderRowForAdd,
    startEditCell,
    updateCellWithDerived,
  }
}
