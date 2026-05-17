'use client'

import React from 'react'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'

import {
  SettingsFilterColumnHeader,
  SettingsHiddenColumnHeader,
} from '@/features/settings/column-filter-header'
import {
  taskCenteredHeaderStyle,
  taskNumericHeaderStyle,
  taskTableHeaderStyle,
  type TaskColumnKey,
  type TaskFilterState,
  type TaskHiddenColumns,
  type TaskSortState,
} from './task-page-model'

export function TasksTableHeader({
  filterOptions,
  filters,
  hiddenColumns,
  hiddenHeaderStyle,
  setFilters,
  setHiddenColumns,
  setSortState,
}: {
  filterOptions: Record<TaskColumnKey, string[]>
  filters: TaskFilterState
  hiddenColumns: TaskHiddenColumns
  hiddenHeaderStyle: CSSProperties
  setFilters: Dispatch<SetStateAction<TaskFilterState>>
  setHiddenColumns: Dispatch<SetStateAction<TaskHiddenColumns>>
  setSortState: Dispatch<SetStateAction<TaskSortState>>
}) {
  const columns: Array<{ key: TaskColumnKey; label: string }> = [
    { key: 'process', label: 'Process' },
    { key: 'site', label: 'Site' },
    { key: 'failureMode', label: 'Failure mode' },
    { key: 'rpn', label: 'RPN' },
    { key: 'recommendedAction', label: 'Recommended action' },
    { key: 'responsible', label: 'Responsible' },
    { key: 'targetDate', label: 'Target date' },
    { key: 'status', label: 'Status' },
    { key: 'rpnAfter', label: 'RPN after' },
  ]
  const centeredColumns = new Set<TaskColumnKey>(['rpn', 'rpnAfter', 'site', 'responsible', 'targetDate', 'status'])

  return (
    <thead>
      <tr>
        {columns.map((column) => (
          <th
            key={column.key}
            style={
              hiddenColumns[column.key]
                ? hiddenHeaderStyle
                : column.key === 'rpn' || column.key === 'rpnAfter'
                  ? taskNumericHeaderStyle
                  : centeredColumns.has(column.key)
                    ? taskCenteredHeaderStyle
                    : taskTableHeaderStyle
            }
          >
            {hiddenColumns[column.key] ? (
              <SettingsHiddenColumnHeader
                label={column.label}
                onShow={() => setHiddenColumns((current) => ({ ...current, [column.key]: false }))}
              />
            ) : (
              <div style={{ maxWidth: '100%', minWidth: 0, overflow: 'hidden', textAlign: centeredColumns.has(column.key) ? 'center' : 'left' }}>
                <SettingsFilterColumnHeader
                  label={column.label}
                  values={filterOptions[column.key]}
                  selectedValues={filters[column.key] ?? filterOptions[column.key]}
                  onApplyValues={(values) => setFilters((current) => ({ ...current, [column.key]: values }))}
                  onSort={(direction) => setSortState({ column: column.key, direction })}
                  onHideColumn={() => setHiddenColumns((current) => ({ ...current, [column.key]: true }))}
                />
              </div>
            )}
          </th>
        ))}
      </tr>
    </thead>
  )
}
