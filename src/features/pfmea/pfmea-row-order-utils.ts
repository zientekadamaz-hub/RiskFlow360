import {
  buildPfmeaHierarchy,
  createPfmeaGroupIds,
  isPlaceholderRowId,
  parsePfmeaRowNoParts,
  pickPfmeaGroupIds,
} from './pfmea-hierarchy-utils'

export type PfmeaOrderRow = {
  id: string
  operation_id?: string | null
  row_no?: string | null
  failure_mode_group_id?: string | null
  failure_block_group_id?: string | null
  action_plan_group_id?: string | null
  created_at?: string | null
  __sortIndex?: number
  operations?: {
    id?: string | null
    operation_number?: number | null
  } | null
}

export function reindexPfmeaRows<T extends PfmeaOrderRow>(rows: T[]) {
  let changed = false
  const next = rows.map((row, index) => {
    if (row.__sortIndex === index) return row
    changed = true
    return { ...row, __sortIndex: index }
  })
  return changed ? next : rows
}

export function insertPfmeaRowAfterAnchor<T extends PfmeaOrderRow>(prev: T[], anchorRowId: string, nextRow: T) {
  const normalized = reindexPfmeaRows(prev)
  const insertIndex = normalized.findIndex((item) => item.id === anchorRowId)
  const next =
    insertIndex < 0
      ? [...normalized, nextRow]
      : [...normalized.slice(0, insertIndex + 1), nextRow, ...normalized.slice(insertIndex + 1)]
  return reindexPfmeaRows(next)
}

export function insertPfmeaRowAfterAnchorWithFallback<T extends PfmeaOrderRow>(
  prev: T[],
  fallback: T[],
  anchorRowId: string,
  nextRow: T
) {
  const baseRows = prev.some((item) => item.id === anchorRowId) ? prev : fallback.some((item) => item.id === anchorRowId) ? fallback : prev
  return insertPfmeaRowAfterAnchor(baseRows, anchorRowId, nextRow)
}

export function insertPfmeaRowAtSortIndex<T extends PfmeaOrderRow>(prev: T[], nextRow: T, sortIndex: number | undefined) {
  const normalized = reindexPfmeaRows(prev)
  const safeIndex = Number.isFinite(sortIndex) ? Math.max(0, Math.min(Math.trunc(sortIndex as number), normalized.length)) : normalized.length
  const next = [...normalized.slice(0, safeIndex), nextRow, ...normalized.slice(safeIndex)]
  return reindexPfmeaRows(next)
}

export function sortPfmeaRows<T extends PfmeaOrderRow>(rows: T[]) {
  const indexed = rows.map((row, index) => ({ row, index }))
  indexed.sort((a, b) => {
    const aRowNoParts = parsePfmeaRowNoParts(a.row.row_no)
    const bRowNoParts = parsePfmeaRowNoParts(b.row.row_no)
    if (aRowNoParts && bRowNoParts) {
      for (let i = 0; i < aRowNoParts.length; i += 1) {
        if (aRowNoParts[i] !== bRowNoParts[i]) return aRowNoParts[i] - bRowNoParts[i]
      }
    }

    const ao = a.row.operations?.operation_number ?? 0
    const bo = b.row.operations?.operation_number ?? 0
    if (ao !== bo) return ao - bo

    const as = a.row.__sortIndex ?? a.index
    const bs = b.row.__sortIndex ?? b.index
    if (as !== bs) return as - bs

    return a.index - b.index
  })
  return indexed.map((item) => item.row)
}

export function getPfmeaRowOperationId(row: Pick<PfmeaOrderRow, 'operation_id' | 'operations'>) {
  return (row.operation_id || row.operations?.id || '').trim()
}

export function getPfmeaRowOperationIds(rows: PfmeaOrderRow[]) {
  return Array.from(new Set(rows.map((row) => getPfmeaRowOperationId(row)).filter(Boolean)))
}

