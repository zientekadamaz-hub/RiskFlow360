import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Node } from 'reactflow'

import type { PfdData } from '../../../app/pfd/_lib/nodes'
import {
  sanitizeEdges,
  sanitizeNodes,
  type PfdFlowEdge,
} from './pfd-flow-utils'
import {
  fetchOwnPfdDraft,
  fetchPfdCanvasData,
  savePfdDraft,
} from './pfd-service'

type PfdCanvasDataControllerParams = {
  currentUserId: string | null
  edges: PfdFlowEdge[]
  editSessionStartedAt?: string
  isEditOwner: boolean
  moduleAccessState: 'checking' | 'allowed' | 'denied'
  operationGap: number
  operationX: number
  operationY0: number
  nodes: Array<Node<PfdData>>
  projectId: string
  setEdges: Dispatch<SetStateAction<PfdFlowEdge[]>>
  setError: (message: string) => void
  setNodes: Dispatch<SetStateAction<Array<Node<PfdData>>>>
  supabase: SupabaseClient
  triggerCenterView: () => void
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function usePfdCanvasDataController({
  currentUserId,
  edges,
  editSessionStartedAt,
  isEditOwner,
  moduleAccessState,
  nodes,
  operationGap,
  operationX,
  operationY0,
  projectId,
  setEdges,
  setError,
  setNodes,
  supabase,
  triggerCenterView,
}: PfdCanvasDataControllerParams) {
  const [loading, setLoading] = useState(false)
  const draftLoadedFor = useRef('')
  const prevOwnerRef = useRef(false)
  const saveTimer = useRef<number | null>(null)

  const resetDraftLoad = useCallback(() => {
    draftLoadedFor.current = ''
  }, [])

  const loadAll = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchPfdCanvasData(supabase, projectId)
      if (data.diagram?.nodes && data.diagram?.edges) {
        const cleanNodes = sanitizeNodes(data.diagram.nodes as Array<Node<PfdData>>)
        const nodeIds = new Set(cleanNodes.map((node) => node.id))
        setNodes(cleanNodes)
        setEdges(sanitizeEdges(data.diagram.edges as PfdFlowEdge[]).filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)))
        triggerCenterView()
        return
      }

      const startNodes: Array<Node<PfdData>> = data.operations.map((operation, index) => ({
        id: operation.id,
        type: 'operation',
        position: { x: operationX, y: operationY0 + index * operationGap },
        data: {
          kind: 'operation',
          name: operation.name ?? '',
          opNo: operation.operation_number ?? 0,
          station: operation.machine ?? '',
          operation: operation.operation ?? '',
        },
      }))

      setNodes(sanitizeNodes(startNodes))
      setEdges([])
      triggerCenterView()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [operationGap, operationX, operationY0, projectId, setEdges, setError, setNodes, supabase, triggerCenterView])

  useEffect(() => {
    if (!projectId) return
    if (moduleAccessState !== 'allowed') return
    const timer = window.setTimeout(() => {
      void loadAll()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadAll, moduleAccessState, projectId])

  useEffect(() => {
    if (!projectId || !currentUserId || !isEditOwner || !nodes.length) return
    const key = `${projectId}:${currentUserId}:${editSessionStartedAt ?? ''}`
    if (draftLoadedFor.current === key) return
    draftLoadedFor.current = key

    void (async () => {
      const draft = await fetchOwnPfdDraft(supabase, { projectId, currentUserId })
      if (!draft?.nodes || !draft?.edges) return
      const cleanNodes = sanitizeNodes(draft.nodes as Array<Node<PfdData>>)
      const nodeIds = new Set(cleanNodes.map((node) => node.id))
      setNodes(cleanNodes)
      setEdges(sanitizeEdges(draft.edges as PfdFlowEdge[]).filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)))
      triggerCenterView()
    })()
  }, [currentUserId, editSessionStartedAt, isEditOwner, nodes.length, projectId, setEdges, setNodes, supabase, triggerCenterView])

  useEffect(() => {
    if (prevOwnerRef.current && !isEditOwner) {
      draftLoadedFor.current = ''
      const timer = window.setTimeout(() => {
        void loadAll()
      }, 0)
      prevOwnerRef.current = isEditOwner
      return () => window.clearTimeout(timer)
    }
    prevOwnerRef.current = isEditOwner
    return undefined
  }, [isEditOwner, loadAll])

  const scheduleSaveDiagram = useCallback(
    (nextNodes: Array<Node<PfdData>>, nextEdges: PfdFlowEdge[]) => {
      if (!projectId || !currentUserId || !isEditOwner) return
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(async () => {
        await savePfdDraft(supabase, {
          projectId,
          currentUserId,
          nodes: nextNodes,
          edges: nextEdges,
        })
      }, 450)
    },
    [currentUserId, isEditOwner, projectId, supabase]
  )

  useEffect(() => {
    if (!projectId || !isEditOwner) return
    scheduleSaveDiagram(nodes, edges)
  }, [edges, isEditOwner, nodes, projectId, scheduleSaveDiagram])

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [])

  return {
    loading,
    loadAll,
    resetDraftLoad,
  }
}
