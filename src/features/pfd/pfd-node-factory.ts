import type { Node } from 'reactflow'
import type { PfdData } from '../../../app/pfd/_lib/nodes'
import type { PfdFlowEdge } from './pfd-flow-utils'

export function makeLocalNodeId(prefix: string, nodes: Node<PfdData>[]) {
  let id = ''
  do {
    id = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  } while (nodes.some((node) => node.id === id))
  return id
}

export function createDecisionNode(
  id: string,
  position: { x: number; y: number },
  decisionNumber: number
): Node<PfdData> {
  return {
    id,
    type: 'decision',
    position,
    data: { kind: 'decision', name: `Decision ${decisionNumber}` },
  }
}

export function createStartStopNode(
  id: string,
  position: { x: number; y: number },
  ordinal: number
): Node<PfdData> {
  return {
    id,
    type: 'startstop',
    position,
    data: { kind: 'startstop', name: ordinal === 1 ? 'START' : `STOP ${ordinal}` },
  }
}

export function createCircleNode(id: string, position: { x: number; y: number }): Node<PfdData> {
  return {
    id,
    type: 'circle',
    position,
    data: { kind: 'circle', name: '00' },
  }
}

export function createTriangleNode(
  id: string,
  position: { x: number; y: number },
  ordinal: number
): Node<PfdData> {
  return {
    id,
    type: 'triangle',
    position,
    data: { kind: 'triangle', name: `Storage ${ordinal}` },
  }
}

export function createFrameNode(
  id: string,
  position: { x: number; y: number },
  size: { w: number; h: number }
): Node<PfdData> {
  return {
    id,
    type: 'frame',
    position,
    data: { kind: 'frame', name: 'Frame', frameW: size.w, frameH: size.h, frameLabel: '' },
    draggable: true,
    selectable: true,
    connectable: false,
    dragHandle: '.frame-drag-handle',
    style: { zIndex: -1, pointerEvents: 'none' as const },
  } as Node<PfdData>
}

export function createProcessRefNode(
  id: string,
  position: { x: number; y: number },
  processOptions: string[]
): Node<PfdData> {
  return {
    id,
    type: 'processref',
    position,
    data: { kind: 'processref', name: '', processOptions },
  }
}

export function createLinearStepEdge(
  sourceId: string,
  targetId: string,
  pathOptions: NonNullable<PfdFlowEdge['pathOptions']>,
  markerEnd: PfdFlowEdge['markerEnd'],
  stroke: string,
  strokeWidth: number
): PfdFlowEdge {
  return {
    id: `e-${sourceId}-bottom-${targetId}-top-${Date.now()}`,
    source: sourceId,
    sourceHandle: 'bottom-s',
    target: targetId,
    targetHandle: 'top-t',
    type: 'smoothedit',
    pathOptions,
    markerEnd,
    style: { strokeWidth, stroke },
  }
}
