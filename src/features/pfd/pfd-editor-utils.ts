import { addEdge, type Connection, type Node } from 'reactflow'
import type { PfdData } from '../../../app/pfd/_lib/nodes'
import type { PfdFlowEdge } from './pfd-flow-utils'
import { nodeRect, overlapRatio } from './pfd-flow-utils'

export function applySelectionToEdges(
  edges: PfdFlowEdge[],
  selectedNodeIds: Set<string>,
  selectedEdgeIds: Set<string>
) {
  let changed = false

  const nextEdges = edges.map((edge) => {
    const shouldSelect =
      selectedEdgeIds.has(edge.id) ||
      (selectedNodeIds.size > 0 && selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target))

    if (!!edge.selected === shouldSelect) return edge
    changed = true
    return { ...edge, selected: shouldSelect }
  })

  return { changed, nextEdges }
}

export function removeDanglingUpdatedEdge(edges: PfdFlowEdge[], edge: PfdFlowEdge) {
  if (edge.source && edge.target) return edges
  return edges.filter((current) => current.id !== edge.id)
}

export function updateEdgeConnection(
  edges: PfdFlowEdge[],
  oldEdge: PfdFlowEdge,
  connection: Connection
) {
  return edges.map((edge) =>
    edge.id === oldEdge.id
      ? {
          ...edge,
          source: connection.source ?? edge.source,
          sourceHandle: connection.sourceHandle ?? edge.sourceHandle,
          target: connection.target ?? edge.target,
          targetHandle: connection.targetHandle ?? edge.targetHandle,
        }
      : edge
  )
}

export function pruneRecentConnectionKeys(recentKeys: Map<string, number>, now: number, ttlMs: number) {
  for (const [key, createdAt] of recentKeys.entries()) {
    if (now - createdAt > ttlMs) recentKeys.delete(key)
  }
}

export function appendConnectionEdge(
  edges: PfdFlowEdge[],
  params: Connection,
  options: {
    pathOptions: NonNullable<PfdFlowEdge['pathOptions']>
    markerEnd: PfdFlowEdge['markerEnd']
    stroke: string
    strokeWidth: number
    label?: string
  }
) {
  if (!params.source || !params.target) return edges

  const edge: PfdFlowEdge = {
    ...params,
    source: params.source,
    target: params.target,
    id: `e-${params.source}-${params.sourceHandle ?? 's'}-${params.target}-${params.targetHandle ?? 't'}-${Date.now()}`,
    type: 'smoothedit',
    pathOptions: options.pathOptions,
    label: options.label,
    markerEnd: options.markerEnd,
    style: { strokeWidth: options.strokeWidth, stroke: options.stroke },
  }

  return addEdge(edge, edges)
}

export function snapDraggedNode(
  nodes: Node<PfdData>[],
  draggedNode: Node<PfdData>,
  options: { snapDistance: number; gap: number }
) {
  if (draggedNode.data.kind === 'frame') return null

  const rect = nodeRect(draggedNode)
  if (rect.w <= 0 || rect.h <= 0) return null

  let bestDx = 0
  let bestDy = 0
  let bestDxDist = Infinity
  let bestDyDist = Infinity

  const aLeft = draggedNode.position.x
  const aTop = draggedNode.position.y
  const aRight = draggedNode.position.x + rect.w
  const aBottom = draggedNode.position.y + rect.h
  const aCenterX = draggedNode.position.x + rect.w / 2
  const aCenterY = draggedNode.position.y + rect.h / 2

  const considerDx = (dx: number) => {
    const distance = Math.abs(dx)
    if (distance < bestDxDist && distance <= options.snapDistance) {
      bestDxDist = distance
      bestDx = dx
    }
  }

  const considerDy = (dy: number) => {
    const distance = Math.abs(dy)
    if (distance < bestDyDist && distance <= options.snapDistance) {
      bestDyDist = distance
      bestDy = dy
    }
  }

  nodes.forEach((other) => {
    if (other.id === draggedNode.id) return
    if (other.data.kind === 'frame') return

    const otherRect = nodeRect(other)
    if (otherRect.w <= 0 || otherRect.h <= 0) return

    const bLeft = other.position.x
    const bTop = other.position.y
    const bRight = other.position.x + otherRect.w
    const bBottom = other.position.y + otherRect.h
    const bCenterX = other.position.x + otherRect.w / 2
    const bCenterY = other.position.y + otherRect.h / 2

    considerDx(bCenterX - aCenterX)
    considerDy(bCenterY - aCenterY)

    const verticalOverlap = overlapRatio(aTop, aBottom, bTop, bBottom)
    if (verticalOverlap > 0.12) {
      considerDx(bRight + options.gap - aLeft)
      considerDx(bLeft - options.gap - aRight)
    }

    const horizontalOverlap = overlapRatio(aLeft, aRight, bLeft, bRight)
    if (horizontalOverlap > 0.12) {
      considerDy(bBottom + options.gap - aTop)
      considerDy(bTop - options.gap - aBottom)
    }
  })

  if (bestDxDist === Infinity && bestDyDist === Infinity) return null

  return {
    x: draggedNode.position.x + bestDx,
    y: draggedNode.position.y + bestDy,
  }
}
