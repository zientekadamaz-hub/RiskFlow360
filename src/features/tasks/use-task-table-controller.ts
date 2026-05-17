import { useMemo, useState } from 'react'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'

import {
  getSettingsTableColumnWidths,
  settingsHiddenTableColumnWidthPx,
} from '@/components/rf-ui'
import {
  DEFAULT_FILTERS,
  DEFAULT_HIDDEN_COLUMNS,
  TASK_COLUMN_BASE_WIDTHS,
  calculateTaskSummary,
  columnDisplayValue,
  columnSortValue,
  taskTableCellStyle,
  taskTableHeaderStyle,
  uniqueSorted,
  type TaskColumnKey,
  type TaskFilterState,
  type TaskHiddenColumns,
  type TaskSortState,
  type TaskSummary,
} from './task-page-model'
import type { TaskActionRow } from './task-service'

type UseTaskTableControllerArgs = {
  openProjects: number
  rows: TaskActionRow[]
}

type UseTaskTableControllerResult = {
  columnWidths: Record<TaskColumnKey | 'actions', string>
  displayedRows: TaskActionRow[]
  filterOptions: Record<TaskColumnKey, string[]>
  filters: TaskFilterState
  headerSummary: TaskSummary
  hiddenCellStyle: CSSProperties
  hiddenColumns: TaskHiddenColumns
  hiddenHeaderStyle: CSSProperties
  setFilters: Dispatch<SetStateAction<TaskFilterState>>
  setHiddenColumns: Dispatch<SetStateAction<TaskHiddenColumns>>
  setSortState: Dispatch<SetStateAction<TaskSortState>>
}

export function useTaskTableController({
  openProjects,
  rows,
}: UseTaskTableControllerArgs): UseTaskTableControllerResult {
  const [filters, setFilters] = useState<TaskFilterState>(DEFAULT_FILTERS)
  const [hiddenColumns, setHiddenColumns] = useState<TaskHiddenColumns>(DEFAULT_HIDDEN_COLUMNS)
  const [sortState, setSortState] = useState<TaskSortState>({ column: 'rpn', direction: 'desc' })

  const headerSummary = useMemo(() => calculateTaskSummary(rows, openProjects), [openProjects, rows])

  const filterOptions = useMemo(() => {
    const next = {} as Record<TaskColumnKey, string[]>
    ;(Object.keys(DEFAULT_HIDDEN_COLUMNS) as TaskColumnKey[]).forEach((column) => {
      next[column] = uniqueSorted(rows.map((row) => columnDisplayValue(row, column)))
    })
    return next
  }, [rows])

  const displayedRows = useMemo(() => {
    const next = rows.filter((row) => {
      return (Object.keys(filters) as TaskColumnKey[]).every((column) => {
        const selected = filters[column]
        if (selected === null) return true
        return selected.includes(columnDisplayValue(row, column))
      })
    })

    if (!sortState) return next

    return [...next].sort((left, right) => {
      const leftValue = columnSortValue(left, sortState.column)
      const rightValue = columnSortValue(right, sortState.column)
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

  const columnWidths = useMemo(
    () =>
      getSettingsTableColumnWidths<TaskColumnKey>({
        baseWidths: TASK_COLUMN_BASE_WIDTHS,
        hiddenColumns,
      }),
    [hiddenColumns]
  )

  const hiddenCellStyle: CSSProperties = {
    ...taskTableCellStyle,
    padding: '0 6px',
    width: settingsHiddenTableColumnWidthPx,
  }

  const hiddenHeaderStyle: CSSProperties = {
    ...taskTableHeaderStyle,
    padding: '0 6px',
    textAlign: 'center',
    width: settingsHiddenTableColumnWidthPx,
  }

  return {
    columnWidths,
    displayedRows,
    filterOptions,
    filters,
    headerSummary,
    hiddenCellStyle,
    hiddenColumns,
    hiddenHeaderStyle,
    setFilters,
    setHiddenColumns,
    setSortState,
  }
}
