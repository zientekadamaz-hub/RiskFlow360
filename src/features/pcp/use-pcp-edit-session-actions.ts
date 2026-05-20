import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback } from 'react'

import { errorText } from '@/lib/error-utils'
import {
  deletePcpDraftRows,
  deletePcpEditSession,
  ensurePcpProcessDraft,
  fetchCurrentPcpDraftRevisionId,
  fetchPcpSessionLock,
  upsertPcpEditSession,
} from './pcp-service'

type PcpEditSessionActionsParams = {
  draftRevisionIdOverride: string | null
  editLockMs: number
  isChampion: boolean
  isEditOwner: boolean
  isObsolete: boolean
  loadAll: (forceRevisionId?: string | null) => Promise<void>
  loadEditSession: () => Promise<void>
  projectId: string
  sessionNow: number
  setDeletedIds: Dispatch<SetStateAction<string[]>>
  setDirtyIds: Dispatch<SetStateAction<string[]>>
  setDraftRevisionIdOverride: Dispatch<SetStateAction<string | null>>
  setError: (message: string) => void
  setSessionBusy: (busy: boolean) => void
  setSessionMsg: (message: string) => void
  supabase: SupabaseClient
  userId: string | null
}

export function usePcpEditSessionActions({
  draftRevisionIdOverride,
  editLockMs,
  isChampion,
  isEditOwner,
  isObsolete,
  loadAll,
  loadEditSession,
  projectId,
  sessionNow,
  setDeletedIds,
  setDirtyIds,
  setDraftRevisionIdOverride,
  setError,
  setSessionBusy,
  setSessionMsg,
  supabase,
  userId,
}: PcpEditSessionActionsParams) {
  const clearDraftTracking = useCallback(() => {
    setDraftRevisionIdOverride(null)
    setDirtyIds([])
    setDeletedIds([])
  }, [setDeletedIds, setDirtyIds, setDraftRevisionIdOverride])

  const startEditSession = useCallback(async () => {
    if (!projectId || !userId || isObsolete) return
    setSessionBusy(true)
    setError('')
    setSessionMsg('')
    try {
      const nowIso = new Date().toISOString()
      const lock = await fetchPcpSessionLock(supabase, projectId)
      const otherOwner = lock?.lockedBy ?? null
      const last = lock?.lastActivityAt ? new Date(lock.lastActivityAt).getTime() : 0
      const hasActiveOther = !!otherOwner && otherOwner !== userId && sessionNow - last < editLockMs
      if (hasActiveOther && !isChampion) {
        setError('This PCP is currently locked by another user.')
        return
      }

      if (otherOwner && otherOwner !== userId) {
        const draftId = await fetchCurrentPcpDraftRevisionId(supabase, projectId) ?? draftRevisionIdOverride
        if (draftId) {
          await deletePcpDraftRows(supabase, draftId)
          clearDraftTracking()
        }
        const reason = sessionNow - last >= editLockMs ? '48h inactivity timeout' : 'session takeover by Champion'
        setSessionMsg(`Previous PCP draft was discarded (${reason}).`)
      }

      await upsertPcpEditSession(supabase, projectId, userId, nowIso)
      const draftId = await ensurePcpProcessDraft(supabase, projectId, userId)
      if (draftId) setDraftRevisionIdOverride(draftId)
      await loadEditSession()
      await loadAll(draftId)
    } catch (error) {
      setError(errorText(error, 'Could not start PCP edit session.'))
    } finally {
      setSessionBusy(false)
    }
  }, [
    clearDraftTracking,
    draftRevisionIdOverride,
    editLockMs,
    isChampion,
    isObsolete,
    loadAll,
    loadEditSession,
    projectId,
    sessionNow,
    setDraftRevisionIdOverride,
    setError,
    setSessionBusy,
    setSessionMsg,
    supabase,
    userId,
  ])

  const discardDraftAndCloseSession = useCallback(async () => {
    if (!projectId || !userId || !isEditOwner) return
    setSessionBusy(true)
    setError('')
    try {
      const draftId = await fetchCurrentPcpDraftRevisionId(supabase, projectId) ?? draftRevisionIdOverride
      if (draftId) await deletePcpDraftRows(supabase, draftId)
      await deletePcpEditSession(supabase, projectId, userId)
      clearDraftTracking()
      await loadEditSession()
      await loadAll()
      setSessionMsg('')
    } catch (error) {
      setError(errorText(error, 'Could not discard PCP draft.'))
    } finally {
      setSessionBusy(false)
    }
  }, [
    clearDraftTracking,
    draftRevisionIdOverride,
    isEditOwner,
    loadAll,
    loadEditSession,
    projectId,
    setError,
    setSessionBusy,
    setSessionMsg,
    supabase,
    userId,
  ])

  return {
    discardDraftAndCloseSession,
    startEditSession,
  }
}
