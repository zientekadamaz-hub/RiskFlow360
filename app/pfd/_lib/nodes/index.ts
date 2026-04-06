import type { NodeTypes } from 'reactflow'
import OperationNode from './OperationNode'
import DecisionNode from './DecisionNode'
import type { PfdData } from './types'
import CircleNode from './CircleNode'
import StartStopNode from './StartStopNode'
import TriangleNode from './TriangleNode'
import FrameNode from './FrameNode'
import ProcessRefNode from './ProcessRefNode'

export const nodeTypes: NodeTypes = {
  operation: OperationNode,
  processref: ProcessRefNode,
  decision: DecisionNode,
  circle: CircleNode,
  startstop: StartStopNode,
  triangle: TriangleNode,
  frame: FrameNode,
}

export type { PfdData }
