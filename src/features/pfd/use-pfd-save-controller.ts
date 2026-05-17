import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useState } from 'react'
import type { Node } from 'reactflow'

import type { PfdData } from '../../../app/pfd/_lib/nodes'
import type { PfdFlowEdge } from './pfd-flow-utils'
import { publishPfdDiagram } from './pfd-service'

type PfdSaveControllerParams = {
  currentUserId: string | null
  edges: PfdFlowEdge[]
  historyAuthor: string
  isEditOwner: boolean
  loadEditSession: () => Promise<void>
  loadHistory: () => Promise<void>
  loadRevisionLabel: () => Promise<void>
  nodes: Array<Node<PfdData>>
  projectId: string
  setError: (message: string) => void
  supabase: SupabaseClient
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function usePfdSaveController({
  currentUserId,
  edges,
  historyAuthor,
  isEditOwner,
  loadEditSession,
  loadHistory,
  loadRevisionLabel,
  nodes,
  projectId,
  setError,
  supabase,
}: PfdSaveControllerParams) {
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveDesc, setSaveDesc] = useState('')
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  const savePfdWithDescription = useCallback(async () => {
    if (!projectId || !currentUserId || !isEditOwner) return
    const description = saveDesc.trim()
    if (!description) return
    setSaveBusy(true)
    setError('')
    try {
      await publishPfdDiagram(supabase, {
        projectId,
        currentUserId,
        historyAuthor,
        description,
        nodes,
        edges,
      })

      await loadRevisionLabel()
      await loadHistory()
      await loadEditSession()
      setSaveDialogOpen(false)
      setSaveDesc('')
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setSaveBusy(false)
    }
  }, [
    currentUserId,
    edges,
    historyAuthor,
    isEditOwner,
    loadEditSession,
    loadHistory,
    loadRevisionLabel,
    nodes,
    projectId,
    saveDesc,
    setError,
    supabase,
  ])

  return {
    saveBusy,
    saveDesc,
    saveDialogOpen,
    savePfdWithDescription,
    setSaveDesc,
    setSaveDialogOpen,
  }
}
