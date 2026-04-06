export type NodeKind = 'operation' | 'decision' | 'circle' | 'startstop'



export type PfdData = {
  kind: NodeKind
  name: string
  opNo?: number
  station?: string
  operation?: string
  onOpenPfmea?: (operationId: string) => void
  onPatch?: (operationId: string, patch: Partial<PfdData>) => void
}
