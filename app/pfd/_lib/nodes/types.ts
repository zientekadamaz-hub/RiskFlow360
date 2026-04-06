export type NodeKind = 'operation' | 'processref' | 'decision' | 'circle' | 'startstop' | 'triangle' | 'frame'

export type PfdData = {
  kind: NodeKind
  name: string
  editable?: boolean
  opNo?: number
  station?: string
  operation?: string
  frameW?: number
  frameH?: number
  frameLabel?: string
  processOptions?: string[]
  onOpenPfmea?: (operationId: string) => void
  onPatch?: (operationId: string, patch: Partial<PfdData>) => void
}
