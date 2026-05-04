import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_VISIBLE_COLUMNS,
  PFMEA_COLUMNS,
  type PfmeaColumnId,
} from './pfmea-columns'

const PFMEA_VISIBLE_COLUMNS_KEY_PREFIX = '__PFMEA_VISIBLE_COLUMNS__'

export function usePfmeaColumnVisibility(userId: string | null) {
  const [columnFiltersOpen, setColumnFiltersOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<PfmeaColumnId, boolean>>(DEFAULT_VISIBLE_COLUMNS)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!userId) return
    let alive = true
    const updateVisibleColumns = (next: Record<PfmeaColumnId, boolean>) => {
      queueMicrotask(() => {
        if (alive) setVisibleColumns(next)
      })
    }
    try {
      const raw = window.localStorage.getItem(`${PFMEA_VISIBLE_COLUMNS_KEY_PREFIX}:${userId}`)
      if (!raw) {
        updateVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
        return () => {
          alive = false
        }
      }
      const parsed = JSON.parse(raw) as Partial<Record<PfmeaColumnId, boolean>>
      const next: Record<PfmeaColumnId, boolean> = { ...DEFAULT_VISIBLE_COLUMNS }
      for (const col of PFMEA_COLUMNS) {
        const value = parsed?.[col.id]
        if (typeof value === 'boolean') next[col.id] = value
      }
      next.delete = true
      updateVisibleColumns(next)
    } catch {
      updateVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    }
    return () => {
      alive = false
    }
  }, [userId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!userId) return
    try {
      window.localStorage.setItem(`${PFMEA_VISIBLE_COLUMNS_KEY_PREFIX}:${userId}`, JSON.stringify(visibleColumns))
    } catch {}
  }, [userId, visibleColumns])

  const isColumnVisible = useCallback((id: PfmeaColumnId) => {
    // Keep the delete column width reserved in both modes so row wrapping/height
    // stays stable when toggling edit mode.
    if (id === 'delete') return true
    return visibleColumns[id] !== false
  }, [visibleColumns])

  const toggleColumnVisibility = useCallback((id: PfmeaColumnId, checked: boolean) => {
    setVisibleColumns((prev) => ({ ...prev, [id]: checked }))
  }, [])

  const clearColumnGroup = useCallback((ids: PfmeaColumnId[]) => {
    setVisibleColumns((prev) => {
      const next = { ...prev }
      for (const id of ids) next[id] = true
      return next
    })
  }, [])

  const uncheckColumnGroup = useCallback((ids: PfmeaColumnId[]) => {
    setVisibleColumns((prev) => {
      const next = { ...prev }
      for (const id of ids) next[id] = false
      next.delete = true
      return next
    })
  }, [])

  return {
    clearColumnGroup,
    columnFiltersOpen,
    isColumnVisible,
    setColumnFiltersOpen,
    toggleColumnVisibility,
    uncheckColumnGroup,
    visibleColumns,
  }
}
