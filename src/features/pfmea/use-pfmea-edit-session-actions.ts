import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  PFMEA_CLONE_FIELDS,
  PFMEA_CLONE_FIELDS_LEGACY,
  isMissingPfmeaGroupIdColumnError,
  stripPfmeaGroupIdsFromPayload,
} from './pfmea-payload-utils'
import {
  deletePfmeaEditSession,
  deletePfmeaRowsByRevision,
  fetchPfmeaCurrentDraftRevisionId,
  startPfmeaEditSession,
} from './pfmea-service'
import type { PfmeaRow, ProjectView } from './pfmea-types'

export type UsePfmeaEditSessionActionsParams = {
  clearDirtyDraftPersisted: () => void
  draftRevisionIdOverride: string | null
  editLockMs: number
  forceRefreshExistingDraftFromOpenRef: MutableRefObject<boolean>
  isChampion: boolean
  isEditOwner: boolean
  isObsolete: boolean
  loadAll: (forceRevisionId?: string | null) => Promise<void>
  loadEditSession: () => Promise<void>
  project: ProjectView | null
  projectId: string
  resetPfmeaEditRuntimeState: () => void
  sessionNow: number
  setDeletedPfmeaIds: Dispatch<SetStateAction<string[]>>
  setDirtyPfmeaIds: Dispatch<SetStateAction<string[]>>
  setDraftRevisionIdOverride: Dispatch<SetStateAction<string | null>>
  setErr: Dispatch<SetStateAction<string>>
  setProject: Dispatch<SetStateAction<ProjectView | null>>
  setSessionBusy: Dispatch<SetStateAction<boolean>>
  supabase: SupabaseClient
  userId: string | null
  pfmeaGroupIdsSupportedRef: MutableRefObject<boolean | null>
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return String(error)
}

export function usePfmeaEditSessionActions(params: UsePfmeaEditSessionActionsParams) {
  const {
    clearDirtyDraftPersisted,
    draftRevisionIdOverride,
    editLockMs,
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
  } = params

  const startEditSession = useCallback(async () => {
    if (!projectId || !userId || isObsolete) return
    setSessionBusy(true)
    setErr('')
    resetPfmeaEditRuntimeState()
    try {
      const sessionStart = await startPfmeaEditSession(supabase, {
        draftRevisionIdOverride,
        editLockMs,
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
      setProject(refreshedView as ProjectView)

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
            ;(clonedRow as Record<string, unknown>)[field] = sourceRow[field]
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
    } catch (error: unknown) {
      setErr(errorMessage(error))
    } finally {
      setSessionBusy(false)
    }
  }, [
    clearDirtyDraftPersisted,
    draftRevisionIdOverride,
    editLockMs,
    forceRefreshExistingDraftFromOpenRef,
    isChampion,
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
  ])

  const discardDraftAndCloseSession = useCallback(async () => {
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
    } catch (error: unknown) {
      setErr(errorMessage(error))
    } finally {
      setSessionBusy(false)
    }
  }, [
    clearDirtyDraftPersisted,
    draftRevisionIdOverride,
    isEditOwner,
    loadAll,
    loadEditSession,
    projectId,
    resetPfmeaEditRuntimeState,
    setDeletedPfmeaIds,
    setDirtyPfmeaIds,
    setDraftRevisionIdOverride,
    setErr,
    setSessionBusy,
    supabase,
    userId,
  ])

  return {
    discardDraftAndCloseSession,
    startEditSession,
  }
}