export function buildPfmeaCreatedAtOrder<T extends PfmeaOrderRow>(rows: T[]) {
  const baseTime = Date.now() - Math.max(rows.length - 1, 0)
  const hierarchy = buildPfmeaHierarchy(rows)
  return rows.map((row, index) => ({
    id: row.id,
    created_at: new Date(baseTime + index).toISOString(),
    row_no: hierarchy[index]?.rowLabel ?? null,
    ...createPfmeaGroupIds(pickPfmeaGroupIds(row)),
  }))
}

export function buildPfmeaStableOrderMetadata<T extends PfmeaOrderRow>(rows: T[]) {
  const baseTime = Date.now() - Math.max(rows.length - 1, 0)
  const hierarchy = buildPfmeaHierarchy(rows)
  return rows.map((row, index) => ({
    id: row.id,
    created_at: (row.created_at ?? '').trim() || new Date(baseTime + index).toISOString(),
    row_no: hierarchy[index]?.rowLabel ?? null,
    ...createPfmeaGroupIds(pickPfmeaGroupIds(row)),
  }))
}

export function buildPfmeaRowsWithOrderMetadata<T extends PfmeaOrderRow>(rows: T[]) {
  const orderedRows = sortPfmeaRows(rows).filter((row) => !isPlaceholderRowId(row.id))
  const updates = buildPfmeaCreatedAtOrder(orderedRows)
  const updateById = new Map(updates.map((item) => [item.id, item] as const))

  return {
    orderedRows: orderedRows.map((row, index) => {
      const meta = updateById.get(row.id)
      if (!meta) return { ...row, __sortIndex: index }
      return {
        ...row,
        created_at: meta.created_at,
        row_no: meta.row_no,
        failure_mode_group_id: meta.failure_mode_group_id,
        failure_block_group_id: meta.failure_block_group_id,
        action_plan_group_id: meta.action_plan_group_id,
        __sortIndex: index,
      }
    }),
    updates,
  }
}

export function applyPfmeaOrderMetadata<T extends PfmeaOrderRow>(
  rows: T[],
  updates: ReturnType<typeof buildPfmeaCreatedAtOrder<T>>
) {
  const updateById = new Map(updates.map((item) => [item.id, item] as const))

  return reindexPfmeaRows(rows).map((row, index) => {
    const meta = updateById.get(row.id)
    if (!meta) return { ...row, __sortIndex: index }
    return {
      ...row,
      created_at: meta.created_at,
      row_no: meta.row_no,
      failure_mode_group_id: meta.failure_mode_group_id,
      failure_block_group_id: meta.failure_block_group_id,
      action_plan_group_id: meta.action_plan_group_id,
      __sortIndex: index,
    }
  })
}

export function insertPfmeaRowAfterAnchorWithOrderMetadata<T extends PfmeaOrderRow>(
  visibleRows: T[],
  fallbackRows: T[],
  anchorRowId: string,
  nextRow: T
) {
  const insertedRows = insertPfmeaRowAfterAnchorWithFallback(visibleRows, fallbackRows, anchorRowId, nextRow).filter(
    (row) => !isPlaceholderRowId(row.id)
  )
  const orderedRows = reindexPfmeaRows(insertedRows)
  const updates = buildPfmeaCreatedAtOrder(orderedRows)

  return {
    orderedRows: applyPfmeaOrderMetadata(orderedRows, updates),
    updates,
  }
}

export function buildPfmeaRowsWithStableOrderMetadata<T extends PfmeaOrderRow>(rows: T[]) {
  const orderedRows = sortPfmeaRows(rows).filter((row) => !isPlaceholderRowId(row.id))
  const updates = buildPfmeaStableOrderMetadata(orderedRows)
  const updateById = new Map(updates.map((item) => [item.id, item] as const))

  return {
    orderedRows: orderedRows.map((row, index) => {
      const meta = updateById.get(row.id)
      if (!meta) return { ...row, __sortIndex: index }
      return {
        ...row,
        created_at: meta.created_at,
        row_no: meta.row_no,
        failure_mode_group_id: meta.failure_mode_group_id,
        failure_block_group_id: meta.failure_block_group_id,
        action_plan_group_id: meta.action_plan_group_id,
        __sortIndex: index,
      }
    }),
    updates,
  }
}
