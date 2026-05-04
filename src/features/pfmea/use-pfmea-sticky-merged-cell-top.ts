import { RefObject, useEffect, useState } from 'react'
import { MERGED_CELL_TOP_PADDING } from './pfmea-merged-cell'

export function usePfmeaStickyMergedCellTop(
  tableHeadRef: RefObject<HTMLTableSectionElement | null>,
  visibleColumnsVersion: unknown
) {
  const [stickyMergedCellTop, setStickyMergedCellTop] = useState(52)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateStickyMergedCellTop = () => {
      const headerHeight = tableHeadRef.current?.getBoundingClientRect().height ?? 0
      const next = Math.max(44, Math.ceil(headerHeight) + MERGED_CELL_TOP_PADDING)
      setStickyMergedCellTop((current) => (current === next ? current : next))
    }

    updateStickyMergedCellTop()

    const rafId = window.requestAnimationFrame(updateStickyMergedCellTop)
    window.addEventListener('resize', updateStickyMergedCellTop)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', updateStickyMergedCellTop)
    }
  }, [tableHeadRef, visibleColumnsVersion])

  return stickyMergedCellTop
}
