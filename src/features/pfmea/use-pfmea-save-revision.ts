import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { isTimeoutError } from '@/lib/error-utils'
import { hydratePfmeaGroupIds } from './pfmea-row-normalization-utils'
import { createPfmeaSaveTimingLogger } from './pfmea-save-timing-utils'
import {
  cleanupPfmeaSuccessfulSaveAfterPublish,
  completePfmeaSuccessfulSaveReload,
  ensurePublishedPfmeaIntegrityAfterSave,
  fetchAuthenticatedPfmeaSaveUserId,
  pfmeaSaveErrorMessage,
  preparePfmeaDraftRowsForPublish,
  persistPfmeaDraftSnapshotAfterSave,
  publishPfmeaRevisionForSave,
  remapPfmeaSnapshotRowsToRevisionAfterSave,
  syncPublishedPfmeaRowMetadataAfterSave,
  validatePfmeaSaveStart,
  type PersistPfmeaRowOrderForSave,
} from './pfmea-save-orchestration'
import {
  ensurePfmeaProcessDraft,
  fetchPfmeaRowsForRevision,
  restorePfmeaRowsSnapshotToRevision,
  type PfmeaEditSession,
} from './pfmea-service'
import type { PfmeaEditorElement, PfmeaRow, ProjectView } from './pfmea-types'

type LoadProjectView = (options?: { syncDraftOverride?: boolean }) => Promise<ProjectView>

export type UsePfmeaSaveRevisionParams = {
  applyPendingCellValues: (row: PfmeaRow) => PfmeaRow
  avgRpn: number | null
  changeDesc: string
  cleanupEmptyTransientRows: () => Promise<PfmeaRow[]>
  clearDirtyDraftPersisted: () => void
  computeDerivedForRow: (row: PfmeaRow) => Partial<PfmeaRow>
  currentAuthorName: string
  dirtyPfmeaIds: string[]
  draftRevisionIdOverride: string | null
  editorRef: MutableRefObject<PfmeaEditorElement | null>
  flushPendingCellUpdates: () => Promise<void>
  flushPendingTransientDeletes: () => Promise<void>
  forceRefreshExistingDraftFromOpenRef: MutableRefObject<boolean>
  groupIdsSupportedRef: MutableRefObject<boolean | null>
  isDirty: boolean
  loadProjectView: LoadProjectView
  loadRevisionHistory: () => Promise<void>
  persistPfmeaRowOrder: PersistPfmeaRowOrderForSave
  project: ProjectView | null
  projectId: string
  resetPfmeaEditRuntimeState: () => void
  riskCount: number
  rowsRef: MutableRefObject<PfmeaRow[]>
  saveBusy: boolean
  setChangeDesc: Dispatch<SetStateAction<string>>
  setDeletedPfmeaIds: Dispatch<SetStateAction<string[]>>
  setDirtyPfmeaIds: Dispatch<SetStateAction<string[]>>
  setDraftRevisionIdOverride: Dispatch<SetStateAction<string | null>>
  setEditSession: Dispatch<SetStateAction<PfmeaEditSession | null>>
  setErr: Dispatch<SetStateAction<string>>
  setRows: Dispatch<SetStateAction<PfmeaRow[]>>
  setSaveBusy: Dispatch<SetStateAction<boolean>>
  setShowSave: Dispatch<SetStateAction<boolean>>
  supabase: SupabaseClient
  userId: string | null
  workingRevisionId: string | null
}

