import type { SupabaseClient } from '@supabase/supabase-js'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  createPfmeaMiniRow,
  fetchPfmeaMiniRows,
  updatePfmeaMiniRow,
} from './pfmea-mini-service'
import type { PfmeaMiniRow } from './types'

type ColKey = 'failure_mode' | 'effect' | 'cause' | 'severity' | 'occurrence' | 'detection'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function usePfdMiniPfmeaController({
  operationId,
  setError,
  supabase,
}: {
  operationId: string | null
  setError: (message: string) => void
  supabase: SupabaseClient
}) {
  const [rows, setRows] = useState<PfmeaMiniRow[]>([])
  const [edit, setEdit] = useState<{ rowId: string; col: ColKey } | null>(null)
  const editRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const colOrder = useMemo<ColKey[]>(() => ['failure_mode', 'effect', 'cause', 'severity', 'occurrence', 'detection'], [])

  const stopEdit = useCallback(() => setEdit(null), [])

  const loadRowsForOperation = useCallback(
    async (nextOperationId: string) => {
      try {
        const nextRows = await fetchPfmeaMiniRows(supabase, nextOperationId)
        setRows(nextRows)
      } catch (error) {
        setError(errorMessage(error))
        setRows([])
      }
    },
    [setError, supabase]
  )

  const reloadMini = useCallback(async () => {
    if (!operationId) return
    await loadRowsForOperation(operationId)
  }, [loadRowsForOperation, operationId])

  const addMiniRow = useCallback(async () => {
    if (!operationId) return
    setError('')
    try {
      await createPfmeaMiniRow(supabase, operationId)
      await reloadMini()
    } catch (error) {
      setError(errorMessage(error))
    }
  }, [operationId, reloadMini, setError, supabase])

  const updateMiniCell = useCallback(
    async (row: PfmeaMiniRow, patch: Partial<PfmeaMiniRow>) => {
      setError('')
      try {
        const nextRow = await updatePfmeaMiniRow(supabase, row, patch)
        setRows((currentRows) => currentRows.map((current) => (current.id === row.id ? nextRow : current)))
      } catch (error) {
        setError(errorMessage(error))
      }
    },
    [setError, supabase]
  )

  const colIndex = useCallback((col: ColKey) => colOrder.indexOf(col), [colOrder])
  const startEdit = useCallback((rowId: string, col: ColKey) => setEdit({ rowId, col }), [])

  useEffect(() => {
    if (!edit) return
    const timer = window.setTimeout(() => editRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [edit])

  const nextCell = useCallback(
    (rowIndex: number, colIdx: number) => {
      let c = colIdx + 1
      let r = rowIndex
      if (c >= colOrder.length) {
        c = 0
        r = Math.min(rowIndex + 1, Math.max(0, rows.length - 1))
      }
      return { r, c }
    },
    [colOrder, rows.length]
  )

  const prevCell = useCallback(
    (rowIndex: number, colIdx: number) => {
      let c = colIdx - 1
      let r = rowIndex
      if (c < 0) {
        c = colOrder.length - 1
        r = Math.max(rowIndex - 1, 0)
      }
      return { r, c }
    },
    [colOrder]
  )

  const handleCellKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
      rowIndex: number,
      colIdx: number,
      allowEnterNewline: boolean
    ) => {
      if (event.key === 'Enter' && allowEnterNewline) return

      if (event.key === 'Tab') {
        event.preventDefault()
        const pos = event.shiftKey ? prevCell(rowIndex, colIdx) : nextCell(rowIndex, colIdx)
        const nextRow = rows[pos.r]
        if (!nextRow) return
        setEdit({ rowId: nextRow.id, col: colOrder[pos.c] })
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        stopEdit()
      }
    },
    [colOrder, nextCell, prevCell, rows, stopEdit]
  )

  return {
    addMiniRow,
    colIndex,
    edit,
    editRef,
    handleCellKeyDown,
    loadRowsForOperation,
    reloadMini,
    rows,
    startEdit,
    stopEdit,
    updateMiniCell,
  }
}
