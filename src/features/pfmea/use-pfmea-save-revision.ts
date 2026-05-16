import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { isTimeoutError } from '@/lib/error-utils'
import { hydratePfmeaGroupIds } from './pfmea-row-normalization-utils'
import { resolvePfmeaSaveDraftRevisionId } from './pfmea-revision-utils'
import { createPfmeaSaveTimingLogger } from './pfmea-save-timing-utils'
import {
  cleanupPfmeaSuccessfulSaveAfterPublish,
  ensurePublishedPfmeaIntegrityAfterSave,
  fetchAuthenticatedPfmeaSaveUserId,
  preparePfmeaDraftRowsForPublish,
  persistPfmeaDraftSnapshotAfterSave,
  publishPfmeaRevisionForSave,
  remapPfmeaSnapshotRowsToRevisionAfterSave,
  syncPublishedPfmeaRowMetadataAfterSave,
  type PersistPfmeaRowOrderForSave,
} from './pfmea-save-orchestration'
import {
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

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return String(error)
}

export function usePfmeaSaveRevision(params: UsePfmeaSaveRevisionParams) {
  const fetchPfmeaRowsForRevisionScope = async (revisionId: string, operationIds?: string[]) => {
    const result = await fetchPfmeaRowsForRevision<PfmeaRow>(params.supabase, {
      groupIdsSupported: params.groupIdsSupportedRef.current,
      operationIds,
      revisionId,
    })
    params.groupIdsSupportedRef.current = result.groupIdsSupported
    return hydratePfmeaGroupIds(result.rows)
  }

  const remapPfmeaSnapshotRowsToRevision = async (revisionId: string, sourceRows: PfmeaRow[]) => {
    return remapPfmeaSnapshotRowsToRevisionAfterSave({
      fetchRowsForRevisionScope: fetchPfmeaRowsForRevisionScope,
      revisionId,
      sourceRows,
    })
  }

  const restorePfmeaSnapshotToRevision = async (revisionId: string, sourceRows: PfmeaRow[]) => {
    const result = await restorePfmeaRowsSnapshotToRevision<PfmeaRow>(params.supabase, {
      groupIdsSupported: params.groupIdsSupportedRef.current,
      revisionId,
      sourceRows,
    })
    params.groupIdsSupportedRef.current = result.groupIdsSupported
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
      groupIdsSupported: params.groupIdsSupportedRef.current,
      remapRowsToRevision: remapPfmeaSnapshotRowsToRevision,
      revisionId,
      sourceRows,
      supabase: params.supabase,
    })

    params.rowsRef.current = mappedSnapshotRows
    params.setRows(mappedSnapshotRows)
    return mappedSnapshotRows
  }

  const syncPublishedPfmeaRowMetadata = async (revisionId: string, sourceRows: PfmeaRow[]) => {
    await syncPublishedPfmeaRowMetadataAfterSave({
      draftRevisionIdOverride: params.draftRevisionIdOverride,
      fetchRowsForRevisionScope: fetchPfmeaRowsForRevisionScope,
      groupIdsSupported: params.groupIdsSupportedRef.current,
      revisionId,
      sourceRows,
      supabase: params.supabase,
      workingRevisionId: params.workingRevisionId,
    })
  }

  const handleSaveRevision = async () => {
    if (params.saveBusy) return
    params.setErr('')

    if (!params.isDirty) {
      params.setShowSave(false)
      return
    }

    const desc = params.changeDesc.trim()
    if (!desc) {
      params.setErr('Change description is required.')
      return
    }

    const saveTiming = createPfmeaSaveTimingLogger()

    try {
      params.setSaveBusy(true)
      const uid = await fetchAuthenticatedPfmeaSaveUserId(params.supabase)
      saveTiming.mark('auth session')

      const draftRevisionId = resolvePfmeaSaveDraftRevisionId({
        currentDraftRevisionId: params.project?.current_draft_revision_id,
        currentOpenRevisionId: params.project?.current_open_revision_id,
        draftRevisionIdOverride: params.draftRevisionIdOverride,
        workingRevisionId: params.workingRevisionId,
      })
      if (!draftRevisionId) throw new Error('No draft revision found.')

      const { orderedPersistedRows } = await preparePfmeaDraftRowsForPublish({
        cleanupEmptyTransientRows: params.cleanupEmptyTransientRows,
        draftRevisionId,
        editor: params.editorRef.current,
        flushPendingCellUpdates: params.flushPendingCellUpdates,
        flushPendingTransientDeletes: params.flushPendingTransientDeletes,
        mark: saveTiming.mark,
        persistPfmeaDraftSnapshot,
        persistPfmeaRowOrder: params.persistPfmeaRowOrder,
        rowsRef: params.rowsRef,
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

      if (data) console.log('Published PFMEA revision id:', data)

      try {
        await params.loadProjectView({ syncDraftOverride: false })
      } catch (projectReloadError: unknown) {
        console.warn('PFMEA project view refresh skipped:', errorMessage(projectReloadError))
      }
      saveTiming.mark('reload project view')
      await params.loadRevisionHistory()
      saveTiming.mark('reload revision history')
      if (integrityWarning) {
        params.setErr(integrityWarning)
      } else if (postPublishWarning) {
        params.setErr(postPublishWarning)
      }
      saveTiming.log('success')
    } catch (error: unknown) {
      console.error('PFMEA save failed:', error)
      saveTiming.log('failed')
      params.setErr(
        isTimeoutError(error)
          ? 'PFMEA save timed out while the database was processing the revision. The save path has been optimized; please try again. If it repeats, contact an administrator.'
          : errorMessage(error)
      )
    } finally {
      params.setSaveBusy(false)
    }
  }

  return {
    handleSaveRevision,
  }
}
