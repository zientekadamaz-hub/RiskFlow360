'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabaseBrowser'
import { CLASS_OPTIONS, TdClassSelect } from '@/features/pfmea/pfmea-class-select-cell'
import {
  PFMEA_COLUMNS,
  PFMEA_COLUMNS_BY_ID,
  PFMEA_COLUMN_FILTER_GROUPS,
  PFMEA_EDITABLE_FIELDS,
  type PfmeaColumnId,
} from '@/features/pfmea/pfmea-columns'
import { PfmeaConfirmDialog, type PfmeaConfirmDialogConfig } from '@/features/pfmea/pfmea-confirm-dialog'
import { TdDate } from '@/features/pfmea/pfmea-date-cell'
import { PfmeaDeleteCell } from '@/features/pfmea/pfmea-delete-cell'
import { TdPcpToggle } from '@/features/pfmea/pfmea-pcp-toggle-cell'
import { PfmeaRevisionHistoryModal } from '@/features/pfmea/pfmea-revision-history-modal'
import { TdScaleSelect } from '@/features/pfmea/pfmea-scale-select-cell'
import { PfmeaSaveRevisionModal } from '@/features/pfmea/pfmea-save-revision-modal'
import { TdSelect } from '@/features/pfmea/pfmea-status-select-cell'
import { PfmeaTableHeader } from '@/features/pfmea/pfmea-table-header'
import { TdText } from '@/features/pfmea/pfmea-text-cell'
import { PfmeaToolbar } from '@/features/pfmea/pfmea-toolbar'
import { PFMEA_TOP_SUMMARY_MAX_WIDTH, PfmeaTopSummary } from '@/features/pfmea/pfmea-top-summary'
import {
  type NewRowDraft,
  type Operation,
  type PfmeaEditorElement,
  type PfmeaRow,
  type ProjectView,
} from '@/features/pfmea/pfmea-types'
import { usePfmeaColumnVisibility } from '@/features/pfmea/use-pfmea-column-visibility'
import { usePfmeaDirtyDraftPersistence } from '@/features/pfmea/use-pfmea-dirty-draft-persistence'
import { usePfmeaEditSessionActions } from '@/features/pfmea/use-pfmea-edit-session-actions'
import { usePfmeaPendingCellUpdateQueue } from '@/features/pfmea/use-pfmea-pending-cell-update-queue'
import { usePfmeaPendingCellValues } from '@/features/pfmea/use-pfmea-pending-cell-values'
import { usePfmeaRiskMatrixConfig } from '@/features/pfmea/use-pfmea-risk-matrix-config'
import { usePfmeaRevisionController } from '@/features/pfmea/use-pfmea-revision-controller'
import { usePfmeaScaleOptions } from '@/features/pfmea/use-pfmea-scale-options'
import { usePfmeaSessionController } from '@/features/pfmea/use-pfmea-session-controller'
import { usePfmeaStickyMergedCellTop } from '@/features/pfmea/use-pfmea-sticky-merged-cell-top'
import { usePfmeaTransientTracking } from '@/features/pfmea/use-pfmea-transient-tracking'
import { SURFACE_RADIUS, SURFACE_TEXT, actionBtn } from '@/features/pfmea/pfmea-page-styles'
import {
  TdRead,
} from '@/features/pfmea/pfmea-merged-cell'
import { asInt1to10, computeDerived } from '@/features/pfmea/pfmea-risk-utils'
import { colorFill } from '@/features/pfmea/pfmea-risk-matrix-config'
import {
  hasFailureModeContext,
  hasPfmeaTextValue,
  isCauseContinuationEmpty,
  isEffectContinuationEmpty,
  isFailureModeContinuationEmpty,
  isRecommendedActionContinuationEmpty,
  patchHasAnyValue,
} from '@/features/pfmea/pfmea-continuation-utils'
import {
  buildPfmeaActionPlanValidationRow,
  getPfmeaMissingActionPlanHighlightKeys,
  getPreviousRequiredFieldForActionPlan,
  isPfmeaCellHighlighted,
} from '@/features/pfmea/pfmea-action-validation-utils'
import {
  buildPfmeaBlockMergeInfoByHierarchy,
  buildPfmeaHierarchy,
  isPlaceholderRowId,
  normalizePfmeaRowNo,
  pickPfmeaGroupIds,
  type PfmeaRowHierarchy,
} from '@/features/pfmea/pfmea-hierarchy-utils'
import {
  applyPersistedPfmeaRowOrderUpdates,
  insertPfmeaRowAfterAnchorWithOrderMetadata,
  insertPfmeaRowAtSortIndex,
  reindexPfmeaRows,
  sortPfmeaRows,
} from '@/features/pfmea/pfmea-row-order-utils'
import { getPfmeaPcpAutoReasons, isPfmeaSelectedForPcp } from '@/features/pfmea/pfmea-pcp-utils'
import {
  computePfmeaDerivedFromContext as computePfmeaDerivedFromRowContext,
  getPfmeaCauseContinuationSourceRow,
  getPfmeaFailureBlockSourceRowAtIndex,
  getPfmeaRecommendedActionContinuationSourceRow,
} from '@/features/pfmea/pfmea-row-context-utils'
import { findEquivalentPfmeaRow } from '@/features/pfmea/pfmea-row-match-utils'
import { normalizeClassValue, normalizePfmeaPcpValue } from '@/features/pfmea/pfmea-value-utils'
import { makeEmptyPfmeaPayload } from '@/features/pfmea/pfmea-row-factory-utils'
import {
  buildPfmeaCauseContinuationInsertPayload,
  buildPfmeaEffectContinuationInsertPayload,
  buildPfmeaFailureModeContinuationInsertPayload,
  buildPfmeaRecommendedActionContinuationInsertPayload,
} from '@/features/pfmea/pfmea-row-insert-payload-utils'
import { getEmptyPfmeaTransientRowIds, isPfmeaTransientRowEmpty } from '@/features/pfmea/pfmea-transient-row-utils'
import { computePfmeaAverageRpnSummary } from '@/features/pfmea/pfmea-summary-utils'
import { buildPfmeaDisplayOperations, buildPfmeaTableRows } from '@/features/pfmea/pfmea-visible-rows-utils'
import {
  buildPfmeaOperationMergeInfo,
  findPfmeaMergeOwnerRow,
  resolvePfmeaBlockEndAnchorRow,
} from '@/features/pfmea/pfmea-table-merge-utils'
import {
  buildPfmeaEditableColumnOrder,
  getNextPfmeaCellPosition,
  getPreviousPfmeaCellPosition,
} from '@/features/pfmea/pfmea-table-navigation-utils'
import { usePfmeaSaveRevision } from '@/features/pfmea/use-pfmea-save-revision'
import {
  stripPfmeaGroupIdsFromPayload,
} from '@/features/pfmea/pfmea-payload-utils'
import {
  fetchPfmeaRevisionHistory,
  persistPfmeaRowOrderMetadata,
  type PfmeaRowOrderUpdate,
  type PfmeaHistoryEntry,
} from '@/features/pfmea/pfmea-service'
import {
  SettingsBackdrop,
  SettingsBanner,
  SettingsPageShell,
  settingsCardStyle,
  settingsFrameStyle,
  settingsProcessAccent,
} from '@/components/rf-ui'

const EDIT_LOCK_HOURS = 48
const EDIT_LOCK_MS = EDIT_LOCK_HOURS * 60 * 60 * 1000
/* ===================== PFMEA PAGE ===================== */

export default function PfmeaFullPage() {
  return (
    <Suspense fallback={<PfmeaPageFallback />}>
      <PfmeaFullPageContent />
    </Suspense>
  )
}

