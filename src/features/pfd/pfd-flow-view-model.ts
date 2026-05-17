import type { Node } from 'reactflow'

import type { PfdData } from '../../../app/pfd/_lib/nodes'
import type { PfdFlowEdge } from './pfd-flow-utils'

type BuildNodesWithHandlersParams = {
  canOpenPfmeaPanel: boolean
  isEditOwner: boolean
  nodes: Array<Node<PfdData>>
  onOpenPfmea: (operationId: string) => void | Promise<void>
  onPatchFrame: (frameId: string, patch: Partial<PfdData>) => void
  onPatchOperation: (operationId: string, patch: Partial<PfdData>) => void | Promise<void>
  processOptions: string[]
}

type BuildDefaultEdgeOptionsParams = {
  edgeMarker: PfdFlowEdge['markerEnd']
  s: number
  uiFont: string
}

type BuildStyledEdgesParams = {
  edgeMarker: PfdFlowEdge['markerEnd']
  edges: PfdFlowEdge[]
  isEditOwner: boolean
  s: number
  selectedEdgeId: string | null
  uiFont: string
}

export function isPfdOperationSelected(nodes: Array<Node<PfdData>>, selectedNodeId: string | null) {
  if (!selectedNodeId) return false
  return nodes.find((node) => node.id === selectedNodeId)?.data.kind === 'operation'
}

export function buildPfdNodesWithHandlers({
  canOpenPfmeaPanel,
  isEditOwner,
  nodes,
  onOpenPfmea,
  onPatchFrame,
  onPatchOperation,
  processOptions,
}: BuildNodesWithHandlersParams) {
  const mapped: Array<Node<PfdData>> = nodes.map((node) => {
    if (node.data.kind === 'operation') {
      return {
        ...node,
        data: {
          ...node.data,
          editable: isEditOwner,
          onOpenPfmea: canOpenPfmeaPanel ? onOpenPfmea : undefined,
          onPatch: onPatchOperation,
        },
      }
    }
    if (node.data.kind === 'processref') {
      return {
        ...node,
        data: {
          ...node.data,
          editable: isEditOwner,
          onPatch: onPatchFrame,
          processOptions,
        },
      }
    }
    if (node.data.kind === 'frame') {
      return {
        ...node,
        draggable: true,
        selectable: true,
        connectable: false,
        dragHandle: '.frame-drag-handle',
        style: { ...(node.style ?? {}), zIndex: -1, pointerEvents: 'none' as const },
        data: { ...node.data, editable: isEditOwner, onPatch: onPatchFrame },
      }
    }
    if (node.data.kind === 'circle' || node.data.kind === 'decision' || node.data.kind === 'startstop' || node.data.kind === 'triangle') {
      return { ...node, data: { ...node.data, editable: isEditOwner, onPatch: onPatchFrame } }
    }
    return node
  })

  return mapped.sort((a, b) => (a.data.kind === 'frame' ? -1 : b.data.kind === 'frame' ? 1 : 0))
}

export function getPfdSelectedOperationLabel(nodes: Array<Node<PfdData>>, operationId: string | null) {
  if (!operationId) return ''
  const node = nodes.find((item) => item.id === operationId)
  if (!node) return operationId
  const step = (node.data.name || 'â€”').replace(/\s+/g, ' ').trim()
  return `${node.data.opNo ?? ''} â€“ ${step} | Station: ${node.data.station || 'â€”'} | Operation: ${node.data.operation || 'â€”'}`
}

export function buildPfdDefaultEdgeOptions({ edgeMarker, s, uiFont }: BuildDefaultEdgeOptionsParams) {
  return {
    type: 'smoothedit' as const,
    pathOptions: { borderRadius: Math.max(8, Math.round(14 * s)), offset: Math.round(15 * s) },
    markerEnd: edgeMarker,
    style: { strokeWidth: 1 * s, stroke: '#dbe7f5' },
    labelStyle: { fontWeight: 600, fontSize: 14 * s, fill: '#444', fontFamily: uiFont },
    labelBgStyle: { fill: 'white' },
    labelBgPadding: [6 * s, 4 * s] as [number, number],
    labelBgBorderRadius: 6 * s,
  }
}

export function buildPfdStyledEdges({
  edgeMarker,
  edges,
  isEditOwner,
  s,
  selectedEdgeId,
  uiFont,
}: BuildStyledEdgesParams) {
  return edges.map((edge) => {
    const isSelected = edge.id === selectedEdgeId || Boolean(edge.selected)

    return {
      ...edge,
      type: 'smoothedit',
      pathOptions: { borderRadius: Math.max(8, Math.round(14 * s)), offset: Math.round(15 * s) },
      markerEnd: edgeMarker,
      style: {
        ...(edge.style ?? {}),
        stroke: isSelected ? '#f8fbff' : '#dbe7f5',
        strokeWidth: isSelected ? 2 * s : 1 * s,
        filter: isSelected ? 'drop-shadow(0px 8px 18px rgba(219,231,245,0.28))' : undefined,
      },
      data: { ...(edge.data ?? {}), editable: isEditOwner },
      labelStyle: { ...(edge.labelStyle ?? {}), fontFamily: uiFont, fontWeight: 700 },
    }
  })
}
