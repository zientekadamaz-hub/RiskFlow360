import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useState } from 'react'

import {
  deletePcpEditSession,
  publishPcpRevision,
} from './pcp-service'

type PcpSaveRevisionParams = {
  currentAuthorName: string
  isDirty: boolean
  loadAll: () => Promise<void>
  loadEditSession: () => Promise<void>
  loadRevisionHistory: () => Promise<void>
  projectId: string
  rowCount: number
  setDeletedIds: Dispatch<SetStateAction<string[]>>
  setDirtyIds: Dispatch<SetStateAction<string[]>>
  setDraftRevisionIdOverride: Dispatch<SetStateAction<string | null>>
  setError: (message: string) => void
  supabase: SupabaseClient
  userId: string | null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function usePcpSaveRevision({
  currentAuthorName,
  isDirty,
  loadAll,
  loadEditSession,
  loadRevisionHistory,
  projectId,
  rowCount,
  setDeletedIds,
  setDirtyIds,
  setDraftRevisionIdOverride,
  setError,
  supabase,
  userId,
}: PcpSaveRevisionParams) {
  const [saveBusy, setSaveBusy] = useState(false)

  const handleSaveRevision = useCallback(async (descInput?: string) => {
    if (saveBusy) return false
    if (!isDirty) return false

    const desc = (descInput ?? '').trim()
    if (!desc) {
      setError('Change description is required.')
      return false
    }

    try {
      setSaveBusy(true)
      setError('')
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess?.session?.user?.id
      if (!uid) throw new Error('Not authenticated.')

      await publishPcpRevision(supabase, {
        authorId: uid,
        authorName: currentAuthorName || 'Unknown user',
        changeDescription: desc,
        controlCount: rowCount,
        projectId,
      })

      setDirtyIds([])
      setDeletedIds([])
      setDraftRevisionIdOverride(null)
      if (projectId && userId) await deletePcpEditSession(supabase, projectId, userId)
      await loadAll()
      await loadRevisionHistory()
      await loadEditSession()
      return true
    } catch (error) {
      setError(errorMessage(error))
      return false
    } finally {
      setSaveBusy(false)
    }
  }, [
    currentAuthorName,
    isDirty,
    loadAll,
    loadEditSession,
    loadRevisionHistory,
    projectId,
    rowCount,
    saveBusy,
    setDeletedIds,
    setDirtyIds,
    setDraftRevisionIdOverride,
    setError,
    supabase,
    userId,
  ])

  return {
    handleSaveRevision,
    saveBusy,
  }
}
