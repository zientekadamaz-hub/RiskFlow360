import { useCallback, useEffect, useRef, useState } from 'react'

import type { PfmeaRow } from './pfmea-types'

function pendingCellKey(rowId: string, col: keyof PfmeaRow) {
  return `${rowId}::${String(col)}`
}

export function usePfmeaPendingCellValues(rows: PfmeaRow[]) {
  const rowsRef = useRef<PfmeaRow[]>([])
  const pendingCellValuesRef = useRef<Record<string, unknown>>({})
  const [, setPendingCellRenderVersion] = useState(0)

  const refreshPendingCellRender = useCallback(() => {
    setPendingCellRenderVersion((prev) => prev + 1)
  }, [])

  const setPendingCellValue = useCallback((rowId: string, col: keyof PfmeaRow, value: unknown) => {
    const key = pendingCellKey(rowId, col)
    if (Object.is(pendingCellValuesRef.current[key], value)) return
    pendingCellValuesRef.current[key] = value
    refreshPendingCellRender()
  }, [refreshPendingCellRender])

  const clearPendingCellValue = useCallback((rowId: string, col: keyof PfmeaRow) => {
    const key = pendingCellKey(rowId, col)
    if (!(key in pendingCellValuesRef.current)) return
    delete pendingCellValuesRef.current[key]
    refreshPendingCellRender()
  }, [refreshPendingCellRender])

  const clearAllPendingCellValues = useCallback((options?: { refresh?: boolean }) => {
    pendingCellValuesRef.current = {}
    if (options?.refresh !== false) refreshPendingCellRender()
  }, [refreshPendingCellRender])

  const clearPendingCellValuesForRow = useCallback((rowId: string, options?: { refresh?: boolean }) => {
    pendingCellValuesRef.current = Object.fromEntries(
      Object.entries(pendingCellValuesRef.current).filter(([key]) => !key.startsWith(`${rowId}::`))
    )
    if (options?.refresh) refreshPendingCellRender()
  }, [refreshPendingCellRender])

  const clearPendingCellValuesForRows = useCallback((rowIds: string[], options?: { refresh?: boolean }) => {
    if (rowIds.length === 0) return
    pendingCellValuesRef.current = Object.fromEntries(
      Object.entries(pendingCellValuesRef.current).filter(([key]) => !rowIds.some((id) => key.startsWith(`${id}::`)))
    )
    if (options?.refresh) refreshPendingCellRender()
  }, [refreshPendingCellRender])

  const applyPendingCellValues = useCallback((row: PfmeaRow): PfmeaRow => {
    let next = row
    for (const [key, value] of Object.entries(pendingCellValuesRef.current)) {
      const [rowId, col] = key.split('::') as [string, keyof PfmeaRow]
      if (rowId !== row.id) continue
      if (next === row) next = { ...row }
      ;(next as PfmeaRow & { [key: string]: unknown })[String(col)] = value
    }
    return next
  }, [])

  useEffect(() => {
    rowsRef.current = rows
    const nextPending: Record<string, unknown> = {}
    for (const [key, pendingValue] of Object.entries(pendingCellValuesRef.current)) {
      const [rowId, col] = key.split('::') as [string, keyof PfmeaRow]
      const row = rows.find((item) => item.id === rowId)
      if (!row) {
        nextPending[key] = pendingValue
        continue
      }
      const actualValue = row[col]
      if (String(actualValue ?? '') !== String(pendingValue ?? '')) {
        nextPending[key] = pendingValue
      }
    }
    pendingCellValuesRef.current = nextPending
  }, [rows])

  return {
    applyPendingCellValues,
    clearAllPendingCellValues,
    clearPendingCellValue,
    clearPendingCellValuesForRow,
    clearPendingCellValuesForRows,
    pendingCellValuesRef,
    refreshPendingCellRender,
    rowsRef,
    setPendingCellValue,
  }
}
