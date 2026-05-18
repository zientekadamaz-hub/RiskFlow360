import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  DEFAULT_VISIBLE_COLUMNS,
  PCP_COLUMNS,
  PCP_COLUMNS_BY_ID,
  PCP_VISIBLE_COLUMNS_KEY_PREFIX,
  type PcpColumnId,
} from './pcp-page-model'

export function usePcpVisibleColumns(userId: string | null) {
  const [columnFiltersOpen, setColumnFiltersOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<PcpColumnId, boolean>>(DEFAULT_VISIBLE_COLUMNS)

  const isColumnVisible = useCallback(
    (id: PcpColumnId) => {
      return visibleColumns[id] !== false
    },
    [visibleColumns]
  )

  const toggleColumnVisibility = useCallback((id: PcpColumnId, checked: boolean) => {
    setVisibleColumns((prev) => ({ ...prev, [id]: checked }))
  }, [])

  const clearColumnGroup = useCallback((ids: PcpColumnId[]) => {
    setVisibleColumns((prev) => {
      const next = { ...prev }
      for (const id of ids) next[id] = true
      return next
    })
  }, [])

  const uncheckColumnGroup = useCallback((ids: PcpColumnId[]) => {
    setVisibleColumns((prev) => {
      const next = { ...prev }
      for (const id of ids) next[id] = false
      return next
    })
  }, [])

  const visibleColumnDefs = useMemo(() => PCP_COLUMNS.filter((col) => isColumnVisible(col.id)), [isColumnVisible])
  const visibleTableWidth = useMemo(() => visibleColumnDefs.reduce((acc, column) => acc + column.width, 0), [visibleColumnDefs])
  const widthOf = useCallback((id: PcpColumnId) => {
    const baseWidth = PCP_COLUMNS_BY_ID[id]?.width ?? 100
    const totalWidth = visibleTableWidth || baseWidth
    return `${(baseWidth / totalWidth) * 100}%`
  }, [visibleTableWidth])

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(`${PCP_VISIBLE_COLUMNS_KEY_PREFIX}:${userId}`)
        if (!raw) return
        const parsed = JSON.parse(raw) as Partial<Record<PcpColumnId, boolean>>
        const next: Record<PcpColumnId, boolean> = { ...DEFAULT_VISIBLE_COLUMNS }
        for (const col of PCP_COLUMNS) {
          const value = parsed?.[col.id]
          if (typeof value === 'boolean') next[col.id] = value
        }
        setVisibleColumns(next)
      } catch {}
    }, 0)
    return () => window.clearTimeout(timer)
  }, [userId])

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(`${PCP_VISIBLE_COLUMNS_KEY_PREFIX}:${userId}`, JSON.stringify(visibleColumns))
    } catch {}
  }, [userId, visibleColumns])

  return {
    clearColumnGroup,
    columnFiltersOpen,
    isColumnVisible,
    setColumnFiltersOpen,
    toggleColumnVisibility,
    uncheckColumnGroup,
    visibleColumnDefs,
    visibleTableWidth,
    widthOf,
  }
}
