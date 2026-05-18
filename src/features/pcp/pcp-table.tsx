import React, { useMemo, useState } from 'react'
import {
  settingsTableScrollerStyle,
  settingsTableStyle,
  settingsTableWrapStyle,
} from '@/components/rf-ui'
import {
  SettingsFilterColumnHeader,
  SettingsHiddenColumnHeader,
} from '@/features/settings/column-filter-header'

import { asInt1to10 } from './pcp-utils'
import {
  DEFAULT_PCP_FILTERS,
  PCP_COLUMNS,
  pcpColumnDisplayValue,
  pcpColumnSortValue,
  uniqueSortedPcpValues,
  type PcpColumnId,
  type PcpFilterState,
  type PcpSortState,
} from './pcp-page-model'
import type { PcpRow } from './pcp-service'
import {
  pcpHiddenTableCellStyle,
  pcpHiddenTableHeaderStyle,
  pcpTableCellStyle,
  pcpTableHeaderStyle,
  TdClassPopup,
  TdRead,
  TdText,
} from './pcp-table-cells'

export type PcpEditCell = { rowId: string; col: keyof PcpRow } | null

type PcpTableProps = {
  cardStyle: React.CSSProperties
  edit: PcpEditCell
  isColumnVisible: (id: PcpColumnId) => boolean
  pcpYellowMax: number
  readOnly: boolean
  rows: PcpRow[]
  setEdit: React.Dispatch<React.SetStateAction<PcpEditCell>>
  toggleColumnVisibility: (id: PcpColumnId, checked: boolean) => void
  updateRow: (row: PcpRow, patch: Partial<PcpRow>) => void | Promise<void>
  visibleColumnDefs: Array<{ id: PcpColumnId }>
  visibleTableWidth: number
  widthOf: (id: PcpColumnId) => string
}

const highlightedMetricStyle: React.CSSProperties = {
  color: '#d9a86c',
}

