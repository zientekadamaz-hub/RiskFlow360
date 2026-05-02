export type PfmeaOperationLike = {
  id: string
  operation_number: number | null
  name?: string | null
  machine?: string | null
  operation?: string | null
}

export type PfmeaOperationRow = {
  operation_id?: string | null
  operations?: {
    id?: string | null
    operation_number?: number | null
  } | null
}

export type PfdDiagramRowLike = {
  nodes?: Array<{ id?: string | null; data?: { kind?: string | null } | null }> | null
}

export function opGroupKeyFromOperation(op: Pick<PfmeaOperationLike, 'id' | 'operation_number'>): string {
  if (typeof op.operation_number === 'number' && Number.isFinite(op.operation_number)) {
    return `no:${op.operation_number}`
  }
  return `id:${op.id}`
}

export function opGroupKeyFromRow(row: PfmeaOperationRow): string {
  const opNo = row.operations?.operation_number
  if (typeof opNo === 'number' && Number.isFinite(opNo)) {
    return `no:${opNo}`
  }
  return `id:${row.operation_id || row.operations?.id || ''}`
}

export function opQualityScore(op: PfmeaOperationLike, rowHits: number): number {
  const hasName = (op.name ?? '').trim() !== '' ? 1 : 0
  const hasStation = (op.machine ?? '').trim() !== '' ? 1 : 0
  const hasOperation = (op.operation ?? '').trim() !== '' ? 1 : 0
  const hasRows = rowHits > 0 ? 1 : 0
  return hasRows * 1000 + hasName * 100 + hasStation * 10 + hasOperation * 5 + Math.min(rowHits, 99)
}

export function getOperationNodeIdsFromDiagram(diagram: PfdDiagramRowLike | null): Set<string> {
  const ids = new Set<string>()
  const nodes = Array.isArray(diagram?.nodes) ? diagram.nodes : []
  for (const node of nodes) {
    const id = (node?.id ?? '').toString().trim()
    const kind = (node?.data?.kind ?? '').toString().trim()
    if (!id || kind !== 'operation') continue
    ids.add(id)
  }
  return ids
}