export function usePfmeaSaveRevision(params: UsePfmeaSaveRevisionParams) {
  const activeSaveDraftRevisionIdRef = useRef<string | null>(null)
  const groupIdsSupportedRef = params.groupIdsSupportedRef
  const rowsRef = params.rowsRef

  const fetchPfmeaRowsForRevisionScope = async (revisionId: string, operationIds?: string[]) => {
    const result = await fetchPfmeaRowsForRevision<PfmeaRow>(params.supabase, {
      groupIdsSupported: groupIdsSupportedRef.current,
      operationIds,
      revisionId,
    })
    groupIdsSupportedRef.current = result.groupIdsSupported
    return hydratePfmeaGroupIds(result.rows)
  }

  const remapPfmeaSnapshotRowsToRevision = async (revisionId: string, sourceRows: PfmeaRow[]) => {
    return remapPfmeaSnapshotRowsToRevisionAfterSave({
      fetchRowsForRevisionScope: fetchPfmeaRowsForRevisionScope,
      restoreSnapshotToRevision: restorePfmeaSnapshotToRevision,
      revisionId,
      sourceRows,
    })
  }

  const restorePfmeaSnapshotToRevision = async (revisionId: string, sourceRows: PfmeaRow[]) => {
    const result = await restorePfmeaRowsSnapshotToRevision<PfmeaRow>(params.supabase, {
      groupIdsSupported: groupIdsSupportedRef.current,
      revisionId,
      sourceRows,
    })
    groupIdsSupportedRef.current = result.groupIdsSupported
    return hydratePfmeaGroupIds(result.rows)
  }

  const ensurePublishedPfmeaIntegrity = async (revisionId: string, sourceRows: PfmeaRow[]) => {
    return ensurePublishedPfmeaIntegrityAfterSave({
      fetchRowsForRevisionScope: fetchPfmeaRowsForRevisionScope,
      restoreSnapshotToRevision: restorePfmeaSnapshotToRevision,
      revisionId,
      sourceRows,
    })
  }

  const persistPfmeaDraftSnapshot = async (revisionId: string, sourceRows: PfmeaRow[]) => {
    const mappedSnapshotRows = await persistPfmeaDraftSnapshotAfterSave({
      applyPendingCellValues: params.applyPendingCellValues,
      computeDerivedForRow: params.computeDerivedForRow,
      dirtyIds: params.dirtyPfmeaIds,
      groupIdsSupported: groupIdsSupportedRef.current,
      remapRowsToRevision: remapPfmeaSnapshotRowsToRevision,
      revisionId,
      sourceRows,
      supabase: params.supabase,
    })

    rowsRef.current = mappedSnapshotRows
    params.setRows(mappedSnapshotRows)
    return mappedSnapshotRows
  }

  const syncPublishedPfmeaRowMetadata = async (revisionId: string, sourceRows: PfmeaRow[]) => {
    await syncPublishedPfmeaRowMetadataAfterSave({
      draftRevisionIdOverride: activeSaveDraftRevisionIdRef.current ?? params.draftRevisionIdOverride,
      fetchRowsForRevisionScope: fetchPfmeaRowsForRevisionScope,
      groupIdsSupported: groupIdsSupportedRef.current,
      revisionId,
      sourceRows,
      supabase: params.supabase,
      workingRevisionId: params.workingRevisionId,
    })
  }

  const handleSaveRevision = async () => {
    const validation = validatePfmeaSaveStart({
      changeDesc: params.changeDesc,
      currentDraftRevisionId: params.project?.current_draft_revision_id,
      currentOpenRevisionId: params.project?.current_open_revision_id,
      draftRevisionIdOverride: params.draftRevisionIdOverride,
      isDirty: params.isDirty,
      saveBusy: params.saveBusy,
      workingRevisionId: params.workingRevisionId,
    })

    if (validation.status === 'busy') return
    params.setErr('')

    if (validation.status === 'clean') {
      params.setShowSave(false)
      return
    }

    if (validation.status === 'invalid') {
      params.setErr(validation.error)
      return
    }

    const desc = validation.changeDescription
    let draftRevisionId = validation.draftRevisionId
    const saveTiming = createPfmeaSaveTimingLogger()

    try {
      params.setSaveBusy(true)
      const uid = await fetchAuthenticatedPfmeaSaveUserId(params.supabase)
      saveTiming.mark('auth session')

      const freshProjectView = await params.loadProjectView({ syncDraftOverride: false })
      let freshDraftRevisionId = freshProjectView.current_draft_revision_id ?? null
      if (!freshDraftRevisionId) {
        freshDraftRevisionId = await ensurePfmeaProcessDraft(params.supabase, params.projectId, uid)
        saveTiming.mark('ensure fresh draft revision')
      }
      if (!freshDraftRevisionId) {
        throw new Error('No draft revision found.')
      }
      if (freshDraftRevisionId !== draftRevisionId) {
        draftRevisionId = freshDraftRevisionId
        params.setDraftRevisionIdOverride(freshDraftRevisionId)
      }
      activeSaveDraftRevisionIdRef.current = draftRevisionId
      saveTiming.mark('resolve fresh draft revision')

      const { orderedPersistedRows } = await preparePfmeaDraftRowsForPublish({
        cleanupEmptyTransientRows: params.cleanupEmptyTransientRows,
        draftRevisionId,
        editor: params.editorRef.current,
        flushPendingCellUpdates: params.flushPendingCellUpdates,
        flushPendingTransientDeletes: params.flushPendingTransientDeletes,
        mark: saveTiming.mark,
        persistPfmeaDraftSnapshot,
        persistPfmeaRowOrder: params.persistPfmeaRowOrder,
        rowsRef,
        setRows: params.setRows,
      })

      const {
        data,
        integrityWarning,
        postPublishWarning,
        publishedRevisionId,
      } = await publishPfmeaRevisionForSave({
        avgRpn: params.avgRpn,
        changeDescription: desc,
        currentAuthorName: params.currentAuthorName,
        draftRevisionId,
        ensurePublishedIntegrity: ensurePublishedPfmeaIntegrity,
        mark: saveTiming.mark,
        orderedPersistedRows,
        projectId: params.projectId,
        reloadProjectView: () => params.loadProjectView({ syncDraftOverride: false }),
        riskCount: params.riskCount,
        supabase: params.supabase,
        syncPublishedRowMetadata: syncPublishedPfmeaRowMetadata,
        userId: uid,
      })

      await cleanupPfmeaSuccessfulSaveAfterPublish({
        clearDirtyDraftPersisted: params.clearDirtyDraftPersisted,
        draftRevisionId,
        forceRefreshExistingDraftFromOpenRef: params.forceRefreshExistingDraftFromOpenRef,
        mark: saveTiming.mark,
        projectId: params.projectId,
        publishedRevisionId,
        resetPfmeaEditRuntimeState: params.resetPfmeaEditRuntimeState,
        setChangeDesc: params.setChangeDesc,
        setDeletedPfmeaIds: params.setDeletedPfmeaIds,
        setDirtyPfmeaIds: params.setDirtyPfmeaIds,
        setDraftRevisionIdOverride: params.setDraftRevisionIdOverride,
        setEditSession: params.setEditSession,
        setShowSave: params.setShowSave,
        supabase: params.supabase,
        userId: params.userId,
      })

      await completePfmeaSuccessfulSaveReload({
        data,
        integrityWarning,
        loadProjectView: () => params.loadProjectView({ syncDraftOverride: false }),
        loadRevisionHistory: params.loadRevisionHistory,
        mark: saveTiming.mark,
        postPublishWarning,
        setErr: params.setErr,
      })
      saveTiming.log('success')
    } catch (error: unknown) {
      console.error('PFMEA save failed:', error)
      saveTiming.log('failed')
      params.setErr(
        isTimeoutError(error)
          ? 'PFMEA save timed out while the database was processing the revision. The save path has been optimized; please try again. If it repeats, contact an administrator.'
          : pfmeaSaveErrorMessage(error)
      )
    } finally {
      activeSaveDraftRevisionIdRef.current = null
      params.setSaveBusy(false)
    }
  }

  return {
    handleSaveRevision,
  }
}