export function PcpTable({
  cardStyle,
  edit,
  isColumnVisible,
  pcpYellowMax,
  readOnly,
  rows,
  setEdit,
  toggleColumnVisibility,
  updateRow,
  visibleColumnDefs,
  visibleTableWidth,
  widthOf,
}: PcpTableProps) {
  const [filters, setFilters] = useState<PcpFilterState>(DEFAULT_PCP_FILTERS)
  const [sortState, setSortState] = useState<PcpSortState>(null)

  const filterOptions = useMemo(() => {
    const next = {} as Record<PcpColumnId, string[]>
    PCP_COLUMNS.forEach((column) => {
      next[column.id] = uniqueSortedPcpValues(rows.map((row) => pcpColumnDisplayValue(row, column.id)))
    })
    return next
  }, [rows])

  const displayedRows = useMemo(() => {
    const next = rows.filter((row) => {
      return PCP_COLUMNS.every((column) => {
        const selected = filters[column.id]
        if (selected === null) return true
        return selected.includes(pcpColumnDisplayValue(row, column.id))
      })
    })

    if (!sortState) return next

    return [...next].sort((left, right) => {
      const leftValue = pcpColumnSortValue(left, sortState.column)
      const rightValue = pcpColumnSortValue(right, sortState.column)
      let comparison = 0
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        comparison = leftValue - rightValue
      } else {
        comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      }
      return sortState.direction === 'asc' ? comparison : -comparison
    })
  }, [filters, rows, sortState])

  return (
    <div style={{ ...cardStyle, ...settingsTableWrapStyle, padding: 0, overflow: 'hidden' }}>
      <div
        className="pcpTable"
        style={{
          ...settingsTableScrollerStyle,
          maxHeight: 'calc(100vh - 280px)',
          overflowY: 'auto',
        }}
      >
        <table style={{ ...settingsTableStyle, minWidth: `${visibleTableWidth}px` }}>
          <colgroup>{visibleColumnDefs.map((c) => <col key={c.id} style={{ width: widthOf(c.id) }} />)}</colgroup>
          <thead>
            <tr>
              {visibleColumnDefs.map((column) => (
                <th
                  key={column.id}
                  style={isColumnVisible(column.id) ? pcpTableHeaderStyle : pcpHiddenTableHeaderStyle}
                >
                  {isColumnVisible(column.id) ? (
                    <div style={{ maxWidth: '100%', minWidth: 0, overflow: 'hidden', textAlign: 'center' }}>
                      <SettingsFilterColumnHeader
                        label={PCP_COLUMNS.find((item) => item.id === column.id)?.label ?? column.id}
                        values={filterOptions[column.id]}
                        selectedValues={filters[column.id] ?? filterOptions[column.id]}
                        onApplyValues={(values) => setFilters((current) => ({ ...current, [column.id]: values }))}
                        onSort={(direction) => setSortState({ column: column.id, direction })}
                        onHideColumn={() => toggleColumnVisibility(column.id, false)}
                      />
                    </div>
                  ) : (
                    <SettingsHiddenColumnHeader
                      label={PCP_COLUMNS.find((item) => item.id === column.id)?.label ?? column.id}
                      onShow={() => toggleColumnVisibility(column.id, true)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnDefs.length} style={pcpTableCellStyle}>
                  {rows.length === 0 ? 'No PCP rows found.' : 'No PCP rows match the current filters.'}
                </td>
              </tr>
            ) : displayedRows.map((r) => {
              const severityValue = asInt1to10(r.severity)
              const severityHighlighted = severityValue != null && severityValue >= 9
              const rpnValue = typeof r.rpn === 'number' && Number.isFinite(r.rpn) ? r.rpn : null
              const rpnHighlighted = rpnValue != null && rpnValue > pcpYellowMax

              return (
                <tr key={r.id} className="pcpRow rowHover">
                  {isColumnVisible('id') ? <TdRead value={String(r.operations?.operation_number ?? '-')} className="pcpTd center singleLine" /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('station') ? <TdRead value={r.operations?.machine ?? ''} className="pcpTd singleLine" /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('operation') ? <TdRead value={r.operations?.operation ?? ''} className="pcpTd singleLine" /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('process_step') ? <TdRead value={r.operations?.name ?? ''} className="pcpTd singleLine" /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('failure_mode') ? <TdText value={r.failure_mode} editing={edit?.rowId === r.id && edit?.col === 'failure_mode'} onStart={() => setEdit({ rowId: r.id, col: 'failure_mode' })} onCommit={(v) => void updateRow(r, { failure_mode: v })} onCancel={() => setEdit(null)} disabled={readOnly} className="gray" /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('characteristic') ? <TdText value={r.characteristic} editing={edit?.rowId === r.id && edit?.col === 'characteristic'} onStart={() => setEdit({ rowId: r.id, col: 'characteristic' })} onCommit={(v) => void updateRow(r, { characteristic: v })} onCancel={() => setEdit(null)} disabled={readOnly} className="gray" /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('class') ? <TdClassPopup value={r.class} editing={edit?.rowId === r.id && edit?.col === 'class'} onStart={() => setEdit({ rowId: r.id, col: 'class' })} onCommit={(v) => void updateRow(r, { class: v || null })} onCancel={() => setEdit(null)} disabled={readOnly} /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('severity') ? <TdRead value={r.severity == null ? '' : String(r.severity)} className="pcpTd center singleLine" style={severityHighlighted ? highlightedMetricStyle : undefined} /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('rpn') ? <TdRead value={r.rpn == null ? '' : String(r.rpn)} className="pcpTd center singleLine" style={rpnHighlighted ? highlightedMetricStyle : undefined} /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('current_prevention') ? <TdText value={r.current_prevention} editing={edit?.rowId === r.id && edit?.col === 'current_prevention'} onStart={() => setEdit({ rowId: r.id, col: 'current_prevention' })} onCommit={(v) => void updateRow(r, { current_prevention: v })} onCancel={() => setEdit(null)} disabled={readOnly} className="gray" /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('current_detection') ? <TdText value={r.current_detection} editing={edit?.rowId === r.id && edit?.col === 'current_detection'} onStart={() => setEdit({ rowId: r.id, col: 'current_detection' })} onCommit={(v) => void updateRow(r, { current_detection: v })} onCancel={() => setEdit(null)} disabled={readOnly} className="gray" /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('control_method') ? <TdText value={r.control_method} editing={edit?.rowId === r.id && edit?.col === 'control_method'} onStart={() => setEdit({ rowId: r.id, col: 'control_method' })} onCommit={(v) => void updateRow(r, { control_method: v })} onCancel={() => setEdit(null)} disabled={readOnly} /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('sample_size') ? <TdText value={r.sample_size} editing={edit?.rowId === r.id && edit?.col === 'sample_size'} onStart={() => setEdit({ rowId: r.id, col: 'sample_size' })} onCommit={(v) => void updateRow(r, { sample_size: v })} onCancel={() => setEdit(null)} disabled={readOnly} singleLine /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('frequency') ? <TdText value={r.frequency} editing={edit?.rowId === r.id && edit?.col === 'frequency'} onStart={() => setEdit({ rowId: r.id, col: 'frequency' })} onCommit={(v) => void updateRow(r, { frequency: v })} onCancel={() => setEdit(null)} disabled={readOnly} singleLine /> : <td style={pcpHiddenTableCellStyle} />}
                  {isColumnVisible('reaction_plan') ? <TdText value={r.reaction_plan} editing={edit?.rowId === r.id && edit?.col === 'reaction_plan'} onStart={() => setEdit({ rowId: r.id, col: 'reaction_plan' })} onCommit={(v) => void updateRow(r, { reaction_plan: v })} onCancel={() => setEdit(null)} disabled={readOnly} /> : <td style={pcpHiddenTableCellStyle} />}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
