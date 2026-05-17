import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback } from 'react'
import type { Node } from 'reactflow'

import type { PfdData } from '../../../app/pfd/_lib/nodes'
import type { PfdFlowEdge } from './pfd-flow-utils'
import {
  discardPfdDraftAndCloseSession,
  startPfdEditSession,
} from './pfd-service'

type PfdEditSessionActionsParams = {
  currentUserId: string | null
  edges: PfdFlowEdge[]
  editLockMs: number
  isEditOwner: boolean
  loadAll: () => Promise<void>
  loadEditSession: () => Promise<void>
  nodes: Array<Node<PfdData>>
  projectId: string
  resetDraftLoad: () => void
  setError: (message: string) => void
  setSessionBusy: (busy: boolean) => void
  setSessionMsg: (message: string) => void
  supabase: SupabaseClient
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function usePfdEditSessionActions({
  currentUserId,
  edges,
  editLockMs,
  isEditOwner,
  loadAll,
  loadEditSession,
  nodes,
  projectId,
  resetDraftLoad,
  setError,
  setSessionBusy,
  setSessionMsg,
  supabase,
}: PfdEditSessionActionsParams) {
  const startEditSession = useCallback(async () => {
    if (!projectId || !currentUserId) return
    setSessionBusy(true)
    setError('')
    setSessionMsg('')
    try {
      const result = await startPfdEditSession(supabase, {
        projectId,
        currentUserId,
        nodes,
        edges,
        editLockMs,
      })

      if (result.blocked) {
        setError(result.message)
        return
      }

      await loadEditSession()
      resetDraftLoad()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setSessionBusy(false)
    }
  }, [
    currentUserId,
    edges,
    editLockMs,
    loadEditSession,
    nodes,
    projectId,
    resetDraftLoad,
    setError,
    setSessionBusy,
    setSessionMsg,
    supabase,
  ])

  const discardDraftAndCloseSession = useCallback(async () => {
    if (!projectId || !currentUserId || !isEditOwner) return
    setSessionBusy(true)
    setError('')
    try {
      await discardPfdDraftAndCloseSession(supabase, { projectId, currentUserId })
      resetDraftLoad()
      await loadEditSession()
      await loadAll()
      setSessionMsg('Draft discarded. Session closed without publishing.')
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setSessionBusy(false)
    }
  }, [
    currentUserId,
    isEditOwner,
    loadAll,
    loadEditSession,
    projectId,
    resetDraftLoad,
    setError,
    setSessionBusy,
    setSessionMsg,
    supabase,
  ])

  return {
    discardDraftAndCloseSession,
    startEditSession,
  }
}
