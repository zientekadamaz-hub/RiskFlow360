import { useCallback, useEffect, useRef, useState } from 'react'

import type { PcpRow } from './pcp-service'

function pendingCellKey(rowId: string, col: keyof PcpRow) {
  return `${rowId}::${String(col)}`
}

export function usePcpPendingCellValues(rows: PcpRow[]) {
  const rowsRef = useRef<PcpRow[]>([])
  const pendingCellValuesRef = useRef<Record<string, unknown>>({})
  const [pendingCellValueCount, setPendingCellValueCount] = useState(0)
  const [, setPendingCellRenderVersion] = useState(0)

  const refreshPendingCellRender = useCallback(() => {
    setPendingCellValueCount(Object.keys(pendingCellValuesRef.current).length)
    setPendingCellRenderVersion((prev) => prev + 1)
  }, [])

  const setPendingCellValue = useCallback((rowId: string, col: keyof PcpRow, value: unknown) => {
    const key = pendingCellKey(rowId, col)
    if (Object.is(pendingCellValuesRef.current[key], value)) return
    pendingCellValuesRef.current[key] = value
    refreshPendingCellRender()
  }, [refreshPendingCellRender])

  const clearPendingCellValue = useCallback((rowId: string, col: keyof PcpRow) => {
    const key = pendingCellKey(rowId, col)
    if (!(key in pendingCellValuesRef.current)) return
    delete pendingCellValuesRef.current[key]
    refreshPendingCellRender()
  }, [refreshPendingCellRender])

  const clearAllPendingCellValues = useCallback((options?: { refresh?: boolean }) => {
    pendingCellValuesRef.current = {}
    setPendingCellValueCount(0)
    if (options?.refresh !== false) refreshPendingCellRender()
  }, [refreshPendingCellRender])

  const clearPendingCellValuesForRow = useCallback((rowId: string, options?: { refresh?: boolean }) => {
    pendingCellValuesRef.current = Object.fromEntries(
      Object.entries(pendingCellValuesRef.current).filter(([key]) => !key.startsWith(`${rowId}::`))
    )
    setPendingCellValueCount(Object.keys(pendingCellValuesRef.current).length)
    if (options?.refresh) refreshPendingCellRender()
  }, [refreshPendingCellRender])

  const applyPendingCellValues = useCallback((row: PcpRow): PcpRow => {
    let next = row
    for (const [key, value] of Object.entries(pendingCellValuesRef.current)) {
      const [rowId, col] = key.split('::') as [string, keyof PcpRow]
      if (rowId !== row.id) continue
      if (next === row) next = { ...row }
      ;(next as PcpRow & { [key: string]: unknown })[String(col)] = value
    }
    return next
  }, [])

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  return {
    applyPendingCellValues,
    clearAllPendingCellValues,
    clearPendingCellValue,
    clearPendingCellValuesForRow,
    pendingCellValueCount,
    pendingCellValuesRef,
    refreshPendingCellRender,
    rowsRef,
    setPendingCellValue,
  }
}
