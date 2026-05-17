import React from 'react'

export const MERGED_CELL_STICKY_ROWSPAN = 2
export const MERGED_CELL_TOP_PADDING = 4
export const MERGED_CELL_BOTTOM_PADDING = 6

type PfmeaMergedCellStyle = React.CSSProperties & {
  '--pfmea-td-pad-top'?: string
  '--pfmea-td-pad-bottom'?: string
}

export function shouldUseMergedCellSticky(rowSpan?: number) {
  return (rowSpan ?? 0) >= MERGED_CELL_STICKY_ROWSPAN
}

export function mergedCellTdStyle(
  rowSpan?: number,
  style?: React.CSSProperties,
  options: { sticky?: boolean } = {}
): React.CSSProperties | undefined {
  if (options.sticky === false || !shouldUseMergedCellSticky(rowSpan)) return style
  const mergedStyle: PfmeaMergedCellStyle = {
    verticalAlign: 'top',
    overflow: 'visible',
    '--pfmea-td-pad-top': `${MERGED_CELL_TOP_PADDING}px`,
    '--pfmea-td-pad-bottom': `${MERGED_CELL_BOTTOM_PADDING}px`,
    ...(style ?? {}),
  }
  return mergedStyle
}

export function MergedCellInner(props: {
  rowSpan?: number
  children: React.ReactNode
  gap?: number
  sticky?: boolean
}) {
  const sticky = props.sticky !== false && shouldUseMergedCellSticky(props.rowSpan)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: props.gap ?? 8,
        width: '100%',
        ...(sticky
          ? {
              position: 'sticky',
              top: 'var(--pfmea-sticky-cell-top, 52px)',
              minHeight: 28,
              padding: 0,
              zIndex: 1,
            }
          : null),
      }}
    >
      {props.children}
    </div>
  )
}

export function TdRead(props: {
  value: string
  className: string
  style?: React.CSSProperties
  rowSpan?: number
  sticky?: boolean
  onClick?: () => void
}) {
  const sticky = props.sticky ?? true
  return (
    <td
      rowSpan={props.rowSpan}
      className={props.className}
      style={{
        ...(mergedCellTdStyle(props.rowSpan, props.style, { sticky }) ?? {}),
        cursor: props.onClick ? 'pointer' : undefined,
      }}
      onClick={props.onClick}
    >
      <MergedCellInner rowSpan={props.rowSpan} gap={0} sticky={sticky}>
        <span>{props.value || ''}</span>
      </MergedCellInner>
    </td>
  )
}
