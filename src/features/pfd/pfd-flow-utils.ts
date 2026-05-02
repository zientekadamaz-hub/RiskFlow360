import type { Edge as ReactFlowEdge, Node } from 'reactflow'
import type { PfdData } from '../../../app/pfd/_lib/nodes'
import { CIRCLE_D, DEC_H, DEC_W, OP_HEIGHT, OP_WIDTH, START_H, START_W, TRI_H, TRI_W } from '../../../app/pfd/_lib/ui/const'

export type PfdFlowEdge = ReactFlowEdge & {
  pathOptions?: {
    borderRadius?: number
    offset?: number
  }
}

export function isOperationNode(node: Node<PfdData>) {
  return node.data.kind === 'operation'
}

export function isLinearStepNode(node: Node<PfdData>) {
  return node.data.kind === 'operation' || node.data.kind === 'processref'
}

export function sortOperationsByNumber(nodes: Node<PfdData>[]) {
  return [...nodes].sort((a, b) => (a.data.opNo ?? 0) - (b.data.opNo ?? 0))
}

export function sortLinearSteps(nodes: Node<PfdData>[]) {
  return [...nodes].sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x))
}

export function findLinearTail(nodes: Node<PfdData>[], edges: PfdFlowEdge[]) {
  const linearSteps = sortLinearSteps(nodes.filter(isLinearStepNode))
  if (linearSteps.length === 0) return null

  const linearIds = new Set(linearSteps.map((node) => node.id))
  const tails = linearSteps.filter(
    (node) => !edges.some((edge) => edge.source === node.id && linearIds.has(edge.target))
  )

  return tails.at(-1) ?? linearSteps.at(-1) ?? null
}

export function findSmallestFree10(existing: number[]) {
  const set = new Set(existing)
  for (let value = 10; value <= 10000; value += 10) if (!set.has(value)) return value
  return (existing.length ? Math.max(...existing) : 0) + 10
}

export function isOperationId(id: string) {
  return typeof id === 'string' && !id.startsWith('dec-') && !id.startsWith('cir-')
}

export function nodeRect(node: Node<PfdData>) {
  if (node.data.kind === 'operation') return { w: OP_WIDTH, h: OP_HEIGHT }
  if (node.data.kind === 'processref') return { w: OP_WIDTH, h: OP_HEIGHT }
  if (node.data.kind === 'decision') return { w: DEC_W, h: DEC_H }
  if (node.data.kind === 'circle') return { w: CIRCLE_D, h: CIRCLE_D }
  if (node.data.kind === 'startstop') return { w: START_W, h: START_H }
  if (node.data.kind === 'triangle') return { w: TRI_W, h: TRI_H }
  if (node.data.kind === 'frame') {
    return { w: node.data.frameW ?? 360, h: node.data.frameH ?? 220 }
  }
  return { w: 0, h: 0 }
}

export function overlapRatio(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
  const length = Math.min(aEnd - aStart, bEnd - bStart)
  if (length <= 0) return 0
  return overlap / length
}

export function sanitizeNodes(nodes: Node<PfdData>[]): Node<PfdData>[] {
  return nodes.map((node) => {
    if (node.data.kind === 'frame') {
      return {
        ...node,
        selected: false,
        draggable: true,
        selectable: true,
        connectable: false,
        dragHandle: '.frame-drag-handle',
        style: { ...(node.style ?? {}), zIndex: -1, pointerEvents: 'none' as const },
      }
    }

    return { ...node, selected: false }
  })
}

export function sanitizeEdges(edges: PfdFlowEdge[]) {
  return edges.map((edge) => {
    if (!edge.data || typeof edge.data !== 'object') {
      return { ...edge, selected: false }
    }

    const raw = edge.data as Record<string, unknown>
    const routeV = raw.routeV
    const keepCenter = routeV === 2

    const nextData: Record<string, unknown> = { ...raw }
    delete nextData.cpX
    delete nextData.cpY
    if (!keepCenter) {
      delete nextData.centerX
      delete nextData.centerY
    }

    return { ...edge, data: nextData, selected: false }
  })
}
