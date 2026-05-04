'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabaseBrowser'
import { hasCustomerModuleAccess, loadOwnCustomerAccessMap } from '@/lib/customer-access'
import { isTimeoutError } from '@/lib/error-utils'
import { CLASS_OPTIONS, TdClassSelect } from '@/features/pfmea/pfmea-class-select-cell'
import {
  PFMEA_COLUMNS,
  PFMEA_COLUMNS_BY_ID,
  PFMEA_COLUMN_FILTER_GROUPS,
  PFMEA_EDITABLE_COLUMN_VISIBILITY,
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
  type PfdDiagramRow,
  type PfmeaEditorElement,
  type PfmeaRow,
  type ProjectView,
} from '@/features/pfmea/pfmea-types'
import { usePfmeaColumnVisibility } from '@/features/pfmea/use-pfmea-column-visibility'
import { usePfmeaDirtyDraftPersistence } from '@/features/pfmea/use-pfmea-dirty-draft-persistence'
import { usePfmeaPendingCellUpdateQueue } from '@/features/pfmea/use-pfmea-pending-cell-update-queue'
import { usePfmeaPendingCellValues } from '@/features/pfmea/use-pfmea-pending-cell-values'
import { usePfmeaRiskMatrixConfig } from '@/features/pfmea/use-pfmea-risk-matrix-config'
import { usePfmeaScaleOptions } from '@/features/pfmea/use-pfmea-scale-options'
import { usePfmeaStickyMergedCellTop } from '@/features/pfmea/use-pfmea-sticky-merged-cell-top'
import { usePfmeaTransientTracking } from '@/features/pfmea/use-pfmea-transient-tracking'
import { SURFACE_RADIUS, SURFACE_TEXT, actionBtn } from '@/features/pfmea/pfmea-page-styles'
import {
  TdRead,
} from '@/features/pfmea/pfmea-merged-cell'
import { asInt1to10, calcRpn, computeDerived } from '@/features/pfmea/pfmea-risk-utils'
import { colorFill, type RiskColor } from '@/features/pfmea/pfmea-risk-matrix-config'
import {
  hasFailureModeContext,
  hasPfmeaTextValue,
  isCauseContinuationEmpty,
  isEffectContinuationEmpty,
  isFailureModeContinuationEmpty,
  isRecommendedActionContinuationEmpty,
  patchHasAnyValue,
} from '@/features/pfmea/pfmea-continuation-utils'
import { normalizeHistoryText } from '@/features/pfmea/pfmea-display-utils'
import { getPreviousRequiredFieldForActionPlan } from '@/features/pfmea/pfmea-action-validation-utils'
import {
  buildPfmeaBlockMergeInfoByHierarchy,
  buildPfmeaHierarchy,
  createPfmeaGroupIds,
  isPlaceholderRowId,
  normalizePfmeaGroupId,
  normalizePfmeaRowNo,
  parsePfmeaRowNo,
  pickPfmeaGroupIds,
  samePfmeaGroupValue,
  type PfmeaRowHierarchy,
} from '@/features/pfmea/pfmea-hierarchy-utils'
import {
  buildPfmeaStableOrderMetadata,
  buildPfmeaRowsWithStableOrderMetadata,
  getPfmeaRowOperationId,
  getPfmeaRowOperationIds,
  insertPfmeaRowAfterAnchor,
  insertPfmeaRowAtSortIndex,
  reindexPfmeaRows,
  sortPfmeaRows,
} from '@/features/pfmea/pfmea-row-order-utils'
import { getPfmeaPcpAutoReasons, isPfmeaSelectedForPcp } from '@/features/pfmea/pfmea-pcp-utils'
import {
  getOperationNodeIdsFromDiagram,
  opGroupKeyFromOperation,
  opGroupKeyFromRow,
  opQualityScore,
} from '@/features/pfmea/pfmea-operation-utils'
import {
  findEquivalentPfmeaRow,
  findEquivalentPublishedPfmeaRow,
} from '@/features/pfmea/pfmea-row-match-utils'
import { normalizeClassValue, normalizePfmeaPcpValue } from '@/features/pfmea/pfmea-value-utils'
import { hydratePfmeaGroupIds } from '@/features/pfmea/pfmea-row-normalization-utils'
import { makeEmptyPfmeaPayload, makePlaceholderRow } from '@/features/pfmea/pfmea-row-factory-utils'
import { createPfmeaSaveTimer, formatPfmeaSaveTimings } from '@/features/pfmea/pfmea-save-timing-utils'
import { parsePfmeaPublishResult } from '@/features/pfmea/pfmea-publish-utils'
import {
  PFMEA_CLONE_FIELDS,
  PFMEA_CLONE_FIELDS_LEGACY,
  PFMEA_SELECT_FIELDS,
  PFMEA_SELECT_FIELDS_LEGACY,
  buildPfmeaPublishedMetadataPatch,
  isMissingPfmeaGroupIdColumnError,
  stripPfmeaGroupIdsFromPayload,
  summarizePfmeaRowsForError,
} from '@/features/pfmea/pfmea-payload-utils'
import {
  cleanupPfmeaDraftRowsAfterPublish,
  deletePfmeaEditSession,
  deletePfmeaRowsByRevision,
  ensurePfmeaProcessDraft,
  fetchPfmeaAuthorName,
  fetchPfmeaCurrentDraftRevisionId,
  fetchPfmeaEditSession,
  fetchPfmeaProjectRole,
  fetchPfmeaRowsForRevision,
  fetchPfmeaProjectView,
  fetchPfmeaRevisionHistory,
  insertPfmeaHistoryFallback,
  persistPfmeaDirtyRevisionRows,
  persistPfmeaRowOrderMetadata,
  publishPfmeaRevisionWithHistory,
  restorePfmeaRowsSnapshotToRevision,
  startPfmeaEditSession,
  type PfmeaRowOrderUpdate,
  type PfmeaEditSession,
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

  const [userId, setUserId] = useState<string | null>(null)
  const [moduleAccessState, setModuleAccessState] = useState<'checking' | 'allowed' | 'denied'>('checking')

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
  const [currentAuthorName, setCurrentAuthorName] = useState('Unknown user')
  const [isChampion, setIsChampion] = useState(false)
  const [editSession, setEditSession] = useState<PfmeaEditSession | null>(null)
  const [sessionNow, setSessionNow] = useState(() => Date.now())
  const [sessionBusy, setSessionBusy] = useState(false)
  const [expandedOperationId, setExpandedOperationId] = useState<string | null>(null)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
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

  const isObsolete = (project?.status ?? 'DRAFT') === 'OBSOLETE'
  const sessionExpired = useMemo(() => {
    if (!editSession) return false
    const last = new Date(editSession.lastActivityAt).getTime()
    if (!Number.isFinite(last)) return true
    return sessionNow - last >= EDIT_LOCK_MS
  }, [editSession, sessionNow])
  const isEditOwner = !!userId && !!editSession && editSession.lockedBy === userId && !sessionExpired
  const isLockedByOther = !!editSession && !isEditOwner && !sessionExpired
  const readOnly = isObsolete || !isEditOwner
  const activeDraftRevisionId = draftRevisionIdOverride ?? project?.current_draft_revision_id ?? null
  const workingRevisionId = isEditOwner
    ? activeDraftRevisionId ?? project?.current_open_revision_id ?? null
    : project?.current_open_revision_id ?? activeDraftRevisionId
  const workingRevisionLabel = isEditOwner
    ? project?.draft_revision_label ?? project?.open_revision_label
    : project?.open_revision_label ?? project?.draft_revision_label

  useEffect(() => {
    if (!highlightedMissingCells || highlightedMissingCells.length === 0) return
    const clearHighlights = () => setHighlightedMissingCells(null)
    document.addEventListener('mousedown', clearHighlights)
    return () => document.removeEventListener('mousedown', clearHighlights)
  }, [highlightedMissingCells])

  /* ---------- auth user ---------- */
useEffect(() => {
  let alive = true

  ;(async () => {
    const { data } = await supabase.auth.getSession()
    if (!alive) return

    if (!data.session) {
      const next =
        window.location.pathname + window.location.search

      window.location.assign(
        `/login?next=${encodeURIComponent(next)}`
      )
      return
    }

    setUserId(data.session.user.id)
  })()

  return () => {
    alive = false
  }
}, [])

  useEffect(() => {
    let alive = true

    void (async () => {
      if (!projectId || !userId) return

      const headerRes = await supabase.rpc('get_my_header').maybeSingle()
      const header = (headerRes.data as { org_role?: string | null } | null) ?? null
      const role = (header?.org_role ?? '').toLowerCase()

      if (role !== 'customer') {
        if (alive) setModuleAccessState('allowed')
        return
      }

      try {
        const accessMap = await loadOwnCustomerAccessMap(userId, [projectId])
        const canReadPfmea = hasCustomerModuleAccess(accessMap, projectId, 'PFMEA')
        if (!alive) return

        if (!canReadPfmea) {
          setModuleAccessState('denied')
          window.location.assign('/projects')
          return
        }

        setModuleAccessState('allowed')
      } catch {
        if (!alive) return
        setModuleAccessState('denied')
        window.location.assign('/projects')
      }
    })()

    return () => {
      alive = false
    }
  }, [projectId, userId])

  useEffect(() => {
    let alive = true
    if (!userId) {
      setCurrentAuthorName('Unknown user')
      return () => {
        alive = false
      }
    }

    ;(async () => {
      try {
        const authorName = await fetchPfmeaAuthorName(supabase, userId)
        if (!alive) return
        setCurrentAuthorName(authorName)
      } catch {
        if (!alive) return
        setCurrentAuthorName('Unknown user')
      }
    })()

    return () => {
      alive = false
    }
  }, [userId])

  const loadUserContext = useCallback(async () => {
    if (!projectId || !userId) {
      setIsChampion(false)
      return
    }
    try {
      const role = (await fetchPfmeaProjectRole(supabase, projectId, userId) ?? '').toLowerCase()
      setIsChampion(role === 'champion')
    } catch {
      setIsChampion(false)
    }
  }, [projectId, userId])

  const loadEditSession = useCallback(async () => {
    if (!projectId) {
      setEditSession(null)
      return
    }
    try {
      setEditSession(await fetchPfmeaEditSession(supabase, projectId))
    } catch {
      setEditSession(null)
    }
  }, [projectId])

  async function startEditSession() {
    if (!projectId || !userId || isObsolete) return
    setSessionBusy(true)
    setErr('')
    resetPfmeaEditRuntimeState()
    try {
      const sessionStart = await startPfmeaEditSession(supabase, {
        draftRevisionIdOverride,
        editLockMs: EDIT_LOCK_MS,
        hasExistingDraftRevision: !!(project?.current_draft_revision_id ?? draftRevisionIdOverride),
        isChampion,
        nowMs: sessionNow,
        projectId,
        userId,
      })

      if (sessionStart.blocked) {
        setErr(sessionStart.message)
        forceRefreshExistingDraftFromOpenRef.current = false
        return
      }

      forceRefreshExistingDraftFromOpenRef.current = sessionStart.shouldRefreshExistingDraftFromOpen
      if (sessionStart.draftRowsDeleted) {
        setDraftRevisionIdOverride(null)
        setDirtyPfmeaIds([])
        setDeletedPfmeaIds([])
        clearDirtyDraftPersisted()
      }

      const refreshedView = sessionStart.projectView
      setProject(refreshedView as any)

      const refreshedDraftRevisionId = sessionStart.draftRevisionId
      const refreshedOpenRevisionId = sessionStart.openRevisionId

      const hydrateDraftRowsFromOpen = async () => {
        if (!refreshedDraftRevisionId || !refreshedOpenRevisionId || refreshedDraftRevisionId === refreshedOpenRevisionId) return

        await deletePfmeaRowsByRevision(supabase, refreshedDraftRevisionId)

        const loadSourceRows = async () => {
          const sourceSelect =
            pfmeaGroupIdsSupportedRef.current === false ? PFMEA_CLONE_FIELDS_LEGACY.join(',') : PFMEA_CLONE_FIELDS.join(',')

          let sourceRowsRes = await supabase
            .from('pfmea_rows')
            .select(sourceSelect)
            .eq('revision_id', refreshedOpenRevisionId)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })

          if (sourceRowsRes.error && isMissingPfmeaGroupIdColumnError(sourceRowsRes.error)) {
            pfmeaGroupIdsSupportedRef.current = false
            sourceRowsRes = await supabase
              .from('pfmea_rows')
              .select(PFMEA_CLONE_FIELDS_LEGACY.join(','))
              .eq('revision_id', refreshedOpenRevisionId)
              .order('created_at', { ascending: true })
              .order('id', { ascending: true })
          } else if (!sourceRowsRes.error && pfmeaGroupIdsSupportedRef.current !== false) {
            pfmeaGroupIdsSupportedRef.current = true
          }

          if (sourceRowsRes.error) throw sourceRowsRes.error
          return (sourceRowsRes.data ?? []) as Array<Partial<PfmeaRow>>
        }

        const sourceRows = await loadSourceRows()
        if (sourceRows.length === 0) return

        const clonePayload = sourceRows.map((sourceRow) => {
          const clonedRow = { revision_id: refreshedDraftRevisionId } as Partial<PfmeaRow> & { revision_id: string }
          for (const field of PFMEA_CLONE_FIELDS) {
            ;(clonedRow as any)[field] = sourceRow[field] ?? null
          }
          return clonedRow
        })

        const insertPayload =
          pfmeaGroupIdsSupportedRef.current === false
            ? clonePayload.map((row) => stripPfmeaGroupIdsFromPayload(row as Record<string, unknown>))
            : clonePayload

        const cloneInsertRes = await supabase.from('pfmea_rows').insert(insertPayload)
        if (cloneInsertRes.error) throw cloneInsertRes.error
      }

      await hydrateDraftRowsFromOpen()
      if (refreshedDraftRevisionId) {
        setDraftRevisionIdOverride(refreshedDraftRevisionId)
      }

      await loadEditSession()
      await loadAll(refreshedDraftRevisionId ?? refreshedOpenRevisionId)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSessionBusy(false)
    }
  }

  async function discardDraftAndCloseSession() {
    if (!projectId || !userId || !isEditOwner) return
    setSessionBusy(true)
    setErr('')
    resetPfmeaEditRuntimeState()
    try {
      const draftId = await fetchPfmeaCurrentDraftRevisionId(supabase, projectId) ?? draftRevisionIdOverride
      if (draftId) await deletePfmeaRowsByRevision(supabase, draftId)
      await deletePfmeaEditSession(supabase, projectId, userId)
      setDraftRevisionIdOverride(null)
      setDirtyPfmeaIds([])
      setDeletedPfmeaIds([])
      clearDirtyDraftPersisted()
      await loadEditSession()
      await loadAll()
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSessionBusy(false)
    }
  }

  /* ---------- helper: reload only project view ---------- */
  const loadProjectView = useCallback(async (options?: { syncDraftOverride?: boolean }) => {
    const view = await fetchPfmeaProjectView(supabase, projectId)
    setProject(view as any)
    if (options?.syncDraftOverride === true && view.current_draft_revision_id) {
      setDraftRevisionIdOverride(view.current_draft_revision_id)
    }
    return view
  }, [projectId])

  /* ---------- helper: ensure draft exists before making changes ---------- */
  const ensureDraftIfNeeded = useCallback(async () => {
    if (!projectId) return null
    if (!userId) throw new Error('Not authenticated.')
    if (!isEditOwner) throw new Error('Click "Edit PFMEA" to start an edit session.')
    const sourceRevisionIdBeforeDraft = project?.current_open_revision_id ?? workingRevisionId ?? null

    const ensureDraftRowsHydrated = async (
      draftRevisionId: string | null,
      sourceRevisionId: string | null,
      options?: { replaceExisting?: boolean }
    ) => {
      if (!draftRevisionId || !sourceRevisionId || draftRevisionId === sourceRevisionId) return

      const existingDraftRowsRes = await supabase
        .from('pfmea_rows')
        .select('id')
        .eq('revision_id', draftRevisionId)
        .limit(1)

      if (existingDraftRowsRes.error) throw existingDraftRowsRes.error
      const hasExistingDraftRows = (existingDraftRowsRes.data?.length ?? 0) > 0
      if (hasExistingDraftRows && !options?.replaceExisting) return
      if (hasExistingDraftRows && options?.replaceExisting) {
        await deletePfmeaRowsByRevision(supabase, draftRevisionId)
      }

      const openRowsRes = await supabase
        .from('pfmea_rows')
        .select((pfmeaGroupIdsSupportedRef.current === false ? PFMEA_CLONE_FIELDS_LEGACY : PFMEA_CLONE_FIELDS).join(','))
        .eq('revision_id', sourceRevisionId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      let sourceRows: Array<Partial<PfmeaRow>> = []
      if (openRowsRes.error && isMissingPfmeaGroupIdColumnError(openRowsRes.error)) {
        pfmeaGroupIdsSupportedRef.current = false
        const legacyOpenRowsRes = await supabase
          .from('pfmea_rows')
          .select(PFMEA_CLONE_FIELDS_LEGACY.join(','))
          .eq('revision_id', sourceRevisionId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
        if (legacyOpenRowsRes.error) throw legacyOpenRowsRes.error
        sourceRows = (legacyOpenRowsRes.data ?? []) as Array<Partial<PfmeaRow>>
      } else {
        if (openRowsRes.error) throw openRowsRes.error
        pfmeaGroupIdsSupportedRef.current = true
        sourceRows = (openRowsRes.data ?? []) as Array<Partial<PfmeaRow>>
      }
      if (sourceRows.length === 0) {
        sourceRows = rowsRef.current.map((row) => {
          const sourceRow = {} as Partial<PfmeaRow>
          for (const field of PFMEA_CLONE_FIELDS) {
            sourceRow[field] = row[field] as never
          }
          return sourceRow
        })
      }
      if (sourceRows.length === 0) return

      const clonePayload = sourceRows.map((sourceRow) => {
        const clonedRow = { revision_id: draftRevisionId } as Partial<PfmeaRow> & { revision_id: string }
        for (const field of PFMEA_CLONE_FIELDS) {
          ;(clonedRow as any)[field] = sourceRow[field] ?? null
        }
        return clonedRow
      })

      const insertClonePayload =
        pfmeaGroupIdsSupportedRef.current === false
          ? clonePayload.map((row) => stripPfmeaGroupIdsFromPayload(row as Record<string, unknown>))
          : clonePayload

      const insertCloneRes = await supabase.from('pfmea_rows').insert(insertClonePayload)
      if (insertCloneRes.error) throw insertCloneRes.error
    }

    const hasVisibleRowsFromCurrentDraft =
      !!(project?.current_draft_revision_id || draftRevisionIdOverride) &&
      rowsRef.current.some(
        (row) =>
          !isPlaceholderRowId(row.id) &&
          row.revision_id === (draftRevisionIdOverride ?? project?.current_draft_revision_id ?? null)
      )
    const shouldRefreshExistingDraftFromOpen =
      !!project?.current_open_revision_id &&
      !!(draftRevisionIdOverride ?? project?.current_draft_revision_id) &&
      (
        forceRefreshExistingDraftFromOpenRef.current ||
        (!persistedDirtyDraft && !hasVisibleRowsFromCurrentDraft)
      )

    if (draftRevisionIdOverride) {
      await ensureDraftRowsHydrated(draftRevisionIdOverride, project?.current_open_revision_id ?? sourceRevisionIdBeforeDraft, {
        replaceExisting: shouldRefreshExistingDraftFromOpen,
      })
      forceRefreshExistingDraftFromOpenRef.current = false
      return draftRevisionIdOverride
    }
    // if draft already exists -> ensure it contains a cloned snapshot from OPEN
    if (project?.current_draft_revision_id) {
      await ensureDraftRowsHydrated(project.current_draft_revision_id, project.current_open_revision_id ?? sourceRevisionIdBeforeDraft, {
        replaceExisting: shouldRefreshExistingDraftFromOpen,
      })
      forceRefreshExistingDraftFromOpenRef.current = false
      return project.current_draft_revision_id
    }

    // if project is obsolete -> no draft changes
    if ((project?.status ?? 'DRAFT') === 'OBSOLETE') throw new Error('Process is OBSOLETE (read-only).')

    const ensuredDraftId = await ensurePfmeaProcessDraft(supabase, projectId, userId)
    // refresh project to get current_draft_revision_id
    const pv = await loadProjectView({ syncDraftOverride: false })
    const ensured = pv.current_draft_revision_id ?? ensuredDraftId
    await ensureDraftRowsHydrated(ensured, pv.current_open_revision_id ?? sourceRevisionIdBeforeDraft)
    forceRefreshExistingDraftFromOpenRef.current = false
    if (ensured) setDraftRevisionIdOverride(ensured)
    return ensured
  }, [projectId, userId, isEditOwner, draftRevisionIdOverride, project?.current_draft_revision_id, project?.status, loadProjectView, workingRevisionId, project?.current_open_revision_id, persistedDirtyDraft, rowsRef])

  /* ---------- load project / operations / rows ---------- */
  const loadAll = useCallback(async (forceRevisionId?: string | null) => {
    if (!projectId) return
    setErr('')

    try {
      const fetchPfmeaRowsForRevision = async (revisionId: string) => {
        const selectFields = pfmeaGroupIdsSupportedRef.current === false ? PFMEA_SELECT_FIELDS_LEGACY : PFMEA_SELECT_FIELDS
        let response = await supabase
          .from('pfmea_rows')
          .select(selectFields)
          .eq('operations.project_id', projectId)
          .eq('revision_id', revisionId)
          .order('operation_number', { foreignTable: 'operations', ascending: true })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })

        if (response.error && isMissingPfmeaGroupIdColumnError(response.error)) {
          pfmeaGroupIdsSupportedRef.current = false
          response = await supabase
            .from('pfmea_rows')
            .select(PFMEA_SELECT_FIELDS_LEGACY)
            .eq('operations.project_id', projectId)
            .eq('revision_id', revisionId)
            .order('operation_number', { foreignTable: 'operations', ascending: true })
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
        } else if (!response.error && pfmeaGroupIdsSupportedRef.current !== false) {
          pfmeaGroupIdsSupportedRef.current = true
        }

        if (response.error) throw response.error
        return (response.data ?? []) as unknown as PfmeaRow[]
      }

      const [pv, pfdDiagRes] = await Promise.all([
        loadProjectView(),
        supabase.from('pfd_diagrams').select('nodes').eq('project_id', projectId).maybeSingle(),
        loadRiskMatrix(),
        loadScaleOptions(),
      ])

      const diagramOperationIds =
        pfdDiagRes.error ? new Set<string>() : getOperationNodeIdsFromDiagram((pfdDiagRes.data ?? null) as PfdDiagramRow | null)
      const useDiagramOperationFilter = diagramOperationIds.size > 0

      const opsRes = await supabase
        .from('operations')
        .select('id,project_id,operation_number,name,machine,operation,active')
        .eq('project_id', projectId)
        .eq('active', true)
        .order('operation_number', { ascending: true })

      if (opsRes.error) throw opsRes.error

      const operations = ((opsRes.data ?? []) as Operation[]).filter((op) => !useDiagramOperationFilter || diagramOperationIds.has(op.id))
      setOps(operations)
      if (!isEditOwner && !forceRevisionId && draftRevisionIdOverride && pv.current_open_revision_id) {
        setDraftRevisionIdOverride(null)
      }
      // owner sees own draft; others see latest published (OPEN)
      const openRevId = pv.current_open_revision_id ?? null
      const draftRevId = draftRevisionIdOverride ?? pv.current_draft_revision_id ?? null
      let revId = forceRevisionId ?? null
      if (!revId) {
        revId = isEditOwner ? draftRevId ?? openRevId : openRevId ?? draftRevId
      }

      // If no revision exists yet (rare), show empty
      if (!revId) {
        clearPfmeaTransientTracking()
        rowsRef.current = []
        setRows([])
        return
      }

      let pfmeaRows = await fetchPfmeaRowsForRevision(revId)
      if (useDiagramOperationFilter) {
        pfmeaRows = pfmeaRows.filter((row) => {
          const opId = row.operation_id || row.operations?.id || ''
          return !!opId && diagramOperationIds.has(opId)
        })
      }

      if (pfmeaRows.length === 0 && isEditOwner && draftRevId && revId === draftRevId && openRevId && openRevId !== draftRevId) {
        try {
          pfmeaRows = await fetchPfmeaRowsForRevision(openRevId)
          if (useDiagramOperationFilter) {
            pfmeaRows = pfmeaRows.filter((row) => {
              const opId = row.operation_id || row.operations?.id || ''
              return !!opId && diagramOperationIds.has(opId)
            })
          }
        } catch {}
        if (pfmeaRows.length > 0) {
          // rows already assigned above
        }
      }

      // Fallback: if current/open revision has no rows, but PFMEA rows exist on another revision,
      // load that revision so user does not see an empty table despite persisted data.
      if (pfmeaRows.length === 0) {
        const latestRevRes = await supabase
          .from('pfmea_rows')
          .select('revision_id,created_at,operations!inner(project_id,active)')
          .eq('operations.project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1)

        if (!latestRevRes.error) {
          const fallbackRevisionId =
            (((latestRevRes.data ?? [])[0] as { revision_id?: string | null } | undefined)?.revision_id ?? '').trim() || null

          if (fallbackRevisionId && fallbackRevisionId !== revId) {
            try {
              pfmeaRows = await fetchPfmeaRowsForRevision(fallbackRevisionId)
              if (useDiagramOperationFilter) {
                pfmeaRows = pfmeaRows.filter((row) => {
                  const opId = row.operation_id || row.operations?.id || ''
                  return !!opId && diagramOperationIds.has(opId)
                })
              }
              if (pfmeaRows.length > 0 && isEditOwner) {
                setDraftRevisionIdOverride(fallbackRevisionId)
              }
            } catch {}
          }
        }
      }

      clearPfmeaTransientTracking()
      const nextRows = reindexPfmeaRows(hydratePfmeaGroupIds(pfmeaRows))
      rowsRef.current = nextRows
      setRows(nextRows)

      if (opFromUrl) {
        const exists = operations.some((o) => o.id === opFromUrl)
        if (exists) {
          setDraft({ operation_id: opFromUrl })
          return
        }
      }

      if (!draft.operation_id && operations.length > 0) {
        setDraft({ operation_id: operations[0].id })
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }, [projectId, isEditOwner, draftRevisionIdOverride, loadProjectView, loadRiskMatrix, loadScaleOptions, clearPfmeaTransientTracking, opFromUrl, draft.operation_id, rowsRef])

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
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    if (moduleAccessState !== 'allowed') return
    void loadUserContext()
    void loadEditSession()
  }, [projectId, loadUserContext, loadEditSession, moduleAccessState])

  useEffect(() => {
    if (!projectId) return
    if (moduleAccessState !== 'allowed') return
    const timer = setInterval(() => {
      void loadEditSession()
      setSessionNow(Date.now())
    }, 30_000)
    return () => clearInterval(timer)
  }, [projectId, loadEditSession, moduleAccessState])

  useEffect(() => {
    if (!projectId || !userId || !isEditOwner) return
    const beat = async () => {
      await supabase
        .from('pfmea_edit_sessions')
        .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('project_id', projectId)
        .eq('locked_by', userId)
    }
    const timer = setInterval(() => {
      void beat()
    }, 30_000)
    return () => clearInterval(timer)
  }, [projectId, userId, isEditOwner])

  useEffect(() => {
    if (!edit) return
    setTimeout(() => editorRef.current?.focus?.(), 0)
  }, [edit])

  useEffect(() => {
    const prev = previousEditRef.current
    previousEditRef.current = edit
    if (!prev) return
    if (edit && edit.rowId === prev.rowId) return
    const isCauseTransient = transientCauseContinuationIdsRef.current.has(prev.rowId)
    const isRecommendedActionTransient = transientRecommendedActionContinuationIdsRef.current.has(prev.rowId)
    const isFailureModeTransient = transientFailureModeContinuationIdsRef.current.has(prev.rowId)
    const isEffectTransient = transientEffectContinuationIdsRef.current.has(prev.rowId)
    if (!isCauseTransient && !isRecommendedActionTransient && !isFailureModeTransient && !isEffectTransient) return

    const transientRow = rowsRef.current.find((row) => row.id === prev.rowId)
    if (!transientRow) return
    const effectiveTransientRow = applyPendingCellValues(transientRow)
    const shouldDelete = isCauseTransient
      ? isCauseContinuationEmpty(effectiveTransientRow)
      : isRecommendedActionTransient
        ? isRecommendedActionContinuationEmpty(effectiveTransientRow)
        : isFailureModeTransient
          ? isFailureModeContinuationEmpty(effectiveTransientRow)
          : isEffectContinuationEmpty(effectiveTransientRow)
    if (!shouldDelete) return

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
    const transientIds = new Set<string>([
      ...transientCauseContinuationIdsRef.current,
      ...transientRecommendedActionContinuationIdsRef.current,
      ...transientFailureModeContinuationIdsRef.current,
      ...transientEffectContinuationIdsRef.current,
    ])
    if (transientIds.size === 0) return rowsRef.current

    const rowsById = new Map(rowsRef.current.map((row) => [row.id, row] as const))
    const idsToDelete: string[] = []

    for (const id of transientIds) {
      const row = rowsById.get(id)
      if (!row) continue
      const effectiveRow = applyPendingCellValues(row)
      const shouldDelete = transientCauseContinuationIdsRef.current.has(id)
        ? isCauseContinuationEmpty(effectiveRow)
        : transientRecommendedActionContinuationIdsRef.current.has(id)
          ? isRecommendedActionContinuationEmpty(effectiveRow)
          : transientFailureModeContinuationIdsRef.current.has(id)
            ? isFailureModeContinuationEmpty(effectiveRow)
            : transientEffectContinuationIdsRef.current.has(id)
              ? isEffectContinuationEmpty(effectiveRow)
              : false
      if (shouldDelete) idsToDelete.push(id)
    }

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
    setHoveredRowId((prev) => (prev && idsToDeleteSet.has(prev) ? null : prev))
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
            setHoveredRowId((prev) => (prev === id ? null : prev))
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
    const visibleRows = tableRows.filter((item) => {
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

  function getCauseContinuationSourceRow(row: PfmeaRow) {
    const effectiveRow = applyPendingCellValues(row)
    if ((effectiveRow.effect ?? '').trim() && asInt1to10(effectiveRow.severity) != null) return effectiveRow

    const opId = effectiveRow.operation_id || effectiveRow.operations?.id || null
    const failureMode = (effectiveRow.failure_mode ?? '').trim()
    const failureModeGroupId = normalizePfmeaGroupId(effectiveRow.failure_mode_group_id)
    const failureBlockGroupId = normalizePfmeaGroupId(effectiveRow.failure_block_group_id)
    const failureBlockKey = parsePfmeaRowNo(effectiveRow.row_no)?.failureBlockKey ?? null
    const visibleRows = tableRows.filter((item) => {
      if (isPlaceholderRowId(item.id)) return false
      return (item.operation_id || item.operations?.id || null) === opId
    })

    const rowIndex = visibleRows.findIndex((item) => item.id === row.id)
    if (rowIndex < 0) return effectiveRow

    for (let i = rowIndex - 1; i >= 0; i -= 1) {
      const candidate = applyPendingCellValues(visibleRows[i])
      if (failureModeGroupId) {
        if (!samePfmeaGroupValue(candidate.failure_mode_group_id, failureModeGroupId)) break
      } else if ((candidate.failure_mode ?? '').trim() !== failureMode) {
        break
      }
      if (failureBlockGroupId) {
        if (!samePfmeaGroupValue(candidate.failure_block_group_id, failureBlockGroupId)) break
      } else if (failureBlockKey && parsePfmeaRowNo(candidate.row_no)?.failureBlockKey !== failureBlockKey) {
        break
      }
      if ((candidate.effect ?? '').trim() && asInt1to10(candidate.severity) != null) {
        return {
          ...candidate,
          cause: effectiveRow.cause,
          occurrence: effectiveRow.occurrence,
          current_prevention: effectiveRow.current_prevention,
          current_detection: effectiveRow.current_detection,
          detection: effectiveRow.detection,
        }
      }
    }

    return effectiveRow
  }

  function getRecommendedActionContinuationSourceRow(row: PfmeaRow) {
    const effectiveRow = applyPendingCellValues(row)
    const hasCurrentRiskBlock =
      !!(effectiveRow.effect ?? '').trim() &&
      asInt1to10(effectiveRow.severity) != null &&
      !!(effectiveRow.cause ?? '').trim() &&
      asInt1to10(effectiveRow.occurrence) != null &&
      !!(effectiveRow.current_prevention ?? '').trim() &&
      !!(effectiveRow.current_detection ?? '').trim() &&
      asInt1to10(effectiveRow.detection) != null

    if (hasCurrentRiskBlock) return effectiveRow

    const opId = effectiveRow.operation_id || effectiveRow.operations?.id || null
    const failureMode = (effectiveRow.failure_mode ?? '').trim()
    const failureModeGroupId = normalizePfmeaGroupId(effectiveRow.failure_mode_group_id)
    const failureBlockGroupId = normalizePfmeaGroupId(effectiveRow.failure_block_group_id)
    const actionPlanGroupId = normalizePfmeaGroupId(effectiveRow.action_plan_group_id)
    const visibleRows = tableRows.filter((item) => {
      if (isPlaceholderRowId(item.id)) return false
      return (item.operation_id || item.operations?.id || null) === opId
    })

    const rowIndex = visibleRows.findIndex((item) => item.id === row.id)
    if (rowIndex < 0) return effectiveRow

    for (let i = rowIndex - 1; i >= 0; i -= 1) {
      const candidate = applyPendingCellValues(visibleRows[i])
      if (failureModeGroupId) {
        if (!samePfmeaGroupValue(candidate.failure_mode_group_id, failureModeGroupId)) break
      } else if ((candidate.failure_mode ?? '').trim() !== failureMode) {
        break
      }
      if (failureBlockGroupId && !samePfmeaGroupValue(candidate.failure_block_group_id, failureBlockGroupId)) break
      if (actionPlanGroupId && !samePfmeaGroupValue(candidate.action_plan_group_id, actionPlanGroupId)) break

      const candidateHasCurrentRiskBlock =
        !!(candidate.effect ?? '').trim() &&
        asInt1to10(candidate.severity) != null &&
        !!(candidate.cause ?? '').trim() &&
        asInt1to10(candidate.occurrence) != null &&
        !!(candidate.current_prevention ?? '').trim() &&
        !!(candidate.current_detection ?? '').trim() &&
        asInt1to10(candidate.detection) != null

      if (candidateHasCurrentRiskBlock) {
        return {
          ...candidate,
          recommended_action: effectiveRow.recommended_action,
          responsible: effectiveRow.responsible,
          target_date: effectiveRow.target_date,
          action_status: effectiveRow.action_status,
          occurrence2: effectiveRow.occurrence2,
          detection2: effectiveRow.detection2,
        }
      }
    }

    return effectiveRow
  }

  function computePfmeaDerivedFromContext(row: PfmeaRow) {
    const effectiveRow = applyPendingCellValues(row)
    const currentRiskRow = getCauseContinuationSourceRow(effectiveRow)
    const currentRisk = calcRpn(currentRiskRow.severity, currentRiskRow.occurrence, currentRiskRow.detection)
    const residualRisk = calcRpn(currentRiskRow.severity, effectiveRow.occurrence2, effectiveRow.detection2)
    const isClosed = (effectiveRow.action_status ?? '').toUpperCase() === 'CLOSED'

    return {
      currentRisk,
      residualRisk,
      derived: {
        rpn: currentRisk.rpn ?? null,
        oxd: currentRisk.doVal ?? null,
        rpn2: residualRisk.rpn ?? null,
        oxd2: residualRisk.doVal ?? null,
        rpn_current: (isClosed ? residualRisk.rpn : currentRisk.rpn) ?? null,
        oxd_current: (isClosed ? residualRisk.doVal : currentRisk.doVal) ?? null,
      } as Pick<PfmeaRow, 'rpn' | 'oxd' | 'rpn2' | 'oxd2' | 'rpn_current' | 'oxd_current'>,
    }
  }

  function getFailureBlockSourceRowAtIndex(rowIndex: number) {
    const effectiveRow = applyPendingCellValues(tableRows[rowIndex] ?? ({} as PfmeaRow))
    if ((effectiveRow.effect ?? '').trim() && asInt1to10(effectiveRow.severity) != null) return effectiveRow

    const opId = effectiveRow.operation_id || effectiveRow.operations?.id || null
    const failureMode = (effectiveRow.failure_mode ?? '').trim()
    const failureModeGroupId = normalizePfmeaGroupId(effectiveRow.failure_mode_group_id)
    const failureBlockGroupId = normalizePfmeaGroupId(effectiveRow.failure_block_group_id)
    const failureBlockKey = parsePfmeaRowNo(effectiveRow.row_no)?.failureBlockKey ?? null
    for (let i = rowIndex - 1; i >= 0; i -= 1) {
      const candidate = applyPendingCellValues(tableRows[i] ?? ({} as PfmeaRow))
      if ((candidate.operation_id || candidate.operations?.id || null) !== opId) break
      if (failureModeGroupId) {
        if (!samePfmeaGroupValue(candidate.failure_mode_group_id, failureModeGroupId)) break
      } else if ((candidate.failure_mode ?? '').trim() !== failureMode) {
        break
      }
      if (failureBlockGroupId) {
        if (!samePfmeaGroupValue(candidate.failure_block_group_id, failureBlockGroupId)) break
      } else if (failureBlockKey && parsePfmeaRowNo(candidate.row_no)?.failureBlockKey !== failureBlockKey) {
        break
      }
      if ((candidate.effect ?? '').trim() && asInt1to10(candidate.severity) != null) return candidate
    }

    return effectiveRow
  }

  async function addCauseContinuationRow(row: PfmeaRow, anchorRow: PfmeaRow = row) {
    if (readOnly || isPlaceholderRowId(row.id)) return
    setErr('')

    try {
      const effectiveRow = applyPendingCellValues(row)
      const sourceRow = getCauseContinuationSourceRow(row)
      if (!hasPfmeaTextValue(effectiveRow.cause)) {
        setEdit({ rowId: row.id, col: 'cause' })
        return
      }

      const revId = await ensureDraftIfNeeded()
      const finalRev = revId ?? workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const opId = row.operation_id || row.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(anchorRow)

      const payload = {
        ...makeEmptyPfmeaPayload(
          row.operation_id,
          finalRev,
          createPfmeaGroupIds({
            failure_mode_group_id: sourceRow.failure_mode_group_id ?? undefined,
            failure_block_group_id: sourceRow.failure_block_group_id ?? undefined,
          })
        ),
        failure_mode: sourceRow.failure_mode,
        effect: sourceRow.effect,
        severity: asInt1to10(sourceRow.severity),
        characteristic: sourceRow.characteristic,
        class: normalizeClassValue(sourceRow.class),
        created_at: insertedCreatedAt,
      }

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
      setRows((prev) => {
        const nextRow = {
          ...sourceRow,
          ...payload,
          id: newId,
          revision_id: finalRev,
          created_at: insertedCreatedAt,
          __sortIndex: anchorRow.__sortIndex,
        } as PfmeaRow
        return insertPfmeaRowAfterAnchor(prev, anchorRow.id, nextRow)
      })
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

      const opId = row.operation_id || row.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(anchorRow)

      const payload = {
        ...makeEmptyPfmeaPayload(row.operation_id, finalRev),
        created_at: insertedCreatedAt,
      }

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
      setRows((prev) => {
        const nextRow = {
          ...row,
          ...payload,
          id: newId,
          revision_id: finalRev,
          created_at: insertedCreatedAt,
          __sortIndex: anchorRow.__sortIndex,
        } as PfmeaRow
        return insertPfmeaRowAfterAnchor(prev, anchorRow.id, nextRow)
      })
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

      const opId = row.operation_id || row.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(anchorRow)

      const payload = {
        ...makeEmptyPfmeaPayload(
          row.operation_id,
          finalRev,
          createPfmeaGroupIds({
            failure_mode_group_id: effectiveRow.failure_mode_group_id ?? undefined,
          })
        ),
        failure_mode: effectiveRow.failure_mode,
        characteristic: effectiveRow.characteristic,
        class: normalizeClassValue(effectiveRow.class),
        created_at: insertedCreatedAt,
      }

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
      setRows((prev) => {
        const nextRow = {
          ...row,
          ...payload,
          id: newId,
          revision_id: finalRev,
          created_at: insertedCreatedAt,
          __sortIndex: anchorRow.__sortIndex,
        } as PfmeaRow
        return insertPfmeaRowAfterAnchor(prev, anchorRow.id, nextRow)
      })
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
      const sourceRow = getRecommendedActionContinuationSourceRow(row)
      if (!hasPfmeaTextValue(effectiveRow.recommended_action)) {
        setEdit({ rowId: row.id, col: 'recommended_action' })
        return
      }

      const revId = await ensureDraftIfNeeded()
      const finalRev = revId ?? workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const opId = row.operation_id || row.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(anchorRow)

      const payload = {
        ...makeEmptyPfmeaPayload(
          row.operation_id,
          finalRev,
          createPfmeaGroupIds({
            failure_mode_group_id: sourceRow.failure_mode_group_id ?? undefined,
            failure_block_group_id: sourceRow.failure_block_group_id ?? undefined,
            action_plan_group_id: sourceRow.action_plan_group_id ?? undefined,
          })
        ),
        failure_mode: sourceRow.failure_mode,
        effect: sourceRow.effect,
        severity: asInt1to10(sourceRow.severity),
        characteristic: sourceRow.characteristic,
        class: normalizeClassValue(sourceRow.class),
        cause: sourceRow.cause,
        occurrence: asInt1to10(sourceRow.occurrence),
        current_prevention: sourceRow.current_prevention,
        current_detection: sourceRow.current_detection,
        detection: asInt1to10(sourceRow.detection),
        ...computeDerived({
          ...sourceRow,
          recommended_action: '',
          responsible: '',
          target_date: null,
          action_status: '',
          occurrence2: null,
          detection2: null,
        } as PfmeaRow),
        created_at: insertedCreatedAt,
      }

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
      setRows((prev) => {
        const nextRow = {
          ...sourceRow,
          ...payload,
          id: newId,
          revision_id: finalRev,
          created_at: insertedCreatedAt,
          __sortIndex: anchorRow.__sortIndex,
        } as PfmeaRow
        return insertPfmeaRowAfterAnchor(prev, anchorRow.id, nextRow)
      })
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

  const fetchPfmeaRowsForRevisionScope = useCallback(async (revisionId: string, operationIds?: string[]) => {
    const result = await fetchPfmeaRowsForRevision<PfmeaRow>(supabase, {
      groupIdsSupported: pfmeaGroupIdsSupportedRef.current,
      operationIds,
      revisionId,
    })
    pfmeaGroupIdsSupportedRef.current = result.groupIdsSupported
    return hydratePfmeaGroupIds(result.rows)
  }, [])

  async function remapPfmeaSnapshotRowsToRevision(revisionId: string, sourceRows: PfmeaRow[]) {
    const snapshotRows = sortPfmeaRows(sourceRows).filter((row) => !isPlaceholderRowId(row.id))
    if (!revisionId || snapshotRows.length === 0) return snapshotRows

    const operationIds = getPfmeaRowOperationIds(snapshotRows)
    const revisionRows = await fetchPfmeaRowsForRevisionScope(revisionId, operationIds)
    const revisionRowsById = new Map(revisionRows.map((row) => [row.id, row] as const))
    const usedIds = new Set<string>()
    const missingRows: PfmeaRow[] = []

    const mappedRows = snapshotRows
      .map((sourceRow) => {
        const directTarget = revisionRowsById.get(sourceRow.id)
        if (directTarget && !usedIds.has(directTarget.id)) {
          usedIds.add(directTarget.id)
          return {
            ...sourceRow,
            id: directTarget.id,
            revision_id: revisionId,
            operation_id: getPfmeaRowOperationId(directTarget) || getPfmeaRowOperationId(sourceRow),
            operations: directTarget.operations ?? sourceRow.operations,
          } as PfmeaRow
        }

        const inferredRowNo = normalizePfmeaRowNo(sourceRow.row_no)
        const rowForMapping =
          inferredRowNo && inferredRowNo !== sourceRow.row_no ? ({ ...sourceRow, row_no: inferredRowNo } as PfmeaRow) : sourceRow

        const candidate = findEquivalentPfmeaRow(
          revisionRows.filter((row) => !usedIds.has(row.id)),
          rowForMapping
        )

        if (!candidate) {
          missingRows.push(sourceRow)
          return null
        }

        usedIds.add(candidate.id)
        return {
          ...sourceRow,
          id: candidate.id,
          revision_id: revisionId,
          operation_id: getPfmeaRowOperationId(candidate) || getPfmeaRowOperationId(sourceRow),
          operations: candidate.operations ?? sourceRow.operations,
        } as PfmeaRow
      })
      .filter(Boolean) as PfmeaRow[]

    if (missingRows.length > 0) {
      throw new Error(
        `PFMEA draft integrity check failed. ${missingRows.length} row(s) could not be mapped into draft revision ${revisionId}: ${summarizePfmeaRowsForError(missingRows)}.`
      )
    }

    return mappedRows
  }

  async function restorePfmeaSnapshotToRevision(revisionId: string, sourceRows: PfmeaRow[]) {
    const result = await restorePfmeaRowsSnapshotToRevision<PfmeaRow>(supabase, {
      groupIdsSupported: pfmeaGroupIdsSupportedRef.current,
      revisionId,
      sourceRows,
    })
    pfmeaGroupIdsSupportedRef.current = result.groupIdsSupported
    return hydratePfmeaGroupIds(result.rows)
  }

  async function ensurePublishedPfmeaIntegrity(revisionId: string, sourceRows: PfmeaRow[]) {
    const snapshotRows = sortPfmeaRows(sourceRows).filter((row) => !isPlaceholderRowId(row.id))
    if (!revisionId || snapshotRows.length === 0) return null

    const operationIds = getPfmeaRowOperationIds(snapshotRows)
    if (operationIds.length === 0) return null

    const checkSnapshot = async () => {
      const publishedRows = await fetchPfmeaRowsForRevisionScope(revisionId, operationIds)
      const usedIds = new Set<string>()
      const missingRows = snapshotRows.filter((sourceRow) => {
        const candidate = findEquivalentPfmeaRow(
          publishedRows.filter((row) => !usedIds.has(row.id)),
          sourceRow
        )
        if (!candidate) return true
        usedIds.add(candidate.id)
        return false
      })
      return { missingRows, publishedRows }
    }

    let { missingRows } = await checkSnapshot()
    if (missingRows.length === 0) return null

    await restorePfmeaSnapshotToRevision(revisionId, snapshotRows)
    ;({ missingRows } = await checkSnapshot())

    if (missingRows.length > 0) {
      throw new Error(
        `PFMEA publish integrity check failed for revision ${revisionId}. ${missingRows.length} row(s) are still missing or changed after automatic restore: ${summarizePfmeaRowsForError(missingRows)}.`
      )
    }

    return 'PFMEA publish returned incomplete or changed data. The affected rows were automatically restored from a safety snapshot.'
  }

  async function persistPfmeaDraftSnapshot(revisionId: string, sourceRows: PfmeaRow[]) {
    const dirtyIdsBeforeRemap = new Set(dirtyPfmeaIds)
    const snapshotRows = sortPfmeaRows(sourceRows)
      .filter((row) => !isPlaceholderRowId(row.id))
      .map((row) => {
        const effectiveRow = applyPendingCellValues(row)
        const derived = computePfmeaDerivedFromContext(effectiveRow).derived
        return {
          ...effectiveRow,
          ...derived,
        } as PfmeaRow
      })

    if (snapshotRows.length === 0) return snapshotRows

    const mappedSnapshotRows = await remapPfmeaSnapshotRowsToRevision(revisionId, snapshotRows)
    await persistPfmeaDirtyRevisionRows<PfmeaRow>(supabase, {
      dirtyIds: dirtyIdsBeforeRemap,
      groupIdsSupported: pfmeaGroupIdsSupportedRef.current,
      mappedRows: mappedSnapshotRows,
      revisionId,
      sourceRows: snapshotRows,
    })

    rowsRef.current = mappedSnapshotRows
    setRows(mappedSnapshotRows)
    return mappedSnapshotRows
  }

  async function handleSaveRevision() {
    if (saveBusy) return
    setErr('')

    if (!isDirty) {
      setShowSave(false)
      return
    }

    const desc = changeDesc.trim()
    if (!desc) {
      setErr('Change description is required.')
      return
    }

    const saveTimer = createPfmeaSaveTimer()
    let saveTimingsLogged = false
    const logSaveTimings = (status: string) => {
      if (saveTimingsLogged) return
      saveTimingsLogged = true
      const timings = saveTimer.summary()
      if (typeof window !== 'undefined') {
        ;(window as Window & { __RF360_LAST_PFMEA_SAVE_TIMINGS?: typeof timings }).__RF360_LAST_PFMEA_SAVE_TIMINGS = timings
      }
      console.info(`PFMEA save timings (${status}): ${formatPfmeaSaveTimings(timings)}`, timings)
    }

    try {
      setSaveBusy(true)
      const { data: sess } = await supabase.auth.getSession()
      saveTimer.mark('auth session')
      const uid = sess?.session?.user?.id
      if (!uid) throw new Error('Not authenticated.')

      const draftRevisionId =
        draftRevisionIdOverride ??
        project?.current_draft_revision_id ??
        (workingRevisionId && workingRevisionId !== project?.current_open_revision_id ? workingRevisionId : null)
      if (!draftRevisionId) throw new Error('No draft revision found.')

      if (editorRef.current && typeof editorRef.current.blur === 'function') {
        editorRef.current.blur()
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
      saveTimer.mark('editor commit')

      await flushPendingCellUpdates()
      saveTimer.mark('flush cell updates')
      await flushPendingTransientDeletes()
      saveTimer.mark('flush transient deletes')
      const cleanedRows = await cleanupEmptyTransientRows()
      saveTimer.mark('cleanup empty transient rows')
      const persistedRows = await persistPfmeaDraftSnapshot(draftRevisionId, cleanedRows)
      saveTimer.mark('persist dirty draft rows')
      const persistedRowsForOrder = persistedRows.filter((row) => !row.revision_id || row.revision_id === draftRevisionId)
      const { orderedRows: orderedPersistedRows, updates: orderedPersistedUpdates } =
        buildPfmeaRowsWithStableOrderMetadata(persistedRowsForOrder)
      await persistPfmeaRowOrder(draftRevisionId, persistedRowsForOrder, orderedPersistedUpdates)
      saveTimer.mark('persist row order metadata')
      rowsRef.current = orderedPersistedRows
      setRows(orderedPersistedRows)

      const avgRpnValue = avgRpnSummary.avg == null ? null : Math.round(avgRpnSummary.avg * 100) / 100
      const historyAuthor = currentAuthorName || 'Unknown user'
      const publishResultWithHistory = await publishPfmeaRevisionWithHistory(supabase, {
        authorName: historyAuthor,
        avgRpn: avgRpnValue,
        changeDescription: desc,
        projectId,
        riskCount: rowsSorted.length,
        userId: uid,
      })
      const historyAlreadyInserted = publishResultWithHistory.historyAlreadyInserted
      const data: unknown = publishResultWithHistory.data
      if (!publishResultWithHistory.usedFallback) {
        saveTimer.mark('publish revision and history rpc')
      } else {
        saveTimer.mark('publish revision rpc fallback')
      }

      const publishResult = parsePfmeaPublishResult(data)
      let publishedRevisionId = publishResult.revisionId
      let publishedOpenRevisionLabel = publishResult.revisionLabel
      let integrityWarning: string | null = null
      let revisionLabel = normalizeHistoryText(publishedOpenRevisionLabel) || '0.0.0'
      let postPublishWarning: string | null = null
      try {
        if (!publishedRevisionId) {
          try {
            const publishedView = await loadProjectView({ syncDraftOverride: false })
            publishedRevisionId = publishedView.current_open_revision_id ?? null
            publishedOpenRevisionLabel = publishedView.open_revision_label ?? null
          } catch {}
          saveTimer.mark('resolve published project view')
        } else {
          try {
            const publishedView = await loadProjectView({ syncDraftOverride: false })
            publishedOpenRevisionLabel = publishedView.open_revision_label ?? null
          } catch {}
          saveTimer.mark('load published project view')
        }

        if (publishedRevisionId && publishedRevisionId !== draftRevisionId) {
          try {
            await syncPublishedPfmeaRowMetadata(publishedRevisionId, orderedPersistedRows)
          } catch (syncError: any) {
            console.warn('PFMEA published row metadata sync skipped:', syncError?.message ?? String(syncError))
          }
          saveTimer.mark('sync published row metadata')
        } else {
          saveTimer.mark('skip published row metadata sync')
        }

        if (publishedRevisionId && publishedRevisionId !== draftRevisionId && orderedPersistedRows.length > 0) {
          integrityWarning = await ensurePublishedPfmeaIntegrity(publishedRevisionId, orderedPersistedRows)
          saveTimer.mark('published integrity check')
        } else {
          saveTimer.mark('skip published integrity check')
        }

        revisionLabel = normalizeHistoryText(publishedOpenRevisionLabel) || '0.0.0'

        if (!historyAlreadyInserted) {
          const historyInsert = await insertPfmeaHistoryFallback(supabase, {
            authorId: uid,
            authorName: historyAuthor,
            avgRpn: avgRpnValue,
            changeDescription: desc,
            projectId,
            revisionLabel,
            riskCount: rowsSorted.length,
          })
          saveTimer.mark('insert pfmea history fallback')
          if (historyInsert.errorMessage) {
            // Optional table; keep publish successful even if custom history insert is unavailable.
            console.warn('PFMEA history insert skipped:', historyInsert.errorMessage)
          }
        } else {
          saveTimer.mark('skip client history insert')
        }
      } catch (postPublishError: any) {
        postPublishWarning = `PFMEA was published, but post-save verification did not finish cleanly. ${postPublishError?.message ?? String(postPublishError)}`
        console.warn('PFMEA post-publish warning:', postPublishError?.message ?? String(postPublishError))
      }

      setShowSave(false)
      setChangeDesc('')
      setDirtyPfmeaIds([])
      setDeletedPfmeaIds([])
      clearDirtyDraftPersisted()
      setDraftRevisionIdOverride(null)
      resetPfmeaEditRuntimeState()
      try {
        const draftRowsCleaned = await cleanupPfmeaDraftRowsAfterPublish(supabase, { draftRevisionId, publishedRevisionId })
        if (draftRowsCleaned) saveTimer.mark('cleanup old draft rows')
      } catch (cleanupDraftError: any) {
        console.warn('PFMEA draft cleanup skipped:', cleanupDraftError?.message ?? String(cleanupDraftError))
        if (draftRevisionId && publishedRevisionId && draftRevisionId !== publishedRevisionId) saveTimer.mark('cleanup old draft rows')
      }
      if (projectId && userId) {
        await deletePfmeaEditSession(supabase, projectId, userId)
        saveTimer.mark('cleanup edit session')
      }
      setEditSession(null)
      forceRefreshExistingDraftFromOpenRef.current = false

      if (data) console.log('Published PFMEA revision id:', data)

      try {
        await loadProjectView({ syncDraftOverride: false })
      } catch (projectReloadError: any) {
        console.warn('PFMEA project view refresh skipped:', projectReloadError?.message ?? String(projectReloadError))
      }
      saveTimer.mark('reload project view')
      await loadRevisionHistory()
      saveTimer.mark('reload revision history')
      if (integrityWarning) {
        setErr(integrityWarning)
      } else if (postPublishWarning) {
        setErr(postPublishWarning)
      }
      logSaveTimings('success')
    } catch (e: any) {
      console.error('PFMEA save failed:', e)
      logSaveTimings('failed')
      setErr(
        isTimeoutError(e)
          ? 'PFMEA save timed out while the database was processing the revision. The save path has been optimized; please try again. If it repeats, contact an administrator.'
          : e?.message ?? String(e)
      )
    } finally {
      setSaveBusy(false)
    }
  }

  const syncPublishedPfmeaRowMetadata = useCallback(
    async (revisionId: string, sourceRows: PfmeaRow[]) => {
      const orderedSourceRows = sortPfmeaRows(sourceRows).filter(
        (row) => !isPlaceholderRowId(row.id) && (!row.revision_id || row.revision_id === draftRevisionIdOverride || row.revision_id === workingRevisionId)
      )
      if (!revisionId || orderedSourceRows.length === 0) return

      const publishedRows = await fetchPfmeaRowsForRevisionScope(revisionId, getPfmeaRowOperationIds(orderedSourceRows))
      if (publishedRows.length === 0) return

      const sourceMeta = buildPfmeaStableOrderMetadata(orderedSourceRows)
      const metadataBySourceId = new Map(sourceMeta.map((item) => [item.id, item] as const))
      const updates: Array<{
        id: string
        patch: ReturnType<typeof buildPfmeaPublishedMetadataPatch>
      }> = []

      const unmatchedPublishedRows = [...publishedRows]
      const matchedSourceIds = new Set<string>()

      for (const sourceRow of orderedSourceRows) {
        const matchedPublishedRow = findEquivalentPublishedPfmeaRow(unmatchedPublishedRows, sourceRow)
        const meta = metadataBySourceId.get(sourceRow.id)
        if (!matchedPublishedRow || !meta) continue

        matchedSourceIds.add(sourceRow.id)
        const matchedIndex = unmatchedPublishedRows.findIndex((row) => row.id === matchedPublishedRow.id)
        if (matchedIndex >= 0) unmatchedPublishedRows.splice(matchedIndex, 1)

        updates.push({
          id: matchedPublishedRow.id,
          patch: buildPfmeaPublishedMetadataPatch(meta),
        })
      }

      const remainingSourceRows = orderedSourceRows.filter((row) => !matchedSourceIds.has(row.id))
      if (remainingSourceRows.length > 0 && unmatchedPublishedRows.length > 0) {
        const publishedByOperation = new Map<string, PfmeaRow[]>()
        const sourceByOperation = new Map<string, PfmeaRow[]>()

        for (const row of unmatchedPublishedRows) {
          const operationId = getPfmeaRowOperationId(row)
          if (!operationId) continue
          if (!publishedByOperation.has(operationId)) publishedByOperation.set(operationId, [])
          publishedByOperation.get(operationId)!.push(row)
        }
        for (const row of remainingSourceRows) {
          const operationId = getPfmeaRowOperationId(row)
          if (!operationId) continue
          if (!sourceByOperation.has(operationId)) sourceByOperation.set(operationId, [])
          sourceByOperation.get(operationId)!.push(row)
        }

        for (const [operationId, publishedGroup] of publishedByOperation.entries()) {
          const sourceGroup = sourceByOperation.get(operationId) ?? []
          const count = Math.min(publishedGroup.length, sourceGroup.length)
          for (let index = 0; index < count; index += 1) {
            const publishedRow = publishedGroup[index]
            const sourceRow = sourceGroup[index]
            const meta = metadataBySourceId.get(sourceRow.id)
            if (!meta) continue
            updates.push({
              id: publishedRow.id,
              patch: buildPfmeaPublishedMetadataPatch(meta),
            })
          }
        }
      }

      if (updates.length === 0) return

      const batchSize = 25
      for (let index = 0; index < updates.length; index += batchSize) {
        const batch = updates.slice(index, index + batchSize)
        const results = await Promise.all(
          batch.map((item) =>
            supabase
              .from('pfmea_rows')
              .update(
                pfmeaGroupIdsSupportedRef.current === false
                  ? stripPfmeaGroupIdsFromPayload(item.patch as Record<string, unknown>)
                  : item.patch
              )
              .eq('id', item.id)
              .eq('revision_id', revisionId)
          )
        )

        for (const result of results) {
          if (result.error) throw result.error
        }
      }
    },
    [draftRevisionIdOverride, workingRevisionId, fetchPfmeaRowsForRevisionScope]
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

      const createdAtById = new Map(updates.map((item) => [item.id, item.created_at]))
      const rowNoById = new Map(updates.map((item) => [item.id, item.row_no]))
      const groupIdsById = new Map(
        updates.map((item) => [
          item.id,
          {
            failure_mode_group_id: item.failure_mode_group_id,
            failure_block_group_id: item.failure_block_group_id,
            action_plan_group_id: item.action_plan_group_id,
          },
        ])
      )
      setRows((prev) => {
        const nextRows = prev.map((row) => {
          const createdAt = createdAtById.get(row.id)
          const rowNo = rowNoById.get(row.id)
          const groupIds = groupIdsById.get(row.id)
          if (
            !createdAt ||
            (row.created_at === createdAt &&
              row.row_no === rowNo &&
              row.failure_mode_group_id === groupIds?.failure_mode_group_id &&
              row.failure_block_group_id === groupIds?.failure_block_group_id &&
              row.action_plan_group_id === groupIds?.action_plan_group_id)
          ) {
            return row
          }
          return { ...row, created_at: createdAt, row_no: rowNo, ...groupIds }
        })
        rowsRef.current = nextRows
        return nextRows
      })
    },
    [rowsRef]
  )

  const displayOps = useMemo(() => {
    const rowHitsByOperationId = new Map<string, number>()
    for (const r of rowsSorted) {
      const id = r.operation_id || r.operations?.id || ''
      if (!id) continue
      rowHitsByOperationId.set(id, (rowHitsByOperationId.get(id) ?? 0) + 1)
    }

    const byGroup = new Map<string, Operation>()
    const chooseCandidate = (candidate: Operation) => {
      const key = opGroupKeyFromOperation(candidate)
      const prev = byGroup.get(key)
      if (!prev) {
        byGroup.set(key, candidate)
        return
      }
      const prevScore = opQualityScore(prev, rowHitsByOperationId.get(prev.id) ?? 0)
      const nextScore = opQualityScore(candidate, rowHitsByOperationId.get(candidate.id) ?? 0)
      if (nextScore > prevScore) byGroup.set(key, candidate)
    }

    for (const op of ops) {
      if (op.active === false) continue
      chooseCandidate(op)
    }
    for (const r of rowsSorted) {
      const rop = r.operations
      if (!rop) continue
      chooseCandidate({
        id: rop.id,
        project_id: rop.project_id,
        operation_number: rop.operation_number,
        name: rop.name,
        machine: rop.machine,
        operation: rop.operation,
        active: rop.active,
      })
    }

    const list = [...byGroup.values()]
    list.sort((a, b) => {
      const ao = a.operation_number ?? Number.MAX_SAFE_INTEGER
      const bo = b.operation_number ?? Number.MAX_SAFE_INTEGER
      if (ao !== bo) return ao - bo
      return a.id.localeCompare(b.id)
    })
    return list
  }, [ops, rowsSorted])

  const tableRows = useMemo(() => {
    const groupedByKey = new Map<string, PfmeaRow[]>()
    for (const r of rowsSorted) {
      const keys = new Set<string>()
      const no = r.operations?.operation_number
      if (typeof no === 'number' && Number.isFinite(no)) keys.add(`no:${no}`)
      const id = r.operation_id || r.operations?.id || ''
      if (id) keys.add(`id:${id}`)
      if (keys.size === 0) keys.add(opGroupKeyFromRow(r))

      for (const key of keys) {
        if (!groupedByKey.has(key)) groupedByKey.set(key, [])
        groupedByKey.get(key)!.push(r)
      }
    }

    const out: PfmeaRow[] = []
    const emittedRowIds = new Set<string>()
    const consumedKeys = new Set<string>()
    let emittedNonPlaceholderCount = 0

    for (const op of displayOps) {
      const keys = new Set<string>([opGroupKeyFromOperation(op), `id:${op.id}`])
      const group: PfmeaRow[] = []
      const seenInGroup = new Set<string>()

      for (const key of keys) {
        const hit = groupedByKey.get(key) ?? []
        for (const row of hit) {
          if (seenInGroup.has(row.id)) continue
          seenInGroup.add(row.id)
          group.push(row)
        }
        consumedKeys.add(key)
      }

      for (const row of group) {
        if (emittedRowIds.has(row.id)) continue
        emittedRowIds.add(row.id)
        out.push(row)
        emittedNonPlaceholderCount += 1
      }

      if (group.length === 0) {
        const placeholderToken = `base:${op.id}`
        out.push(makePlaceholderRow(op, workingRevisionId, placeholderToken, emittedNonPlaceholderCount))
      }

    }

    // Safety fallback: keep remaining persisted rows not yet emitted.
    for (const [key, group] of groupedByKey.entries()) {
      if (consumedKeys.has(key)) continue
      for (const row of group) {
        if (emittedRowIds.has(row.id)) continue
        emittedRowIds.add(row.id)
        out.push(row)
        emittedNonPlaceholderCount += 1
      }
    }

    return out
  }, [displayOps, rowsSorted, workingRevisionId])

  const avgRpnSummary = useMemo(() => {
    const buckets: Record<RiskColor, number> = { green: 0, yellow: 0, orange: 0, red: 0 }

    const values = rowsSorted
      .map((r) => {
        const { currentRisk } = computePfmeaDerivedFromContext(r)
        const c = getRiskColorFor(currentRisk.sev, currentRisk.doVal)
        if (c) buckets[c] += 1
        return currentRisk.rpn
      })
      .filter((v): v is number => v != null && Number.isFinite(v))

    if (values.length === 0) {
      return {
        avg: null as number | null,
        color: null as RiskColor | null,
        count: 0,
        buckets,
      }
    }

    const avg = values.reduce((acc, x) => acc + x, 0) / values.length
    const color = getRiskColorForAverageRpn(avg) ?? 'red'

    return { avg, color, count: values.length, buckets }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsSorted, getRiskColorFor, getRiskColorForAverageRpn])

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

  const colOrder = useMemo<(keyof PfmeaRow)[]>(() => {
    const order: Array<keyof typeof PFMEA_EDITABLE_COLUMN_VISIBILITY> = [
      'failure_mode',
      'characteristic',
      'class',
      'effect',
      'severity',
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
    return order.filter((key) => isColumnVisible(PFMEA_EDITABLE_COLUMN_VISIBILITY[key])) as (keyof PfmeaRow)[]
  }, [isColumnVisible])

  const nextCell = useCallback((rowIndex: number, colIdx: number) => {
    if (colOrder.length === 0) return { r: rowIndex, c: 0 }
    let c = colIdx + 1
    let r = rowIndex
    if (c >= colOrder.length) {
      c = 0
      r = Math.min(rowIndex + 1, tableRowsMemo.current.length - 1)
    }
    return { r, c }
  }, [colOrder])
  const prevCell = useCallback((rowIndex: number, colIdx: number) => {
    if (colOrder.length === 0) return { r: rowIndex, c: 0 }
    let c = colIdx - 1
    let r = rowIndex
    if (c < 0) {
      c = colOrder.length - 1
      r = Math.max(rowIndex - 1, 0)
    }
    return { r, c }
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
    const spans = tableRows.map(() => ({ span: 0, end: 0 }))

    const keyOf = (r: PfmeaRow) => {
      const opKey = r.operation_id ?? r.operations?.id ?? ''
      const opNo = r.operations?.operation_number ?? ''
      const station = r.operations?.machine ?? ''
      const operationName = r.operations?.operation ?? ''
      const step = r.operations?.name ?? ''
      return `${opKey}|${opNo}|${station}|${operationName}|${step}`
    }

    let i = 0
    while (i < tableRows.length) {
      const k = keyOf(tableRows[i])
      let j = i + 1
      while (j < tableRows.length && keyOf(tableRows[j]) === k) j++

      const runLen = j - i
      for (let k = i; k < j; k += 1) spans[k] = { span: k === i ? runLen : 0, end: j - 1 }
      i = j
    }

    return spans
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

  function resolveBlockEndAnchorRow(rowIndex: number, mergeInfo: Array<{ span: number; end: number }>) {
    const endIndex = mergeInfo[rowIndex]?.end ?? rowIndex
    return tableRows[endIndex] ?? tableRows[rowIndex] ?? null
  }

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

        .pfmeaTd {
          padding:
            var(--pfmea-td-pad-top, 10px)
            10px
            var(--pfmea-td-pad-bottom, 10px)
            10px !important;
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

        .pfmeaTd.editable:hover {
          box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.45);
          border-radius: 0;
        }
        .pfmeaRow.rowHover .pfmeaTd.editable:focus-within {
          box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.45);
          border-radius: 0;
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
        }
        .pfmeaTextCellContent {
          width: 100%;
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
                  const findMergeOwnerRow = (mergeInfo: Array<{ span: number; end: number }>) => {
                    for (let i = rowIndex; i >= 0; i -= 1) {
                      const item = mergeInfo[i]
                      if ((item?.span ?? 0) > 0 && (item?.end ?? -1) >= rowIndex) return tableRows[i] ?? r
                    }
                    return r
                  }
                  const failureModeOwnerRow = findMergeOwnerRow(failureModeMergeInfo)
                  const failureBlockOwnerRow = findMergeOwnerRow(failureBlockMergeInfo)
                  const actionPlanOwnerRow = findMergeOwnerRow(actionPlanBlockMergeInfo)
                  const effectiveCurrentRow = applyPendingCellValues(r)
                  const canAddFailureModeRow = hasPfmeaTextValue(applyPendingCellValues(failureModeOwnerRow).failure_mode)
                  const canAddEffectRow = hasPfmeaTextValue(applyPendingCellValues(failureBlockOwnerRow).effect)
                  const canAddCauseRow = hasPfmeaTextValue(applyPendingCellValues(actionPlanOwnerRow).cause)
                  const canAddRecommendedActionRow = hasPfmeaTextValue(effectiveCurrentRow.recommended_action)
                  const highlightKey = (rowId: string, col: keyof PfmeaRow) => `${rowId}::${String(col)}`
                  const ownerRowForColumn = (col: keyof PfmeaRow) => {
                    switch (col) {
                      case 'failure_mode':
                      case 'characteristic':
                      case 'class':
                        return failureModeOwnerRow
                      case 'effect':
                      case 'severity':
                        return failureBlockOwnerRow
                      case 'cause':
                      case 'occurrence':
                      case 'current_prevention':
                      case 'current_detection':
                      case 'detection':
                        return actionPlanOwnerRow
                      default:
                        return latestRowForHighlights
                    }
                  }
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
                  const isMissingHighlighted = (col: keyof PfmeaRow) => highlightedMissingCells?.includes(highlightKey(r.id, col)) ?? false
                  const runActionPlanStart = (targetCol: keyof PfmeaRow) => {
                    window.setTimeout(() => {
                      const latestRow = latestRowForHighlights
                      const contextualActionRow = getRecommendedActionContinuationSourceRow(latestRow)
                      const missingFields = getPreviousRequiredFieldForActionPlan(targetCol, contextualActionRow)
                      if (readOnly) return
                      if (missingFields.length === 0) {
                        void startEditCell(latestRow, targetCol)
                        return
                      }
                      const highlightKeys = missingFields.map((col) => {
                        const ownerRow = ownerRowForColumn(col)
                        return highlightKey(ownerRow.id, col)
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
                      className={`pfmeaRow ${groupStart ? 'groupStart' : ''} ${hoveredRowId === r.id ? 'rowHover' : ''}`}
                      onMouseEnter={() => setHoveredRowId(r.id)}
                      onMouseLeave={() => setHoveredRowId((current) => (current === r.id ? null : current))}
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
                          value={r.failure_mode}
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
                                    const anchorRow = resolveBlockEndAnchorRow(rowIndex, failureModeMergeInfo) ?? r
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
                          value={r.characteristic}
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
                          value={r.effect}
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
                                    const anchorRow = resolveBlockEndAnchorRow(rowIndex, failureBlockMergeInfo) ?? r
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
                          value={r.cause}
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
                                    const anchorRow = resolveBlockEndAnchorRow(rowIndex, actionPlanBlockMergeInfo) ?? r
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
                          value={r.current_prevention}
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
                          value={r.current_detection}
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
                          value={r.recommended_action}
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
                          value={r.responsible}
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
                          value={r.target_date}
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


