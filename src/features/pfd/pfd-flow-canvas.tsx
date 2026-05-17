import React from 'react'
import ReactFlow, {
  Background,
  MiniMap,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type Node,
  type ReactFlowInstance,
} from 'reactflow'

import type { PfdData } from '../../../app/pfd/_lib/nodes'
import { HIT } from '../../../app/pfd/_lib/ui/const'
import type { PfdFlowEdge } from './pfd-flow-utils'
import { PfdRightNav } from './pfd-right-nav'

type ReactFlowProps = React.ComponentProps<typeof ReactFlow>

type PfdFlowCanvasProps = {
  defaultEdgeOptions: ReactFlowProps['defaultEdgeOptions']
  edgeTypes: ReactFlowProps['edgeTypes']
  edges: PfdFlowEdge[]
  flowHeight: string
  flowWrapRef: React.RefObject<HTMLDivElement | null>
  isEditOwner: boolean
  lassoEnabled: boolean
  nodes: Array<Node<PfdData>>
  nodeTypes: ReactFlowProps['nodeTypes']
  projectId: string
  onConnect: OnConnect
  onEdgeClick: NonNullable<ReactFlowProps['onEdgeClick']>
  onEdgeUpdate: NonNullable<ReactFlowProps['onEdgeUpdate']>
  onEdgeUpdateEnd: NonNullable<ReactFlowProps['onEdgeUpdateEnd']>
  onEdgesChange: OnEdgesChange
  onInit: (instance: ReactFlowInstance) => void
  onMove: NonNullable<ReactFlowProps['onMove']>
  onNodeClick: NonNullable<ReactFlowProps['onNodeClick']>
  onNodeDrag: NonNullable<ReactFlowProps['onNodeDrag']>
  onNodesChange: OnNodesChange
  onPaneClick: NonNullable<ReactFlowProps['onPaneClick']>
  onSelectionChange: NonNullable<ReactFlowProps['onSelectionChange']>
  onWheel: React.WheelEventHandler<HTMLDivElement>
}

export function PfdFlowCanvas({
  defaultEdgeOptions,
  edges,
  edgeTypes,
  flowHeight,
  flowWrapRef,
  isEditOwner,
  lassoEnabled,
  nodes,
  nodeTypes,
  onConnect,
  onEdgeClick,
  onEdgeUpdate,
  onEdgeUpdateEnd,
  onEdgesChange,
  onInit,
  onMove,
  onNodeClick,
  onNodeDrag,
  onNodesChange,
  onPaneClick,
  onSelectionChange,
  onWheel,
  projectId,
}: PfdFlowCanvasProps) {
  return (
    <div
      style={{ width: '100%', height: flowHeight, transition: 'height 180ms ease', position: 'relative' }}
      ref={flowWrapRef}
      onWheel={onWheel}
    >
      <PfdRightNav projectId={projectId} />
      <ReactFlow
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectOnClick={isEditOwner}
        connectionRadius={Math.round(HIT * 1.6)}
        onNodeDrag={onNodeDrag}
        onEdgeUpdate={onEdgeUpdate}
        onEdgeUpdateEnd={onEdgeUpdateEnd}
        edgeUpdaterRadius={isEditOwner ? 18 : 0}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onSelectionChange={onSelectionChange}
        onInit={onInit}
        onMove={onMove}
        minZoom={0.35}
        maxZoom={3}
        zoomOnScroll={false}
        nodesDraggable={isEditOwner}
        elementsSelectable
        selectNodesOnDrag={lassoEnabled && isEditOwner}
        selectionOnDrag={lassoEnabled && isEditOwner}
        panOnDrag={[2]}
      >
        <MiniMap />
        <Background />
      </ReactFlow>
    </div>
  )
}
