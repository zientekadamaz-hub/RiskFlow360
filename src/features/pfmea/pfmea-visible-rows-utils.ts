import {
  opGroupKeyFromOperation,
  opGroupKeyFromRow,
  opQualityScore,
} from './pfmea-operation-utils'
import { makePlaceholderRow } from './pfmea-row-factory-utils'
import type { Operation, PfmeaRow } from './pfmea-types'

export function buildPfmeaDisplayOperations(ops: Operation[], rowsSorted: PfmeaRow[]) {
  const rowHitsByOperationId = new Map<string, number>()
  for (const row of rowsSorted) {
    const id = row.operation_id || row.operations?.id || ''
    if (!id) continue
    rowHitsByOperationId.set(id, (rowHitsByOperationId.get(id) ?? 0) + 1)
  }

  const byGroup = new Map<string, Operation>()
  const chooseCandidate = (candidate: Operation) => {
    const key = opGroupKeyFromOperation(candidate)
    const prev = byGroup.get(key)
    if (!prev) {
      byGroup.set(key, candidate)
      return
    }

    const prevScore = opQualityScore(prev, rowHitsByOperationId.get(prev.id) ?? 0)
    const nextScore = opQualityScore(candidate, rowHitsByOperationId.get(candidate.id) ?? 0)
    if (nextScore > prevScore) byGroup.set(key, candidate)
  }

  for (const op of ops) {
    if (op.active === false) continue
    chooseCandidate(op)
  }
  for (const row of rowsSorted) {
    const rop = row.operations
    if (!rop) continue
    chooseCandidate({
      id: rop.id,
      project_id: rop.project_id,
      operation_number: rop.operation_number,
      name: rop.name,
      machine: rop.machine,
      operation: rop.operation,
      active: rop.active,
    })
  }

  const list = [...byGroup.values()]
  list.sort((a, b) => {
    const ao = a.operation_number ?? Number.MAX_SAFE_INTEGER
    const bo = b.operation_number ?? Number.MAX_SAFE_INTEGER
    if (ao !== bo) return ao - bo
    return a.id.localeCompare(b.id)
  })

  return list
}

export function buildPfmeaTableRows(
  displayOps: Operation[],
  rowsSorted: PfmeaRow[],
  workingRevisionId: string | null
) {
  const groupedByKey = new Map<string, PfmeaRow[]>()
  for (const row of rowsSorted) {
    const keys = new Set<string>()
    const operationNumber = row.operations?.operation_number
    if (typeof operationNumber === 'number' && Number.isFinite(operationNumber)) keys.add(`no:${operationNumber}`)
    const id = row.operation_id || row.operations?.id || ''
    if (id) keys.add(`id:${id}`)
    if (keys.size === 0) keys.add(opGroupKeyFromRow(row))

    for (const key of keys) {
      if (!groupedByKey.has(key)) groupedByKey.set(key, [])
      groupedByKey.get(key)!.push(row)
    }
  }

  const out: PfmeaRow[] = []
  const emittedRowIds = new Set<string>()
  const consumedKeys = new Set<string>()
  let emittedNonPlaceholderCount = 0

  for (const op of displayOps) {
    const keys = new Set<string>([opGroupKeyFromOperation(op), `id:${op.id}`])
    const group: PfmeaRow[] = []
    const seenInGroup = new Set<string>()

    for (const key of keys) {
      const hit = groupedByKey.get(key) ?? []
      for (const row of hit) {
        if (seenInGroup.has(row.id)) continue
        seenInGroup.add(row.id)
        group.push(row)
      }
      consumedKeys.add(key)
    }

    for (const row of group) {
      if (emittedRowIds.has(row.id)) continue
      emittedRowIds.add(row.id)
      out.push(row)
      emittedNonPlaceholderCount += 1
    }

    if (group.length === 0) {
      const placeholderToken = `base:${op.id}`
      out.push(makePlaceholderRow(op, workingRevisionId, placeholderToken, emittedNonPlaceholderCount) as PfmeaRow)
    }
  }

  for (const [key, group] of groupedByKey.entries()) {
    if (consumedKeys.has(key)) continue
    for (const row of group) {
      if (emittedRowIds.has(row.id)) continue
      emittedRowIds.add(row.id)
      out.push(row)
      emittedNonPlaceholderCount += 1
    }
  }

  return out
}
