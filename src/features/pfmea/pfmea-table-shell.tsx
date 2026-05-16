import React from 'react'

import type { PfmeaColumnId } from './pfmea-columns'
import { PfmeaTableHeader } from './pfmea-table-header'

type PfmeaTableShellStyle = React.CSSProperties & {
  '--pfmea-sticky-cell-top'?: string
}

type PfmeaTableShellProps = {
  cardStyle: React.CSSProperties
  children: React.ReactNode
  isColumnVisible: (id: PfmeaColumnId) => boolean
  stickyMergedCellTop: number
  tableHeadRef: React.Ref<HTMLTableSectionElement>
  tableWrapRef: React.Ref<HTMLDivElement>
  visibleColumnDefs: Array<{ id: PfmeaColumnId; width: number }>
  visibleTableWidth: number
  widthOf: (id: PfmeaColumnId) => string
}

export function PfmeaTableShell({
  cardStyle,
  children,
  isColumnVisible,
  stickyMergedCellTop,
  tableHeadRef,
  tableWrapRef,
  visibleColumnDefs,
  visibleTableWidth,
  widthOf,
}: PfmeaTableShellProps) {
  const tableWrapStyle: React.CSSProperties = {
    ...cardStyle,
    padding: 0,
    borderRadius: cardStyle.borderRadius,
    overflow: 'visible',
  }

  const scrollStyle: PfmeaTableShellStyle = {
    maxHeight: 'calc(100vh - 280px)',
    overflowX: 'auto',
    overflowY: 'visible',
    '--pfmea-sticky-cell-top': `${stickyMergedCellTop}px`,
  }

  return (
    <div ref={tableWrapRef} style={tableWrapStyle}>
      <div className="pfmeaTable" style={scrollStyle}>
        <table
          style={{
            width: `${visibleTableWidth}px`,
            minWidth: `${visibleTableWidth}px`,
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            fontSize: 16,
            fontFamily: 'Calibri, Arial, sans-serif',
          }}
        >
          <PfmeaTableHeader
            isColumnVisible={(id) => isColumnVisible(id as PfmeaColumnId)}
            tableHeadRef={tableHeadRef}
            visibleColumnDefs={visibleColumnDefs}
            widthOf={(id) => widthOf(id as PfmeaColumnId)}
          />
          {children}
        </table>
      </div>
    </div>
  )
}