function PfmeaFullPageContent() {
  const sp = useSearchParams()
  const projectId = sp.get('project') ?? ''
  const opFromUrl = sp.get('op') ?? ''

  const [err, setErr] = useState('')

  const [project, setProject] = useState<ProjectView | null>(null)
  const [draftRevisionIdOverride, setDraftRevisionIdOverride] = useState<string | null>(null)
  const [ops, setOps] = useState<Operation[]>([])
  const [rows, setRows] = useState<PfmeaRow[]>([])
  const {
    detectionOptions,
    loadScaleOptions,
    occurrenceOptions,
    severityOptions,
  } = usePfmeaScaleOptions(projectId)

  const [draft, setDraft] = useState<NewRowDraft>({ operation_id: '' })

  const [edit, setEdit] = useState<{ rowId: string; col: keyof PfmeaRow } | null>(null)
  const editorRef = useRef<PfmeaEditorElement | null>(null)
  const placeholderMaterializeRef = useRef<Partial<Record<string, Promise<string>>>>({})
  const placeholderMaterializedIdRef = useRef<Partial<Record<string, string>>>({})

  // Risk matrix config
  const {
    getRiskColorFor,
    getRiskColorForAverageRpn,
    loadRiskMatrix,
  } = usePfmeaRiskMatrixConfig(projectId)
  const {
    currentAuthorName,
    isChampion,
    isEditOwner,
    isLockedByOther,
    isObsolete,
    loadEditSession,
    moduleAccessState,
    readOnly,
    sessionBusy,
    sessionNow,
    setEditSession,
    setSessionBusy,
    userId,
    workingRevisionId,
    workingRevisionLabel,
  } = usePfmeaSessionController({
    draftRevisionIdOverride,
    editLockMs: EDIT_LOCK_MS,
    project,
    projectId,
    supabase,
  })

  // ===== REVISION SAVE (dirty tracking) =====
  const [dirtyPfmeaIds, setDirtyPfmeaIds] = useState<string[]>([])
  const [deletedPfmeaIds, setDeletedPfmeaIds] = useState<string[]>([])
  const [showSave, setShowSave] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [changeDesc, setChangeDesc] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<PfmeaConfirmDialogConfig | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<PfmeaHistoryEntry[]>([])
  const [expandedOperationId, setExpandedOperationId] = useState<string | null>(null)
  const [highlightedMissingCells, setHighlightedMissingCells] = useState<string[] | null>(null)
  const tableWrapRef = useRef<HTMLDivElement | null>(null)
  const tableHeadRef = useRef<HTMLTableSectionElement | null>(null)
  const {
    clearColumnGroup,
    columnFiltersOpen,
    isColumnVisible,
    setColumnFiltersOpen,
    toggleColumnVisibility,
    uncheckColumnGroup,
    visibleColumns,
  } = usePfmeaColumnVisibility(userId)
  const {
    clearDirtyDraftPersisted,
    markDirtyDraftPersisted,
    persistedDirtyDraft,
  } = usePfmeaDirtyDraftPersistence({
    hasProject: !!project,
    projectHasDraftRevision: !!project?.current_draft_revision_id,
    projectId,
  })
  const stickyMergedCellTop = usePfmeaStickyMergedCellTop(tableHeadRef, visibleColumns)
  const {
    applyPendingCellValues,
    clearAllPendingCellValues,
    clearPendingCellValue,
    clearPendingCellValuesForRow,
    clearPendingCellValuesForRows,
    refreshPendingCellRender,
    rowsRef,
    setPendingCellValue,
  } = usePfmeaPendingCellValues(rows)
  const rowHierarchyByIdRef = useRef<Map<string, PfmeaRowHierarchy>>(new Map())
  const forceRefreshExistingDraftFromOpenRef = useRef(false)
  const {
    clearPfmeaTransientTracking,
    clearRecommendedActionTransientIfFilled,
    flushPendingTransientDeletes,
    scheduleTransientRowDeletion,
    transientCauseContinuationIdsRef,
    transientEffectContinuationIdsRef,
    transientFailureModeContinuationIdsRef,
    transientRecommendedActionContinuationIdsRef,
  } = usePfmeaTransientTracking()
  const { flushPendingCellUpdates, runPendingCellUpdate } = usePfmeaPendingCellUpdateQueue()
  const pfmeaGroupIdsSupportedRef = useRef<boolean | null>(null)
  const previousEditRef = useRef<{ rowId: string; col: keyof PfmeaRow } | null>(null)

  const resetPfmeaEditRuntimeState = useCallback((options?: { clearTransient?: boolean }) => {
    setEdit(null)
    previousEditRef.current = null
    editorRef.current = null
    clearAllPendingCellValues({ refresh: false })
    placeholderMaterializeRef.current = {}
    placeholderMaterializedIdRef.current = {}
    if (options?.clearTransient !== false) {
      clearPfmeaTransientTracking()
    }
    refreshPendingCellRender()
  }, [clearAllPendingCellValues, clearPfmeaTransientTracking, refreshPendingCellRender])

  const isDirty = dirtyPfmeaIds.length > 0 || deletedPfmeaIds.length > 0 || persistedDirtyDraft

  const markPfmeaDirty = useCallback((id: string) => {
    setDirtyPfmeaIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    markDirtyDraftPersisted()
  }, [markDirtyDraftPersisted])

  useEffect(() => {
    if (!highlightedMissingCells || highlightedMissingCells.length === 0) return
    const clearHighlights = () => setHighlightedMissingCells(null)
    document.addEventListener('mousedown', clearHighlights)
    return () => document.removeEventListener('mousedown', clearHighlights)
  }, [highlightedMissingCells])

  const revisionControllerParams = useMemo(() => ({
    clearPfmeaTransientTracking,
    draft,
    draftRevisionIdOverride,
    forceRefreshExistingDraftFromOpenRef,
    isEditOwner,
    loadRiskMatrix,
    loadScaleOptions,
    opFromUrl,
    persistedDirtyDraft,
    pfmeaGroupIdsSupportedRef,
    project,
    projectId,
    rowsRef,
    setDraft,
    setDraftRevisionIdOverride,
    setErr,
    setOps,
    setProject,
    setRows,
    supabase,
    userId,
    workingRevisionId,
  }), [
    clearPfmeaTransientTracking,
    draft,
    draftRevisionIdOverride,
    isEditOwner,
    loadRiskMatrix,
    loadScaleOptions,
    opFromUrl,
    persistedDirtyDraft,
    project,
    projectId,
    rowsRef,
    userId,
    workingRevisionId,
  ])
  const {
    ensureDraftIfNeeded,
    loadAll,
    loadProjectView,
  } = usePfmeaRevisionController(revisionControllerParams)

  const {
    discardDraftAndCloseSession,
    startEditSession,
  } = usePfmeaEditSessionActions({
    clearDirtyDraftPersisted,
    draftRevisionIdOverride,
    editLockMs: EDIT_LOCK_MS,
    forceRefreshExistingDraftFromOpenRef,
    isChampion,
    isEditOwner,
    isObsolete,
    loadAll,
    loadEditSession,
    pfmeaGroupIdsSupportedRef,
    project,
    projectId,
    resetPfmeaEditRuntimeState,
    sessionNow,
    setDeletedPfmeaIds,
    setDirtyPfmeaIds,
    setDraftRevisionIdOverride,
    setErr,
    setProject,
    setSessionBusy,
    supabase,
    userId,
  })

  useEffect(() => {
    if (moduleAccessState !== 'allowed') return
    void loadAll()
  }, [loadAll, moduleAccessState])

  useEffect(() => {
    if (!opFromUrl) return
    setDraft({ operation_id: opFromUrl })
  }, [opFromUrl])

  useEffect(() => {
    setDraftRevisionIdOverride(null)
    setEditSession(null)
    setExpandedOperationId(null)
    forceRefreshExistingDraftFromOpenRef.current = false
  }, [projectId, setEditSession])

  useEffect(() => {
    if (!edit) return
    setTimeout(() => editorRef.current?.focus?.(), 0)
  }, [edit])

  useEffect(() => {
    const prev = previousEditRef.current
    previousEditRef.current = edit
    if (!prev) return
    if (edit && edit.rowId === prev.rowId) return
    const transientSets = {
      causeContinuationIds: transientCauseContinuationIdsRef.current,
      recommendedActionContinuationIds: transientRecommendedActionContinuationIdsRef.current,
      failureModeContinuationIds: transientFailureModeContinuationIdsRef.current,
      effectContinuationIds: transientEffectContinuationIdsRef.current,
    }

    const transientRow = rowsRef.current.find((row) => row.id === prev.rowId)
    if (!transientRow) return
    const effectiveTransientRow = applyPendingCellValues(transientRow)
    if (!isPfmeaTransientRowEmpty(prev.rowId, effectiveTransientRow, transientSets)) return

    transientCauseContinuationIdsRef.current.delete(prev.rowId)
    transientRecommendedActionContinuationIdsRef.current.delete(prev.rowId)
    transientFailureModeContinuationIdsRef.current.delete(prev.rowId)
    transientEffectContinuationIdsRef.current.delete(prev.rowId)
    clearPendingCellValuesForRow(prev.rowId)
    const nextRows = reindexPfmeaRows(rowsRef.current.filter((row) => row.id !== prev.rowId))
    rowsRef.current = nextRows
    setRows(nextRows)
    setDirtyPfmeaIds((current) => current.filter((id) => id !== prev.rowId))
    void scheduleTransientRowDeletion(prev.rowId).catch((error: any) => {
      console.warn('Failed to delete empty transient PFMEA row:', error?.message ?? String(error))
    })
  }, [
    edit,
    applyPendingCellValues,
    clearPendingCellValuesForRow,
    rowsRef,
    scheduleTransientRowDeletion,
    transientCauseContinuationIdsRef,
    transientEffectContinuationIdsRef,
    transientFailureModeContinuationIdsRef,
    transientRecommendedActionContinuationIdsRef,
  ])

  const cleanupEmptyTransientRows = useCallback(async () => {
    const idsToDelete = getEmptyPfmeaTransientRowIds(
      rowsRef.current,
      {
        causeContinuationIds: transientCauseContinuationIdsRef.current,
        recommendedActionContinuationIds: transientRecommendedActionContinuationIdsRef.current,
        failureModeContinuationIds: transientFailureModeContinuationIdsRef.current,
        effectContinuationIds: transientEffectContinuationIdsRef.current,
      },
      applyPendingCellValues
    )

    if (idsToDelete.length === 0) return rowsRef.current

    const deleteResults = await Promise.all(idsToDelete.map((id) => supabase.from('pfmea_rows').delete().eq('id', id)))
    for (const result of deleteResults) {
      if (result.error) throw result.error
    }

    const idsToDeleteSet = new Set(idsToDelete)
    transientCauseContinuationIdsRef.current = new Set(
      [...transientCauseContinuationIdsRef.current].filter((id) => !idsToDeleteSet.has(id))
    )
    transientRecommendedActionContinuationIdsRef.current = new Set(
      [...transientRecommendedActionContinuationIdsRef.current].filter((id) => !idsToDeleteSet.has(id))
    )
    transientFailureModeContinuationIdsRef.current = new Set(
      [...transientFailureModeContinuationIdsRef.current].filter((id) => !idsToDeleteSet.has(id))
    )
    transientEffectContinuationIdsRef.current = new Set(
      [...transientEffectContinuationIdsRef.current].filter((id) => !idsToDeleteSet.has(id))
    )
    clearPendingCellValuesForRows(idsToDelete)

    const nextRows = reindexPfmeaRows(rowsRef.current.filter((row) => !idsToDeleteSet.has(row.id)))
    rowsRef.current = nextRows
    setRows(nextRows)
    setDirtyPfmeaIds((prev) => prev.filter((id) => !idsToDeleteSet.has(id)))
    setDeletedPfmeaIds((prev) => prev.filter((id) => !idsToDeleteSet.has(id)))
    setHighlightedMissingCells((prev) => prev?.filter((key) => !idsToDelete.some((id) => key.startsWith(`${id}::`))) ?? null)
    setEdit((prev) => (prev && idsToDeleteSet.has(prev.rowId) ? null : prev))

    return nextRows
  }, [
    applyPendingCellValues,
    clearPendingCellValuesForRows,
    rowsRef,
    transientCauseContinuationIdsRef,
    transientEffectContinuationIdsRef,
    transientFailureModeContinuationIdsRef,
    transientRecommendedActionContinuationIdsRef,
  ])

  useEffect(() => {
    if (!expandedOperationId) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (target instanceof Element && target.closest('[data-pfmea-popup="true"]')) return
      if (tableWrapRef.current?.contains(target)) return
      setExpandedOperationId(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [expandedOperationId])

  async function deleteRow(id: string) {
    if (readOnly) return
    setConfirmDialog({
      title: 'Delete PFMEA row',
      body: 'Are you sure you want to delete this PFMEA row?',
      dangerNote: 'DATA WILL BE PERMANENTLY LOST',
      onConfirm: async () => {
        setErr('')
        try {
          const currentRow = rowsRef.current.find((row) => row.id === id)
          if (!currentRow) return true

          const opId = currentRow.operation_id || currentRow.operations?.id || null
          const rowsForOperation = rowsRef.current.filter(
            (row) => !isPlaceholderRowId(row.id) && (row.operation_id || row.operations?.id || null) === opId
          )
          const removeRowLocally = () => {
            transientCauseContinuationIdsRef.current.delete(id)
            transientRecommendedActionContinuationIdsRef.current.delete(id)
            transientFailureModeContinuationIdsRef.current.delete(id)
            transientEffectContinuationIdsRef.current.delete(id)
            clearPendingCellValuesForRow(id)
            setRows((prev) => reindexPfmeaRows(prev.filter((row) => row.id !== id)))
            setDirtyPfmeaIds((prev) => prev.filter((x) => x !== id))
            setDeletedPfmeaIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
            setHighlightedMissingCells((prev) => prev?.filter((key) => !key.startsWith(`${id}::`)) ?? null)
            setEdit((prev) => (prev?.rowId === id ? null : prev))
          }

          // Last row for a process step cannot be removed; clear only PFMEA content.
          if (rowsForOperation.length === 1) {
            await ensureDraftIfNeeded()
            const finalRev = draftRevisionIdOverride ?? project?.current_draft_revision_id ?? project?.current_open_revision_id ?? null
            if (!finalRev) throw new Error('No working revision found.')

            const clearedPatch = {
              ...makeEmptyPfmeaPayload(currentRow.operation_id, finalRev, pickPfmeaGroupIds(currentRow)),
              revision_id: currentRow.revision_id || finalRev,
              operation_id: currentRow.operation_id,
            }
            const res = await supabase
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

            markPfmeaDirty(id)
            setRows((prev) =>
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

          await ensureDraftIfNeeded()

          const res = await supabase.from('pfmea_rows').delete().eq('id', id)
          if (res.error) throw res.error

          removeRowLocally()
          return true
        } catch (e: any) {
          setErr(e?.message ?? String(e))
          return false
        }
      },
    })
  }

  function getInsertedCreatedAtForAnchor(anchorRow: PfmeaRow) {
    const opId = anchorRow.operation_id || anchorRow.operations?.id || null
    const sourceRows = tableRows.some((item) => item.id === anchorRow.id) ? tableRows : sortPfmeaRows(rowsRef.current)
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
    const visibleRows = tableRows.some((item) => item.id === anchorRowId) ? tableRows : sortPfmeaRows(rowsRef.current)
    const { orderedRows, updates } = insertPfmeaRowAfterAnchorWithOrderMetadata(
      visibleRows,
      sortPfmeaRows(rowsRef.current),
      anchorRowId,
      nextRow
    )

    rowsRef.current = orderedRows
    setRows(orderedRows)
    void persistPfmeaRowOrder(finalRev, orderedRows, updates).catch((error: unknown) => {
      setErr(error instanceof Error ? error.message : String(error))
    })

    return orderedRows
  }

  function getCauseContinuationSourceRow(row: PfmeaRow) {
    return getPfmeaCauseContinuationSourceRow(row, tableRows, applyPendingCellValues)
  }

  function getRecommendedActionContinuationSourceRow(row: PfmeaRow) {
    return getPfmeaRecommendedActionContinuationSourceRow(row, tableRows, applyPendingCellValues)
  }

  function computePfmeaDerivedFromContext(row: PfmeaRow) {
    return computePfmeaDerivedFromRowContext(row, tableRows, applyPendingCellValues)
  }

  function getFailureBlockSourceRowAtIndex(rowIndex: number) {
    return getPfmeaFailureBlockSourceRowAtIndex(rowIndex, tableRows, applyPendingCellValues)
  }

  const resolveContinuationRowsForRevision = useCallback(
    async (row: PfmeaRow, anchorRow: PfmeaRow, revisionId: string) => {
      const rowAlreadyCurrent = row.revision_id === revisionId && rowsRef.current.some((item) => item.id === row.id)
      const anchorAlreadyCurrent = anchorRow.revision_id === revisionId && rowsRef.current.some((item) => item.id === anchorRow.id)
      if (rowAlreadyCurrent && anchorAlreadyCurrent) return { row, anchorRow }

      await loadAll(revisionId)

      const mapRow = (source: PfmeaRow) => {
        if (source.revision_id === revisionId) {
          const direct = rowsRef.current.find((item) => item.id === source.id)
          if (direct) return direct
        }

        const inferredRowNo = normalizePfmeaRowNo(source.row_no) ?? rowHierarchyByIdRef.current.get(source.id)?.rowLabel ?? null
        const sourceForMapping =
          inferredRowNo && inferredRowNo !== source.row_no ? ({ ...source, row_no: inferredRowNo } as PfmeaRow) : source
        const mapped = findEquivalentPfmeaRow(rowsRef.current, sourceForMapping)
        if (!mapped) throw new Error('Failed to map PFMEA row into the current draft revision.')
        return mapped
      }

      return {
        anchorRow: mapRow(anchorRow),
        row: mapRow(row),
      }
    },
    [loadAll, rowsRef]
  )

  async function addCauseContinuationRow(row: PfmeaRow, anchorRow: PfmeaRow = row) {
    if (readOnly || isPlaceholderRowId(row.id)) return
    setErr('')

    try {
      const effectiveRow = applyPendingCellValues(row)
      if (!hasPfmeaTextValue(effectiveRow.cause)) {
        setEdit({ rowId: row.id, col: 'cause' })
        return
      }

      const revId = await ensureDraftIfNeeded()
      const finalRev = revId ?? workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const { row: targetRow, anchorRow: targetAnchorRow } = await resolveContinuationRowsForRevision(row, anchorRow, finalRev)
      const targetSourceRow = getCauseContinuationSourceRow(targetRow)
      const opId = targetRow.operation_id || targetRow.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(targetAnchorRow)

      const payload = buildPfmeaCauseContinuationInsertPayload(targetRow, targetSourceRow, finalRev, insertedCreatedAt)

      const insertRes = await supabase
        .from('pfmea_rows')
        .insert([pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload])
        .select('id')
        .single()
      if (insertRes.error) throw insertRes.error

      const newId = insertRes.data?.id
      if (!newId) throw new Error('Failed to create PFMEA row.')

      markPfmeaDirty(newId)
      transientCauseContinuationIdsRef.current.add(newId)
      setExpandedOperationId(opId)
      const nextRow = {
        ...targetSourceRow,
        ...payload,
        id: newId,
        revision_id: finalRev,
        created_at: insertedCreatedAt,
        __sortIndex: targetAnchorRow.__sortIndex,
      } as PfmeaRow
      commitInsertedPfmeaRow(finalRev, targetAnchorRow.id, nextRow)
      setEdit({ rowId: newId, col: 'cause' })
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }

  async function addFailureModeContinuationRow(row: PfmeaRow, anchorRow: PfmeaRow = row) {
    if (readOnly || isPlaceholderRowId(row.id)) return
    setErr('')

    try {
      const revId = await ensureDraftIfNeeded()
      const finalRev = revId ?? workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const { row: targetRow, anchorRow: targetAnchorRow } = await resolveContinuationRowsForRevision(row, anchorRow, finalRev)
      const opId = targetRow.operation_id || targetRow.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(targetAnchorRow)

      const payload = buildPfmeaFailureModeContinuationInsertPayload(targetRow, finalRev, insertedCreatedAt)

      const insertRes = await supabase
        .from('pfmea_rows')
        .insert([pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload])
        .select('id')
        .single()
      if (insertRes.error) throw insertRes.error

      const newId = insertRes.data?.id
      if (!newId) throw new Error('Failed to create PFMEA row.')

      markPfmeaDirty(newId)
      transientFailureModeContinuationIdsRef.current.add(newId)
      setExpandedOperationId(opId)
      const nextRow = {
        ...targetRow,
        ...payload,
        id: newId,
        revision_id: finalRev,
        created_at: insertedCreatedAt,
        __sortIndex: targetAnchorRow.__sortIndex,
      } as PfmeaRow
      commitInsertedPfmeaRow(finalRev, targetAnchorRow.id, nextRow)
      setEdit({ rowId: newId, col: 'failure_mode' })
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }

  async function addEffectContinuationRow(row: PfmeaRow, anchorRow: PfmeaRow = row) {
    if (readOnly || isPlaceholderRowId(row.id)) return
    setErr('')

    try {
      const effectiveRow = applyPendingCellValues(row)
      if (!hasFailureModeContext(effectiveRow)) {
        setEdit({ rowId: row.id, col: 'failure_mode' })
        return
      }

      const revId = await ensureDraftIfNeeded()
      const finalRev = revId ?? workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const { row: targetRow, anchorRow: targetAnchorRow } = await resolveContinuationRowsForRevision(row, anchorRow, finalRev)
      const targetEffectiveRow = applyPendingCellValues(targetRow)
      const opId = targetRow.operation_id || targetRow.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(targetAnchorRow)

      const payload = buildPfmeaEffectContinuationInsertPayload(targetRow, targetEffectiveRow, finalRev, insertedCreatedAt)

      const insertRes = await supabase
        .from('pfmea_rows')
        .insert([pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload])
        .select('id')
        .single()
      if (insertRes.error) throw insertRes.error

      const newId = insertRes.data?.id
      if (!newId) throw new Error('Failed to create PFMEA row.')

      markPfmeaDirty(newId)
      transientEffectContinuationIdsRef.current.add(newId)
      setExpandedOperationId(opId)
      const nextRow = {
        ...targetRow,
        ...payload,
        id: newId,
        revision_id: finalRev,
        created_at: insertedCreatedAt,
        __sortIndex: targetAnchorRow.__sortIndex,
      } as PfmeaRow
      commitInsertedPfmeaRow(finalRev, targetAnchorRow.id, nextRow)
      setEdit({ rowId: newId, col: 'effect' })
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }

  async function addRecommendedActionContinuationRow(row: PfmeaRow, anchorRow: PfmeaRow = row) {
    if (readOnly || isPlaceholderRowId(row.id)) return
    setErr('')

    try {
      const effectiveRow = applyPendingCellValues(row)
      if (!hasPfmeaTextValue(effectiveRow.recommended_action)) {
        setEdit({ rowId: row.id, col: 'recommended_action' })
        return
      }

      const revId = await ensureDraftIfNeeded()
      const finalRev = revId ?? workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const { row: targetRow, anchorRow: targetAnchorRow } = await resolveContinuationRowsForRevision(row, anchorRow, finalRev)
      const targetSourceRow = getRecommendedActionContinuationSourceRow(targetRow)
      const opId = targetRow.operation_id || targetRow.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(targetAnchorRow)

      const payload = buildPfmeaRecommendedActionContinuationInsertPayload(targetRow, targetSourceRow, finalRev, insertedCreatedAt)

      const insertRes = await supabase
        .from('pfmea_rows')
        .insert([pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload])
        .select('id')
        .single()
      if (insertRes.error) throw insertRes.error

      const newId = insertRes.data?.id
      if (!newId) throw new Error('Failed to create PFMEA row.')

      markPfmeaDirty(newId)
      transientRecommendedActionContinuationIdsRef.current.add(newId)
      setExpandedOperationId(opId)
      const nextRow = {
        ...targetSourceRow,
        ...payload,
        id: newId,
        revision_id: finalRev,
        created_at: insertedCreatedAt,
        __sortIndex: targetAnchorRow.__sortIndex,
      } as PfmeaRow
      commitInsertedPfmeaRow(finalRev, targetAnchorRow.id, nextRow)
      setEdit({ rowId: newId, col: 'recommended_action' })
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }

  async function updateCellWithDerived(row: PfmeaRow, patch: Partial<PfmeaRow>) {
    if (readOnly) return
    setErr('')

    const task = (async () => {
      try {
      const guarded: Partial<PfmeaRow> = { ...patch }
      ;(['severity', 'occurrence', 'detection', 'occurrence2', 'detection2'] as (keyof PfmeaRow)[]).forEach((k) => {
        if (!(k in guarded)) return
        const v = (guarded as any)[k]
        if (v === null) return
        const n = asInt1to10(v)
        ;(guarded as any)[k] = n
      })
      if ('pcp' in guarded) {
        guarded.pcp = normalizePfmeaPcpValue(guarded.pcp)
      }
      if ('class' in guarded) {
        guarded.class = normalizeClassValue((guarded.class as string | null | undefined) ?? null)
      }

      const isPlaceholder = isPlaceholderRowId(row.id)
      if (isPlaceholder && !patchHasAnyValue(guarded)) return

      // ensure draft exists (editing is a change)
      const hadDraftBeforeEdit = !!project?.current_draft_revision_id
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

      const merged: PfmeaRow = { ...targetRow, ...(guarded as any) }
      const localPatch: Partial<PfmeaRow> = { ...guarded, ...computePfmeaDerivedFromContext(merged).derived }

      if (isPlaceholder) {
        const payload = {
          ...makeEmptyPfmeaPayload(row.operation_id, finalRev, pickPfmeaGroupIds(row)),
          ...localPatch,
        }
        const insertRes = await supabase
          .from('pfmea_rows')
          .insert([pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload])
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
            ...makeEmptyPfmeaPayload(row.operation_id, finalRev, pickPfmeaGroupIds(row)),
            ...(localPatch as any),
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
          .update(pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(localPatch as Record<string, unknown>) : localPatch)
          .eq('id', targetRow.id)
          .eq('revision_id', finalRev)
        if (res.error) throw res.error
        if (transientCauseContinuationIdsRef.current.has(targetRow.id)) {
          const nextRow = { ...targetRow, ...(localPatch as any) } as PfmeaRow
          if (!isCauseContinuationEmpty(nextRow)) {
            transientCauseContinuationIdsRef.current.delete(targetRow.id)
          }
        }
        if (transientRecommendedActionContinuationIdsRef.current.has(targetRow.id)) {
          const nextRow = { ...targetRow, ...(localPatch as any) } as PfmeaRow
          if (!isRecommendedActionContinuationEmpty(nextRow)) {
            transientRecommendedActionContinuationIdsRef.current.delete(targetRow.id)
          }
        }
        if (transientFailureModeContinuationIdsRef.current.has(targetRow.id)) {
          const nextRow = { ...targetRow, ...(localPatch as any) } as PfmeaRow
          if (!isFailureModeContinuationEmpty(nextRow)) {
            transientFailureModeContinuationIdsRef.current.delete(targetRow.id)
          }
        }
        if (transientEffectContinuationIdsRef.current.has(targetRow.id)) {
          const nextRow = { ...targetRow, ...(localPatch as any) } as PfmeaRow
          if (!isEffectContinuationEmpty(nextRow)) {
            transientEffectContinuationIdsRef.current.delete(targetRow.id)
          }
        }
        markPfmeaDirty(targetRow.id)
        const nextRows = rowsRef.current.map((x) => (x.id === targetRow.id ? ({ ...x, ...(localPatch as any) } as PfmeaRow) : x))
        rowsRef.current = nextRows
        setRows(nextRows)
      }

      // first edit after switching OPEN -> DRAFT can remap row ids on backend
      if (reloadedDraftRows || !hadDraftBeforeEdit) await loadAll(finalRev)
      } catch (e: any) {
        setErr(e?.message ?? String(e))
      }
    })()

    await runPendingCellUpdate(task)
  }

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
        const pendingPatch: Partial<PfmeaRow> = {}
        for (const field of PFMEA_EDITABLE_FIELDS) {
          ;(pendingPatch as any)[field] = (effectiveRow as any)[field]
        }
        ;(['severity', 'occurrence', 'detection', 'occurrence2', 'detection2'] as (keyof PfmeaRow)[]).forEach((field) => {
          if (!(field in pendingPatch)) return
          const value = (pendingPatch as any)[field]
          if (value === null) return
          ;(pendingPatch as any)[field] = asInt1to10(value)
        })
        if ('class' in pendingPatch) {
          pendingPatch.class = normalizeClassValue((pendingPatch.class as string | null | undefined) ?? null)
        }

        const merged = { ...row, ...(pendingPatch as any) } as PfmeaRow
        const payload = {
          ...makeEmptyPfmeaPayload(row.operation_id, finalRev, pickPfmeaGroupIds(row)),
          ...pendingPatch,
          ...computeDerived(merged),
        }
        const ins = await supabase
          .from('pfmea_rows')
          .insert([pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload])
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
    [applyPendingCellValues, clearPendingCellValuesForRow, ensureDraftIfNeeded, workingRevisionId, markPfmeaDirty]
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
          } catch (e: any) {
            setErr(e?.message ?? String(e))
          }
          return
        }
        setEdit({ rowId: row.id, col })
        return
      }
      try {
        const rowId = await ensureRowForEditing(row)
        setEdit({ rowId, col })
      } catch (e: any) {
        setErr(e?.message ?? String(e))
      }
    },
    [readOnly, ensureRowForEditing]
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

  const loadRevisionHistory = useCallback(async () => {
    if (!projectId) {
      setHistoryEntries([])
      return
    }

    setHistoryLoading(true)
    try {
      setHistoryEntries(await fetchPfmeaRevisionHistory(supabase, projectId))
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setHistoryEntries([])
    } finally {
      setHistoryLoading(false)
    }
  }, [projectId])

  const openRevisionHistory = useCallback(async () => {
    setHistoryOpen(true)
    await loadRevisionHistory()
  }, [loadRevisionHistory])

  const rowsSorted = useMemo(() => {
    return sortPfmeaRows(rows)
  }, [rows])

  const persistPfmeaRowOrder = useCallback(
    async (
      revisionId: string,
      sourceRows?: PfmeaRow[],
      preparedUpdates?: Array<{
        id: string
        created_at: string
        row_no: string | null
        failure_mode_group_id: string | null
        failure_block_group_id: string | null
        action_plan_group_id: string | null
      }>
    ) => {
      const baseRows = sortPfmeaRows(sourceRows ?? rowsRef.current).filter(
        (row) => !isPlaceholderRowId(row.id) && (!row.revision_id || row.revision_id === revisionId)
      )
      if (baseRows.length === 0) return

      const updates = await persistPfmeaRowOrderMetadata<PfmeaRow>(supabase, {
        groupIdsSupported: pfmeaGroupIdsSupportedRef.current,
        preparedUpdates: preparedUpdates as PfmeaRowOrderUpdate[] | undefined,
        revisionId,
        sourceRows: baseRows,
      })
      if (updates.length === 0) return

      setRows((prev) => {
        const nextRows = applyPersistedPfmeaRowOrderUpdates(prev, updates)
        rowsRef.current = nextRows
        return nextRows
      })
    },
    [rowsRef]
  )

  const displayOps = useMemo(() => {
    return buildPfmeaDisplayOperations(ops, rowsSorted)
  }, [ops, rowsSorted])

  const tableRows = useMemo(() => {
    return buildPfmeaTableRows(displayOps, rowsSorted, workingRevisionId)
  }, [displayOps, rowsSorted, workingRevisionId])

  const avgRpnSummary = useMemo(() => {
    return computePfmeaAverageRpnSummary(
      rowsSorted,
      (row) => computePfmeaDerivedFromContext(row).currentRisk,
      getRiskColorFor,
      getRiskColorForAverageRpn
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsSorted, getRiskColorFor, getRiskColorForAverageRpn])

  const { handleSaveRevision } = usePfmeaSaveRevision({
    applyPendingCellValues,
    avgRpn: avgRpnSummary.avg == null ? null : Math.round(avgRpnSummary.avg * 100) / 100,
    changeDesc,
    cleanupEmptyTransientRows,
    clearDirtyDraftPersisted,
    computeDerivedForRow: (row) => computePfmeaDerivedFromContext(row).derived,
    currentAuthorName,
    dirtyPfmeaIds,
    draftRevisionIdOverride,
    editorRef,
    flushPendingCellUpdates,
    flushPendingTransientDeletes,
    forceRefreshExistingDraftFromOpenRef,
    groupIdsSupportedRef: pfmeaGroupIdsSupportedRef,
    isDirty,
    loadProjectView,
    loadRevisionHistory,
    persistPfmeaRowOrder,
    project,
    projectId,
    resetPfmeaEditRuntimeState,
    riskCount: rowsSorted.length,
    rowsRef,
    saveBusy,
    setChangeDesc,
    setDeletedPfmeaIds,
    setDirtyPfmeaIds,
    setDraftRevisionIdOverride,
    setEditSession,
    setErr,
    setRows,
    setSaveBusy,
    setShowSave,
    supabase,
    userId,
    workingRevisionId,
  })

  const tableRowsMemo = useRef<PfmeaRow[]>([])
  useEffect(() => {
    tableRowsMemo.current = tableRows
  }, [tableRows])

  const rowHierarchy = useMemo(() => buildPfmeaHierarchy(tableRows), [tableRows])

  const rowHierarchyById = useMemo(() => {
    const out = new Map<string, PfmeaRowHierarchy>()
    tableRows.forEach((row, index) => {
      const item = rowHierarchy[index]
      if (item) out.set(row.id, item)
    })
    return out
  }, [rowHierarchy, tableRows])

  useEffect(() => {
    rowHierarchyByIdRef.current = rowHierarchyById
  }, [rowHierarchyById])

  const colOrder = useMemo(() => buildPfmeaEditableColumnOrder(isColumnVisible), [isColumnVisible])

  const nextCell = useCallback((rowIndex: number, colIdx: number) => {
    return getNextPfmeaCellPosition(rowIndex, colIdx, colOrder, tableRowsMemo.current.length)
  }, [colOrder])
  const prevCell = useCallback((rowIndex: number, colIdx: number) => {
    return getPreviousPfmeaCellPosition(rowIndex, colIdx, colOrder)
  }, [colOrder])

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent<any>, rowIndex: number, colIdx: number, allowEnterNewline: boolean) => {
      if (e.key === 'Enter' && allowEnterNewline) return

      if (e.key === 'Tab') {
        e.preventDefault()
        if (colOrder.length === 0) return
        const pos = e.shiftKey ? prevCell(rowIndex, colIdx) : nextCell(rowIndex, colIdx)
        const nextRow = tableRowsMemo.current[pos.r]
        const nextCol = colOrder[pos.c]
        if (!nextCol) return
        if (!nextRow) return
        void startEditCell(nextRow, nextCol)
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        if (edit) clearPendingCellValue(edit.rowId, edit.col)
        setEdit(null)
        return
      }
    },
    [colOrder, startEditCell, edit, clearPendingCellValue, nextCell, prevCell]
  )

  // ROWSPAN MAP: scalanie dla 4 pierwszych kolumn
  const mergeInfo = useMemo(() => {
    return buildPfmeaOperationMergeInfo(tableRows)
  }, [tableRows])

  const failureModeMergeInfo = useMemo(() => {
    return buildPfmeaBlockMergeInfoByHierarchy(tableRows, rowHierarchy, (item) => item.failureModeKey)
  }, [rowHierarchy, tableRows])

  const failureBlockMergeInfo = useMemo(() => {
    return buildPfmeaBlockMergeInfoByHierarchy(tableRows, rowHierarchy, (item) => item.failureBlockKey)
  }, [rowHierarchy, tableRows])

  const actionPlanBlockMergeInfo = useMemo(() => {
    return buildPfmeaBlockMergeInfoByHierarchy(tableRows, rowHierarchy, (item) => item.causeBlockKey)
  }, [rowHierarchy, tableRows])

  const visibleColumnDefs = useMemo(() => PFMEA_COLUMNS.filter((col) => isColumnVisible(col.id)), [isColumnVisible])
  const widthOf = useCallback(
    (id: PfmeaColumnId) => `${PFMEA_COLUMNS_BY_ID[id]?.width ?? 120}px`,
    []
  )
  const visibleTableWidth = useMemo(
    () => visibleColumnDefs.reduce((sum, col) => sum + col.width, 0),
    [visibleColumnDefs]
  )
  const visibleColumnIds = useMemo(
    () => new Set(PFMEA_COLUMNS.filter((col) => isColumnVisible(col.id)).map((col) => col.id)),
    [isColumnVisible]
  )
  const editButtonLabel = sessionBusy
    ? 'Please wait...'
    : isEditOwner
      ? 'Discard draft'
      : isLockedByOther
        ? isChampion
          ? 'Take over PFMEA'
          : 'PFMEA locked'
        : 'Edit PFMEA'

  if (!projectId) {
    return (
      <div style={{ padding: 18 }}>
        <h1 style={{ margin: '10px 0 4px' }}>PFMEA</h1>
        <div style={{ color: 'crimson', marginTop: 10, fontWeight: 800 }}>Missing project id in URL.</div>
      </div>
    )
  }

  const frame = settingsFrameStyle
  const card: React.CSSProperties = { ...settingsCardStyle, color: SURFACE_TEXT }

  const pfmeaSummary = (
    <PfmeaTopSummary
      averageRpn={avgRpnSummary}
      operationsCount={ops.length}
      processName={project?.name}
      revisionLabel={workingRevisionLabel}
      rowsCount={rowsSorted.length}
    />
  )

  if (moduleAccessState !== 'allowed') {
    return null
  }

  return (
    <SettingsPageShell
      title="PFMEA"
      titleStyle={{ color: settingsProcessAccent, fontWeight: 600 }}
      subtitle="Analyze process risks and manage the PFMEA revision for the selected process."
      summary={pfmeaSummary}
      summaryMaxWidth={PFMEA_TOP_SUMMARY_MAX_WIDTH}
      backdrop={<SettingsBackdrop />}
    >
      <style jsx global>{`
        .pfmeaTable ::selection,
        .pfmeaTable .pfmeaEditor::selection {
          background: rgba(148, 163, 184, 0.38);
          color: #f8fafc;
        }

        .pfmeaTable ::-moz-selection,
        .pfmeaTable .pfmeaEditor::-moz-selection {
          background: rgba(148, 163, 184, 0.38);
          color: #f8fafc;
        }

        .pfmeaTd.rpnCell::selection {
          background: #fafafa;
          color: #111827;
        }

        .pfmeaTd.rpnCell::-moz-selection {
          background: #fafafa;
          color: #111827;
        }

        .pfmeaTable .pfmeaEditor,
        .pfmeaTable .pfmeaEditor:focus {
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          width: 100% !important;
          font: inherit !important;
          color: inherit !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        .pfmeaTable textarea.pfmeaEditor {
          white-space: pre-wrap !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          resize: none !important;
          overflow: hidden !important;
          min-height: 18px !important;
        }

        .pfmeaTable input.pfmeaEditor[type='date'] {
          -webkit-appearance: none !important;
          appearance: none !important;
        }

        .pfmeaTable select.pfmeaEditor {
          -webkit-appearance: none !important;
          appearance: none !important;
        }

        .pfmeaRow {
          height: var(--pfmea-row-height, 56px);
        }

        .pfmeaTd {
          padding:
            var(--pfmea-td-pad-top, 10px)
            10px
            var(--pfmea-td-pad-bottom, 10px)
            10px !important;
          box-sizing: border-box;
          height: var(--pfmea-row-height, 56px);
          vertical-align: middle;
          background: rgba(255,255,255,0.03);
          color: #e1e5ec;
          text-align: center;
          overflow: hidden;
          position: relative;
          font-weight: 500;
          font-size: 16px;
          line-height: 1.25;
          border: 0 !important;
        }

        .pfmeaRow:not(:last-child) .pfmeaTd {
          border-bottom: 1px solid rgba(255,255,255,0.14) !important;
        }

        .pfmeaTd {
          border-right: 1px solid rgba(255,255,255,0.14) !important;
        }
        .pfmeaRow .pfmeaTd:last-child {
          border-right: 0 !important;
        }

        .pfmeaRow.groupStart .pfmeaTd {
          border-top: 1px solid rgba(255,255,255,0.14) !important;
        }

        .pfmeaTd:hover {
          background: rgba(255,255,255,0.075);
        }

        .pfmeaTd.gray:hover {
          background: rgba(255,255,255,0.095);
        }

        .pfmeaTd.flashMissing {
          box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.9) !important;
          border-radius: 0;
        }

        .pfmeaTd.gray {
          background: rgba(255,255,255,0.05);
          color: #e1e5ec;
        }

        .pfmeaTd.center {
          text-align: center;
        }

        .pfmeaTd.singleLine {
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .pfmeaTd.multiLine {
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .pfmeaTd.scaleSelectCell {
          overflow: visible !important;
          position: relative;
          white-space: normal !important;
        }
        .pfmeaTextCellShell {
          position: relative;
          width: 100%;
          min-height: calc(var(--pfmea-row-height, 56px) - var(--pfmea-td-pad-top, 10px) - var(--pfmea-td-pad-bottom, 10px));
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pfmeaTextCellContent {
          width: 100%;
          min-height: calc(var(--pfmea-row-height, 56px) - var(--pfmea-td-pad-top, 10px) - var(--pfmea-td-pad-bottom, 10px));
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pfmeaTextCellContent > span {
          display: block;
          width: 100%;
        }
        .pfmeaTextCellContent .pfmeaEditor {
          min-height: calc(var(--pfmea-row-height, 56px) - var(--pfmea-td-pad-top, 10px) - var(--pfmea-td-pad-bottom, 10px)) !important;
          display: block;
        }
        .pfmeaTextCellShell.hasSideAction .pfmeaTextCellContent {
          padding-left: 34px;
          padding-right: 34px;
        }
        .pfmeaInlineAddBtn {
          position: absolute;
          top: 50%;
          right: 0;
          transform: translateY(-50%);
          width: 20px;
          height: 20px;
          border-radius: 999px;
          border: 1px solid rgba(96, 165, 250, 0.75);
          background: rgba(59, 130, 246, 0.3);
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          z-index: 3;
          transition: opacity 120ms ease, background 120ms ease, border-color 120ms ease;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.22);
        }
        .pfmeaInlineAddGlyph {
          position: relative;
          width: 10px;
          height: 10px;
          display: inline-block;
        }
        .pfmeaInlineAddGlyph::before,
        .pfmeaInlineAddGlyph::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          background: currentColor;
          border-radius: 999px;
          transform: translate(-50%, -50%);
        }
        .pfmeaInlineAddGlyph::before {
          width: 10px;
          height: 2px;
        }
        .pfmeaInlineAddGlyph::after {
          width: 2px;
          height: 10px;
        }
        .pfmeaTd.editable:hover .pfmeaTextCellShell.hasSideAction .pfmeaInlineAddBtn,
        .pfmeaTd.editable:focus-within .pfmeaTextCellShell.hasSideAction .pfmeaInlineAddBtn,
        .pfmeaTextCellShell.showSideAction .pfmeaInlineAddBtn {
          opacity: 1;
          pointer-events: auto;
        }
        .pfmeaInlineAddBtn:hover {
          background: rgba(59, 130, 246, 0.26);
        }
        .pfmeaInlineAddBtn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: rgba(148, 163, 184, 0.22);
          border-color: rgba(148, 163, 184, 0.45);
          color: rgba(255,255,255,0.82);
        }
        .pfmeaTd.scaleValue {
          font-size: 16px !important;
          font-weight: 700 !important;
          color: #d9a86c !important;
          vertical-align: middle !important;
        }

        .trashBtn {
          height: 29px;
          width: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255,255,255,0.08);
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease, transform 0.06s ease;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .trashBtn:hover {
          background: rgba(239, 68, 68, 0.18);
          border-color: rgba(239, 68, 68, 0.4);
        }
        .trashBtn:active {
          transform: translateY(1px);
        }
        .trashIcon {
          width: 16px;
          height: 16px;
          color: rgba(255, 255, 255, 0.72);
        }
        .trashBtn:hover .trashIcon {
          color: rgba(239, 68, 68, 0.95);
        }

        .rf-button {
          background: rgba(255,255,255,0.08);
          color: ${SURFACE_TEXT};
          font-family: inherit;
          font-weight: 650;
          border: 1px solid rgba(255,255,255,0.18);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .rf-button:hover {
          background: rgba(59,130,246,0.18) !important;
          border-color: rgba(96,165,250,0.45) !important;
          box-shadow: 0 10px 24px rgba(37,99,235,0.18) !important;
        }
        .rf-button:disabled {
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.35);
          cursor: not-allowed;
        }
      `}</style>

      {err ? <SettingsBanner tone="error">{err}</SettingsBanner> : null}
      {/* Save Revision Modal */}
      {showSave && (
        <PfmeaSaveRevisionModal
          actionButtonStyle={actionBtn}
          authorName={currentAuthorName}
          changeDescription={changeDesc}
          currentRowsCount={rowsSorted.length}
          error={err}
          isDirty={isDirty}
          onCancel={() => setShowSave(false)}
          onChangeDescription={setChangeDesc}
          onSave={handleSaveRevision}
          readOnly={readOnly}
          saveBusy={saveBusy}
          workingRevisionLabel={workingRevisionLabel}
        />
      )}

      {confirmDialog && (
        <PfmeaConfirmDialog
          actionButtonStyle={actionBtn}
          busy={confirmBusy}
          dialog={confirmDialog}
          onBusyChange={setConfirmBusy}
          onCancel={() => setConfirmDialog(null)}
          onError={setErr}
        />
      )}

      {historyOpen && (
        <PfmeaRevisionHistoryModal
          entries={historyEntries}
          getAverageRpnColor={getRiskColorForAverageRpn}
          loading={historyLoading}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* Table */}
      <div style={{ ...frame, marginTop: 10 }}>
        <PfmeaToolbar
          actionButtonStyle={actionBtn}
          cardStyle={card}
          columnFiltersOpen={columnFiltersOpen}
          columnGroups={PFMEA_COLUMN_FILTER_GROUPS}
          columnsById={PFMEA_COLUMNS_BY_ID}
          editButtonDisabled={sessionBusy || isObsolete || (!isEditOwner && isLockedByOther && !isChampion)}
          editButtonLabel={editButtonLabel}
          isEditOwner={isEditOwner}
          isSaveDisabled={!isDirty || readOnly}
          onClearColumnGroup={(ids) => clearColumnGroup(ids as PfmeaColumnId[])}
          onEditClick={() => {
            if (isEditOwner) {
              setConfirmDialog({
                title: 'Discard draft and close session',
                body: 'Are you sure? All unsaved draft PFMEA changes will be permanently lost.',
                dangerNote: 'DATA WILL BE PERMANENTLY LOST',
                onConfirm: async () => {
                  await discardDraftAndCloseSession()
                  return true
                },
              })
              return
            }
            void startEditSession()
          }}
          onOpenRevisionHistory={openRevisionHistory}
          onOpenSave={() => {
            setErr('')
            setShowSave(true)
          }}
          onToggleColumn={(id, checked) => toggleColumnVisibility(id as PfmeaColumnId, checked)}
          onToggleColumnFilters={() => setColumnFiltersOpen((value) => !value)}
          onUncheckColumnGroup={(ids) => uncheckColumnGroup(ids as PfmeaColumnId[])}
          projectId={projectId}
          saveReadOnly={readOnly}
          visibleColumnIds={visibleColumnIds}
        />

        <div ref={tableWrapRef} style={{ ...card, padding: 0, borderRadius: SURFACE_RADIUS, overflow: 'visible' }}>
          <div
            className="pfmeaTable"
            style={{
              maxHeight: 'calc(100vh - 280px)',
              overflowX: 'auto',
              overflowY: 'visible',
              ['--pfmea-sticky-cell-top' as any]: `${stickyMergedCellTop}px`,
            }}
          >
            <table
              style={{
                width: `${visibleTableWidth}px`,
                minWidth: `${visibleTableWidth}px`,
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                fontSize: 16,
                fontFamily: 'Calibri, Arial, sans-serif',
              }}
            >
              <PfmeaTableHeader
                isColumnVisible={(id) => isColumnVisible(id as PfmeaColumnId)}
                tableHeadRef={tableHeadRef}
                visibleColumnDefs={visibleColumnDefs}
                widthOf={(id) => widthOf(id as PfmeaColumnId)}
              />

              <tbody>
                {tableRows.map((r, rowIndex) => {
                  const opNo = r.operations?.operation_number ?? null
                  const station = r.operations?.machine ?? ''
                  const operationName = r.operations?.operation ?? ''
                  const step = r.operations?.name ?? ''
                  const isPlaceholder = isPlaceholderRowId(r.id)

                  const { currentRisk: a1, residualRisk: a2 } = computePfmeaDerivedFromContext(r)

                  const risk1 = getRiskColorFor(a1.sev, a1.doVal)
                  const risk2 = getRiskColorFor(a2.sev, a2.doVal)
                  const failureModeOwnerRow = findPfmeaMergeOwnerRow(tableRows, rowIndex, failureModeMergeInfo) ?? r
                  const failureBlockOwnerRow = findPfmeaMergeOwnerRow(tableRows, rowIndex, failureBlockMergeInfo) ?? r
                  const actionPlanOwnerRow = findPfmeaMergeOwnerRow(tableRows, rowIndex, actionPlanBlockMergeInfo) ?? r
                  const effectiveCurrentRow = applyPendingCellValues(r)
                  const canAddFailureModeRow = hasPfmeaTextValue(applyPendingCellValues(failureModeOwnerRow).failure_mode)
                  const canAddEffectRow = hasPfmeaTextValue(applyPendingCellValues(failureBlockOwnerRow).effect)
                  const canAddCauseRow = hasPfmeaTextValue(applyPendingCellValues(actionPlanOwnerRow).cause)
                  const canAddRecommendedActionRow = hasPfmeaTextValue(effectiveCurrentRow.recommended_action)
                  const latestRowForHighlights = applyPendingCellValues(rowsRef.current.find((rowItem) => rowItem.id === r.id) ?? r)
                  const effectiveFailureModeOwnerRow = applyPendingCellValues(failureModeOwnerRow)
                  const effectiveFailureBlockOwnerRow = applyPendingCellValues(failureBlockOwnerRow)
                  const effectiveActionPlanOwnerRow = applyPendingCellValues(actionPlanOwnerRow)
                  const effectivePcpSourceRow = {
                    ...effectiveCurrentRow,
                    class: normalizeClassValue(effectiveFailureModeOwnerRow.class),
                    severity: asInt1to10(effectiveFailureBlockOwnerRow.severity),
                  } as PfmeaRow
                  const pcpAutoReasons = getPfmeaPcpAutoReasons(effectivePcpSourceRow, risk1)
                  const pcpChecked = isPfmeaSelectedForPcp(effectivePcpSourceRow, risk1)
                  const pcpDisabled = readOnly || isPlaceholder || !hasFailureModeContext(effectiveFailureModeOwnerRow)
                  const isMissingHighlighted = (col: keyof PfmeaRow) => isPfmeaCellHighlighted(highlightedMissingCells, r.id, col)
                  const runActionPlanStart = (targetCol: keyof PfmeaRow) => {
                    window.setTimeout(() => {
                      const latestRow = latestRowForHighlights
                      const contextualActionRow = getRecommendedActionContinuationSourceRow(
                        buildPfmeaActionPlanValidationRow({
                          actionPlanOwnerRow: effectiveActionPlanOwnerRow,
                          currentRow: latestRow,
                          failureBlockOwnerRow: effectiveFailureBlockOwnerRow,
                          failureModeOwnerRow: effectiveFailureModeOwnerRow,
                        }) as PfmeaRow
                      )
                      const missingFields = getPreviousRequiredFieldForActionPlan(targetCol, contextualActionRow)
                      if (readOnly) return
                      if (missingFields.length === 0) {
                        void startEditCell(latestRow, targetCol)
                        return
                      }
                      const highlightKeys = getPfmeaMissingActionPlanHighlightKeys(missingFields, {
                        actionPlanOwnerRow,
                        currentRow: latestRowForHighlights,
                        failureBlockOwnerRow,
                        failureModeOwnerRow,
                      })
                      setHighlightedMissingCells(highlightKeys)
                    }, 0)
                  }

                  const riskRpnStyle: React.CSSProperties = {
                    ...(risk1 ? { background: colorFill(risk1) } : {}),
                    color: '#e1e5ec',
                    fontSize: 16,
                    fontWeight: 700,
                  }
                  const riskRpn2Style: React.CSSProperties = {
                    ...(risk2 ? { background: colorFill(risk2) } : {}),
                    color: '#e1e5ec',
                    fontSize: 16,
                    fontWeight: 700,
                  }

                  const prevOpNo = rowIndex > 0 ? tableRows[rowIndex - 1]?.operations?.operation_number ?? null : null
                  const isFirstOfMergedRun = mergeInfo[rowIndex]?.span > 0
                  const groupStart = isFirstOfMergedRun && rowIndex > 0 && opNo != null && prevOpNo != null && opNo !== prevOpNo

                  const span = mergeInfo[rowIndex]?.span ?? 0
                  const failureModeSpan = failureModeMergeInfo[rowIndex]?.span ?? 0
                  const failureBlockSpan = failureBlockMergeInfo[rowIndex]?.span ?? 0
                  const actionPlanBlockSpan = actionPlanBlockMergeInfo[rowIndex]?.span ?? 0
                  const rowNumber = rowHierarchyById.get(r.id)?.rowLabel

                  return (
                    <tr
                      key={r.id}
                      data-pfmea-row-id={r.id}
                      data-pfmea-row-no={rowNumber ?? undefined}
                      className={`pfmeaRow ${groupStart ? 'groupStart' : ''}`}
                    >
                      {span > 0 ? (
                        <>
                          {isColumnVisible('id') ? (
                            <TdRead value={opNo == null ? '' : String(opNo)} className="pfmeaTd gray center multiLine" rowSpan={span} onClick={() => setExpandedOperationId(r.operation_id || r.operations?.id || null)} />
                          ) : null}
                          {isColumnVisible('station') ? (
                            <TdRead value={station} className="pfmeaTd gray center multiLine" rowSpan={span} onClick={() => setExpandedOperationId(r.operation_id || r.operations?.id || null)} />
                          ) : null}
                          {isColumnVisible('operation') ? (
                            <TdRead value={operationName} className="pfmeaTd gray center multiLine" rowSpan={span} onClick={() => setExpandedOperationId(r.operation_id || r.operations?.id || null)} />
                          ) : null}
                          {isColumnVisible('process_step') ? (
                            <TdRead value={step} className="pfmeaTd gray multiLine" rowSpan={span} onClick={() => setExpandedOperationId(r.operation_id || r.operations?.id || null)} />
                          ) : null}
                        </>
                      ) : null}

                      {isColumnVisible('failure_mode') && failureModeSpan > 0 ? (
                        <TdText
                          value={effectiveFailureModeOwnerRow.failure_mode}
                          editing={edit?.rowId === r.id && edit?.col === 'failure_mode'}
                          onStart={() => void startEditCell(r, 'failure_mode')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'failure_mode', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'failure_mode', v)
                            updateCellWithDerived(r, { failure_mode: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('failure_mode'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          rowSpan={failureModeSpan}
                          sideAction={
                            canAddFailureModeRow
                              ? {
                                  title: 'Add failure mode row',
                                  label: '+',
                                  onClick: () => {
                                    if (isPlaceholder) {
                                      void (async () => {
                                        try {
                                          const materializedRow = await materializePlaceholderRowForAdd(r)
                                          await addFailureModeContinuationRow(materializedRow, materializedRow)
                                        } catch (e: any) {
                                          setErr(e?.message ?? String(e))
                                        }
                                      })()
                                      return
                                    }
                                    const anchorRow = resolvePfmeaBlockEndAnchorRow(tableRows, rowIndex, failureModeMergeInfo) ?? r
                                    void addFailureModeContinuationRow(r, anchorRow)
                                  },
                                }
                              : undefined
                          }
                          disabled={readOnly}
                          flash={isMissingHighlighted('failure_mode')}
                          cellKey="failure_mode"
                          style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 16, fontWeight: 400, lineHeight: 1.45, textAlign: 'center', paddingTop: 14, paddingBottom: 14, color: '#d7dbe3' }}
                        />
                      ) : null}

                      {isColumnVisible('characteristic') && failureModeSpan > 0 ? (
                        <TdText
                          value={effectiveFailureModeOwnerRow.characteristic}
                          editing={edit?.rowId === r.id && edit?.col === 'characteristic'}
                          onStart={() => void startEditCell(r, 'characteristic')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'characteristic', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'characteristic', v)
                            updateCellWithDerived(r, { characteristic: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('characteristic'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          rowSpan={failureModeSpan}
                          disabled={readOnly}
                          cellKey="characteristic"
                          style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 16, color: '#d7dbe3' }}
                        />
                      ) : null}

                      {isColumnVisible('class') && failureModeSpan > 0 ? (
                        <TdClassSelect
                          value={normalizeClassValue(effectiveFailureModeOwnerRow.class)}
                          editing={edit?.rowId === r.id && edit?.col === 'class'}
                          onStart={() => void startEditCell(r, 'class')}
                          onCommit={(v) => updateCellWithDerived(r, { class: v || null })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('class'), false)}
                          stopEdit={() => setEdit(null)}
                          options={CLASS_OPTIONS}
                          rowSpan={failureModeSpan}
                          disabled={readOnly}
                          cellKey="class"
                        />
                      ) : null}

                      {isColumnVisible('effect') && failureBlockSpan > 0 ? (
                        <TdText
                          value={effectiveFailureBlockOwnerRow.effect}
                          editing={edit?.rowId === r.id && edit?.col === 'effect'}
                          onStart={() => void startEditCell(r, 'effect')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'effect', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'effect', v)
                            updateCellWithDerived(r, { effect: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('effect'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          rowSpan={failureBlockSpan}
                          sideAction={
                            canAddEffectRow
                              ? {
                                  title: 'Add effect row',
                                  label: '+',
                                  onClick: () => {
                                    if (isPlaceholder) {
                                      void (async () => {
                                        try {
                                          const materializedRow = await materializePlaceholderRowForAdd(r)
                                          await addEffectContinuationRow(materializedRow, materializedRow)
                                        } catch (e: any) {
                                          setErr(e?.message ?? String(e))
                                        }
                                      })()
                                      return
                                    }
                                    const anchorRow = resolvePfmeaBlockEndAnchorRow(tableRows, rowIndex, failureBlockMergeInfo) ?? r
                                    void addEffectContinuationRow(failureModeOwnerRow, anchorRow)
                                  },
                                }
                              : undefined
                          }
                          disabled={readOnly}
                          flash={isMissingHighlighted('effect')}
                          cellKey="effect"
                          style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 16, color: '#d7dbe3' }}
                        />
                      ) : null}

                      {isColumnVisible('sev') && failureBlockSpan > 0 ? (
                        <TdScaleSelect
                          value={asInt1to10(effectiveFailureBlockOwnerRow.severity)}
                          editing={edit?.rowId === failureBlockOwnerRow.id && edit?.col === 'severity'}
                          onStart={() => void startEditCell(failureBlockOwnerRow, 'severity')}
                          onLiveChange={(n) => setPendingCellValue(failureBlockOwnerRow.id, 'severity', n)}
                          onCommit={(n) => {
                            setPendingCellValue(failureBlockOwnerRow.id, 'severity', n)
                            updateCellWithDerived(failureBlockOwnerRow, { severity: n })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('severity'), false)}
                          stopEdit={() => setEdit(null)}
                          options={severityOptions}
                          rowSpan={failureBlockSpan}
                          disabled={readOnly}
                          flash={isMissingHighlighted('severity')}
                          cellKey="severity"
                        />
                      ) : null}

                      {isColumnVisible('cause') && actionPlanBlockSpan > 0 ? (
                        <TdText
                          value={effectiveActionPlanOwnerRow.cause}
                          editing={edit?.rowId === r.id && edit?.col === 'cause'}
                          onStart={() => void startEditCell(r, 'cause')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'cause', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'cause', v)
                            updateCellWithDerived(r, { cause: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('cause'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          sideAction={
                            canAddCauseRow
                              ? {
                                  title: 'Add cause row',
                                  label: '+',
                                  onClick: () => {
                                    if (isPlaceholder) {
                                      void (async () => {
                                        try {
                                          const materializedRow = await materializePlaceholderRowForAdd(r)
                                          await addCauseContinuationRow(materializedRow, materializedRow)
                                        } catch (e: any) {
                                          setErr(e?.message ?? String(e))
                                        }
                                      })()
                                      return
                                    }
                                    const anchorRow = resolvePfmeaBlockEndAnchorRow(tableRows, rowIndex, actionPlanBlockMergeInfo) ?? r
                                    const sourceRow = getFailureBlockSourceRowAtIndex(rowIndex) ?? failureBlockOwnerRow
                                    void addCauseContinuationRow(sourceRow, anchorRow)
                                  },
                                }
                              : undefined
                          }
                          disabled={readOnly}
                          flash={isMissingHighlighted('cause')}
                          rowSpan={actionPlanBlockSpan}
                          cellKey="cause"
                        />
                      ) : null}

                      {isColumnVisible('occ') && actionPlanBlockSpan > 0 ? (
                        <TdScaleSelect
                          value={asInt1to10(effectiveActionPlanOwnerRow.occurrence)}
                          editing={edit?.rowId === r.id && edit?.col === 'occurrence'}
                          onStart={() => void startEditCell(r, 'occurrence')}
                          onLiveChange={(n) => setPendingCellValue(r.id, 'occurrence', n)}
                          onCommit={(n) => {
                            setPendingCellValue(r.id, 'occurrence', n)
                            updateCellWithDerived(r, { occurrence: n })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('occurrence'), false)}
                          stopEdit={() => setEdit(null)}
                          options={occurrenceOptions}
                          rowSpan={actionPlanBlockSpan}
                          disabled={readOnly}
                          flash={isMissingHighlighted('occurrence')}
                          cellKey="occurrence"
                        />
                      ) : null}

                      {isColumnVisible('current_prev') && actionPlanBlockSpan > 0 ? (
                        <TdText
                          value={effectiveActionPlanOwnerRow.current_prevention}
                          editing={edit?.rowId === r.id && edit?.col === 'current_prevention'}
                          onStart={() => void startEditCell(r, 'current_prevention')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'current_prevention', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'current_prevention', v)
                            updateCellWithDerived(r, { current_prevention: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('current_prevention'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          rowSpan={actionPlanBlockSpan}
                          disabled={readOnly}
                          flash={isMissingHighlighted('current_prevention')}
                          cellKey="current_prevention"
                        />
                      ) : null}

                      {isColumnVisible('current_det') && actionPlanBlockSpan > 0 ? (
                        <TdText
                          value={effectiveActionPlanOwnerRow.current_detection}
                          editing={edit?.rowId === r.id && edit?.col === 'current_detection'}
                          onStart={() => void startEditCell(r, 'current_detection')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'current_detection', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'current_detection', v)
                            updateCellWithDerived(r, { current_detection: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('current_detection'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          rowSpan={actionPlanBlockSpan}
                          disabled={readOnly}
                          flash={isMissingHighlighted('current_detection')}
                          cellKey="current_detection"
                        />
                      ) : null}

                      {isColumnVisible('det') && actionPlanBlockSpan > 0 ? (
                        <TdScaleSelect
                          value={asInt1to10(effectiveActionPlanOwnerRow.detection)}
                          editing={edit?.rowId === r.id && edit?.col === 'detection'}
                          onStart={() => void startEditCell(r, 'detection')}
                          onLiveChange={(n) => setPendingCellValue(r.id, 'detection', n)}
                          onCommit={(n) => {
                            setPendingCellValue(r.id, 'detection', n)
                            updateCellWithDerived(r, { detection: n })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('detection'), false)}
                          stopEdit={() => setEdit(null)}
                          options={detectionOptions}
                          rowSpan={actionPlanBlockSpan}
                          disabled={readOnly}
                          flash={isMissingHighlighted('detection')}
                          cellKey="detection"
                        />
                      ) : null}

                      {isColumnVisible('rpn') && actionPlanBlockSpan > 0 ? (
                        <TdRead
                          value={a1.rpn == null ? '' : String(a1.rpn)}
                          className="pfmeaTd rpnCell center gray singleLine"
                          style={riskRpnStyle}
                          rowSpan={actionPlanBlockSpan}
                          onClick={() => setExpandedOperationId(r.operation_id || r.operations?.id || null)}
                        />
                      ) : null}

                      {isColumnVisible('pcp') ? (
                        <TdPcpToggle
                          checked={pcpChecked}
                          reasons={pcpAutoReasons}
                          disabled={pcpDisabled}
                          onToggle={() => {
                            if (pcpDisabled) return
                            void updateCellWithDerived(r, { pcp: !pcpChecked })
                          }}
                          cellKey="pcp"
                        />
                      ) : null}

                      {isColumnVisible('recommended_action') ? (
                        <TdText
                          value={effectiveCurrentRow.recommended_action}
                          editing={edit?.rowId === r.id && edit?.col === 'recommended_action'}
                          onStart={() => runActionPlanStart('recommended_action')}
                          onLiveChange={(v) => {
                            setPendingCellValue(r.id, 'recommended_action', v)
                            clearRecommendedActionTransientIfFilled(r.id, v)
                          }}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'recommended_action', v)
                            clearRecommendedActionTransientIfFilled(r.id, v)
                            updateCellWithDerived(r, { recommended_action: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('recommended_action'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          sideAction={
                            canAddRecommendedActionRow
                              ? {
                                  title: 'Add recommended action row',
                                  label: '+',
                                  onClick: () => {
                                    if (isPlaceholder) {
                                      void (async () => {
                                        try {
                                          const materializedRow = await materializePlaceholderRowForAdd(r)
                                          await addRecommendedActionContinuationRow(materializedRow, materializedRow)
                                        } catch (e: any) {
                                          setErr(e?.message ?? String(e))
                                        }
                                      })()
                                      return
                                    }
                                    void addRecommendedActionContinuationRow(r, r)
                                  },
                                }
                              : undefined
                          }
                          disabled={readOnly}
                          flash={isMissingHighlighted('recommended_action')}
                          cellKey="recommended_action"
                        />
                      ) : null}

                      {isColumnVisible('responsible') ? (
                        <TdText
                          value={effectiveCurrentRow.responsible}
                          editing={edit?.rowId === r.id && edit?.col === 'responsible'}
                          onStart={() => runActionPlanStart('responsible')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'responsible', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'responsible', v)
                            updateCellWithDerived(r, { responsible: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('responsible'), false)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          singleLine
                          disabled={readOnly}
                          flash={isMissingHighlighted('responsible')}
                          cellKey="responsible"
                        />
                      ) : null}

                      {isColumnVisible('target_date') ? (
                        <TdDate
                          value={effectiveCurrentRow.target_date}
                          editing={edit?.rowId === r.id && edit?.col === 'target_date'}
                          onStart={() => runActionPlanStart('target_date')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'target_date', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'target_date', v)
                            updateCellWithDerived(r, { target_date: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('target_date'), false)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          disabled={readOnly}
                          flash={isMissingHighlighted('target_date')}
                          cellKey="target_date"
                        />
                      ) : null}

                      {isColumnVisible('action_status') ? (
                        <TdSelect
                          value={latestRowForHighlights.action_status}
                          editing={edit?.rowId === r.id && edit?.col === 'action_status'}
                          onStart={() => runActionPlanStart('action_status')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'action_status', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'action_status', v)
                            updateCellWithDerived(r, { action_status: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('action_status'), false)}
                          stopEdit={() => setEdit(null)}
                          options={['', 'OPEN', 'CLOSED', 'CANCELED']}
                          disabled={readOnly}
                          flash={isMissingHighlighted('action_status')}
                          cellKey="action_status"
                        />
                      ) : null}

                      {isColumnVisible('o2') ? (
                        <TdScaleSelect
                          value={asInt1to10(latestRowForHighlights.occurrence2)}
                          editing={edit?.rowId === r.id && edit?.col === 'occurrence2'}
                          onStart={() => runActionPlanStart('occurrence2')}
                          onLiveChange={(n) => setPendingCellValue(r.id, 'occurrence2', n)}
                          onCommit={(n) => {
                            setPendingCellValue(r.id, 'occurrence2', n)
                            updateCellWithDerived(r, { occurrence2: n })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('occurrence2'), false)}
                          stopEdit={() => setEdit(null)}
                          options={occurrenceOptions}
                          disabled={readOnly}
                          flash={isMissingHighlighted('occurrence2')}
                          cellKey="occurrence2"
                        />
                      ) : null}

                      {isColumnVisible('d2') ? (
                        <TdScaleSelect
                          value={asInt1to10(latestRowForHighlights.detection2)}
                          editing={edit?.rowId === r.id && edit?.col === 'detection2'}
                          onStart={() => runActionPlanStart('detection2')}
                          onLiveChange={(n) => setPendingCellValue(r.id, 'detection2', n)}
                          onCommit={(n) => {
                            setPendingCellValue(r.id, 'detection2', n)
                            updateCellWithDerived(r, { detection2: n })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('detection2'), false)}
                          stopEdit={() => setEdit(null)}
                          options={detectionOptions}
                          disabled={readOnly}
                          flash={isMissingHighlighted('detection2')}
                          cellKey="detection2"
                        />
                      ) : null}

                      {isColumnVisible('rpn2') ? (
                        <TdRead
                          value={a2.rpn == null ? '' : String(a2.rpn)}
                          className="pfmeaTd rpnCell center gray singleLine"
                          style={riskRpn2Style}
                          onClick={() => setExpandedOperationId(r.operation_id || r.operations?.id || null)}
                        />
                      ) : null}

                      {isColumnVisible('delete') ? (
                        <PfmeaDeleteCell
                          isEditOwner={isEditOwner}
                          isPlaceholder={isPlaceholder}
                          onDelete={() => deleteRow(r.id)}
                          readOnly={readOnly}
                        />
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SettingsPageShell>
  )
}

/* ===================== TD COMPONENTS ===================== */

function PfmeaPageFallback() {
  return (
    <div style={{ padding: 24, color: '#666', fontSize: 14, fontWeight: 700 }}>
      Loading PFMEA...
    </div>
  )
}


