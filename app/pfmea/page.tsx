'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabaseBrowser'
import {
  PFMEA_COLUMNS,
  PFMEA_COLUMNS_BY_ID,
  PFMEA_COLUMN_FILTER_GROUPS,
  type PfmeaColumnId,
} from '@/features/pfmea/pfmea-columns'
import { PfmeaConfirmDialog, type PfmeaConfirmDialogConfig } from '@/features/pfmea/pfmea-confirm-dialog'
import { PfmeaRevisionHistoryModal } from '@/features/pfmea/pfmea-revision-history-modal'
import { PfmeaSaveRevisionModal } from '@/features/pfmea/pfmea-save-revision-modal'
import { PfmeaTableBody } from '@/features/pfmea/pfmea-table-body'
import { PfmeaTableShell } from '@/features/pfmea/pfmea-table-shell'
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
import { usePfmeaRowEditingController } from '@/features/pfmea/use-pfmea-row-editing-controller'
import { usePfmeaRevisionController } from '@/features/pfmea/use-pfmea-revision-controller'
import { usePfmeaScaleOptions } from '@/features/pfmea/use-pfmea-scale-options'
import { usePfmeaSessionController } from '@/features/pfmea/use-pfmea-session-controller'
import { usePfmeaStickyMergedCellTop } from '@/features/pfmea/use-pfmea-sticky-merged-cell-top'
import { usePfmeaTransientTracking } from '@/features/pfmea/use-pfmea-transient-tracking'
import { SURFACE_TEXT, actionBtn } from '@/features/pfmea/pfmea-page-styles'
import {
  buildPfmeaBlockMergeInfoByHierarchy,
  buildPfmeaHierarchy,
  isPlaceholderRowId,
  type PfmeaRowHierarchy,
} from '@/features/pfmea/pfmea-hierarchy-utils'
import {
  applyPersistedPfmeaRowOrderUpdates,
  reindexPfmeaRows,
  sortPfmeaRows,
} from '@/features/pfmea/pfmea-row-order-utils'
import {
  computePfmeaDerivedFromContext as computePfmeaDerivedFromRowContext,
} from '@/features/pfmea/pfmea-row-context-utils'
import { isPfmeaTransientRowEmpty } from '@/features/pfmea/pfmea-transient-row-utils'
import { computePfmeaAverageRpnSummary, getPfmeaSummaryRiskKey } from '@/features/pfmea/pfmea-summary-utils'
import { buildPfmeaDisplayOperations, buildPfmeaTableRows } from '@/features/pfmea/pfmea-visible-rows-utils'
import { buildPfmeaOperationMergeInfo } from '@/features/pfmea/pfmea-table-merge-utils'
import {
  buildPfmeaEditableColumnOrder,
  getNextPfmeaCellPosition,
  getPreviousPfmeaCellPosition,
} from '@/features/pfmea/pfmea-table-navigation-utils'
import { usePfmeaSaveRevision } from '@/features/pfmea/use-pfmea-save-revision'
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

  function computePfmeaDerivedFromContext(row: PfmeaRow) {
    return computePfmeaDerivedFromRowContext(row, tableRows, applyPendingCellValues)
  }

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

  const rowHierarchy = useMemo(() => buildPfmeaHierarchy(tableRows), [tableRows])

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

  const avgRpnSummary = useMemo(() => {
    return computePfmeaAverageRpnSummary(
      tableRows,
      (row) => {
        const riskContext = computePfmeaDerivedFromContext(row)
        return {
          sev: riskContext.currentRisk.sev,
          doVal: riskContext.currentRisk.doVal,
          rpn: riskContext.currentRisk.rpn,
        }
      },
      getRiskColorFor,
      getRiskColorForAverageRpn,
      {
        countCurrentRowsIndividually: true,
        getResidualRisk: (row) => {
          const riskContext = computePfmeaDerivedFromContext(row)
          return {
            sev: riskContext.residualRisk.sev,
            doVal: riskContext.residualRisk.doVal,
            rpn: riskContext.residualRisk.rpn,
          }
        },
        getRiskColorForRpn: getRiskColorForAverageRpn,
        getRiskKey: (row, index) => getPfmeaSummaryRiskKey(row, index, rowHierarchy[index]),
        includeCurrentRisk: (_row, index) => (actionPlanBlockMergeInfo[index]?.span ?? 0) > 0,
        isClosedAction: (row) =>
          (row.action_status ?? '').trim().toUpperCase() === 'CLOSED' &&
          (row.recommended_action ?? '').trim().length > 0,
      }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionPlanBlockMergeInfo, tableRows, rowHierarchy, getRiskColorFor, getRiskColorForAverageRpn])

  const {
    addCauseContinuationRow,
    addEffectContinuationRow,
    addFailureModeContinuationRow,
    addRecommendedActionContinuationRow,
    cleanupEmptyTransientRows,
    deleteRow,
    materializePlaceholderRowForAdd,
    startEditCell,
    updateCellWithDerived,
  } = usePfmeaRowEditingController({
    applyPendingCellValues,
    clearPendingCellValuesForRow,
    clearPendingCellValuesForRows,
    computeDerivedFromContext: (row) => computePfmeaDerivedFromContext(row),
    draftRevisionIdOverride,
    ensureDraftIfNeeded,
    loadAll,
    markPfmeaDirty,
    persistPfmeaRowOrder,
    pfmeaGroupIdsSupportedRef,
    placeholderMaterializedIdRef,
    placeholderMaterializeRef,
    project,
    readOnly,
    rowHierarchyByIdRef,
    rowsRef,
    runPendingCellUpdate,
    setConfirmDialog,
    setDeletedPfmeaIds,
    setDirtyPfmeaIds,
    setEdit,
    setErr,
    setExpandedOperationId,
    setHighlightedMissingCells,
    setRows,
    supabase,
    tableRows,
    transientCauseContinuationIdsRef,
    transientEffectContinuationIdsRef,
    transientFailureModeContinuationIdsRef,
    transientRecommendedActionContinuationIdsRef,
    workingRevisionId,
  })

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
    riskCount: avgRpnSummary.count,
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
      riskCount={avgRpnSummary.count}
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
        .pfmeaTd.scaleValue.mutedScaleValue,
        .pfmeaTd.scaleValue.mutedScaleValue button {
          color: #8f96a3 !important;
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

        <PfmeaTableShell
          cardStyle={card}
          isColumnVisible={isColumnVisible}
          stickyMergedCellTop={stickyMergedCellTop}
          tableHeadRef={tableHeadRef}
          tableWrapRef={tableWrapRef}
          visibleColumnDefs={visibleColumnDefs}
          visibleTableWidth={visibleTableWidth}
          widthOf={widthOf}
        >
          <PfmeaTableBody
            actionPlanBlockMergeInfo={actionPlanBlockMergeInfo}
            addCauseContinuationRow={addCauseContinuationRow}
            addEffectContinuationRow={addEffectContinuationRow}
            addFailureModeContinuationRow={addFailureModeContinuationRow}
            addRecommendedActionContinuationRow={addRecommendedActionContinuationRow}
            applyPendingCellValues={applyPendingCellValues}
            clearRecommendedActionTransientIfFilled={clearRecommendedActionTransientIfFilled}
            colOrder={colOrder}
            deleteRow={deleteRow}
            detectionOptions={detectionOptions}
            edit={edit}
            editorRef={editorRef}
            failureBlockMergeInfo={failureBlockMergeInfo}
            failureModeMergeInfo={failureModeMergeInfo}
            getRiskColorFor={getRiskColorFor}
            handleCellKeyDown={handleCellKeyDown}
            highlightedMissingCells={highlightedMissingCells}
            isColumnVisible={isColumnVisible}
            isEditOwner={isEditOwner}
            materializePlaceholderRowForAdd={materializePlaceholderRowForAdd}
            mergeInfo={mergeInfo}
            occurrenceOptions={occurrenceOptions}
            readOnly={readOnly}
            rowHierarchyById={rowHierarchyById}
            rowsRef={rowsRef}
            setEdit={setEdit}
            setErr={setErr}
            setExpandedOperationId={setExpandedOperationId}
            setHighlightedMissingCells={setHighlightedMissingCells}
            setPendingCellValue={setPendingCellValue}
            severityOptions={severityOptions}
            startEditCell={startEditCell}
            tableRows={tableRows}
            updateCellWithDerived={updateCellWithDerived}
          />
        </PfmeaTableShell>
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


