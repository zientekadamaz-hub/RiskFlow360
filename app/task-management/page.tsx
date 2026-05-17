'use client'

import React, { useEffect, useState } from 'react'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import {
  SettingsFilterColumnHeader,
  SettingsHiddenColumnHeader,
} from '@/features/settings/column-filter-header'
import {
  SettingsBanner,
  SettingsPageShell,
  SettingsSummaryGrid,
  SettingsSummaryTile,
  getSettingsSummaryGridMaxWidth,
  settingsFrameStyle,
  settingsRiskSummaryTileStyle,
  settingsTableWrapStyle,
} from '@/components/rf-ui'
import {
  PROJECTS_PROCESS_ACCENT,
  projectsProcessCellStyle,
  projectsSummaryValueStyle,
  projectsTableShellStyle,
  projectsTableStyle,
  projectsTableViewportScrollerStyle,
} from '@/features/projects/view-styles'
import { getSessionUserWithRetries } from '@/lib/auth/client-session'
import {
  TaskResponsibleCell,
  TaskStatusCell,
  TaskTargetDateCell,
} from '@/features/tasks/task-table-cells'
import {
  EMPTY_SUMMARY,
  formatNumber,
  getTaskErrorMessage,
  isTaskOverdue,
  normalizeStatus,
  taskCenteredCellStyle,
  taskCenteredHeaderStyle,
  taskNumericCellStyle,
  taskNumericHeaderStyle,
  taskRpnValueStyle,
  taskTableCellStyle,
  taskTableHeaderStyle,
  type TaskColumnKey,
  type TaskFilterState,
  type TaskHiddenColumns,
  type TaskSortState,
  type TaskSummary,
} from '@/features/tasks/task-page-model'
import { useTaskTableController } from '@/features/tasks/use-task-table-controller'
import {
  fetchTaskActions,
  updateTaskActionDetails,
  updateTaskActionStatus,
  type TaskActionRow,
} from '@/features/tasks/task-service'

function TaskSummaryTiles({ summary }: { summary: TaskSummary }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
      <SettingsSummaryGrid columns={5} maxWidth={getSettingsSummaryGridMaxWidth(5)}>
      <SettingsSummaryTile label="Recommended actions" value={summary.total} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="Open actions" value={summary.openActions} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="In progress" value={summary.inProgress} style={settingsRiskSummaryTileStyle('yellow')} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="Overdue" value={summary.overdue} style={settingsRiskSummaryTileStyle('red')} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="Closed" value={summary.closed} style={settingsRiskSummaryTileStyle('green')} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      </SettingsSummaryGrid>
    </div>
  )
}

export default function TaskManagementPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<TaskActionRow[]>([])
  const [summary, setSummary] = useState<TaskSummary>(EMPTY_SUMMARY)
  const [customerBlocked, setCustomerBlocked] = useState(false)
  const [savingDetailsId, setSavingDetailsId] = useState<string | null>(null)
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadTaskActions = async ({ showLoading }: { showLoading: boolean }) => {
      if (showLoading) setLoading(true)
      setError('')
      try {
        const user = await getSessionUserWithRetries()
        if (!active) return
        if (!user) throw new Error('Cannot read user: Not authenticated.')

        const result = await fetchTaskActions(supabase, user.id)
        if (!active) return
        setCustomerBlocked(result.userCtx.isCustomer)
        setRows(result.rows)
        setSummary(result.summary)
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Could not load task actions.')
        setRows([])
        setSummary(EMPTY_SUMMARY)
      } finally {
        if (active && showLoading) setLoading(false)
      }
    }

    void loadTaskActions({ showLoading: true })

    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') return
      void loadTaskActions({ showLoading: false })
    }

    window.addEventListener('focus', refreshIfVisible)
    document.addEventListener('visibilitychange', refreshIfVisible)

    return () => {
      active = false
      window.removeEventListener('focus', refreshIfVisible)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [])

  const subtitle = 'Review and track PFMEA recommended actions assigned to active project work.'
  const {
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
  } = useTaskTableController({ openProjects: summary.openProjects, rows })

  async function changeTaskStatus(row: TaskActionRow, nextStatus: string) {
    const normalizedStatus = normalizeStatus(nextStatus)
    const previousStatus = row.status
    setError('')
    setSavingStatusId(row.id)
    setRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: normalizedStatus } : item)))

    try {
      await updateTaskActionStatus(supabase, {
        rowId: row.id,
        status: normalizedStatus,
      })
    } catch (updateError) {
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: previousStatus } : item)))
      setError(getTaskErrorMessage(updateError, 'Could not update task status.'))
    } finally {
      setSavingStatusId(null)
    }
  }

  async function changeTaskDetails(
    row: TaskActionRow,
    patch: Partial<Pick<TaskActionRow, 'responsible' | 'targetDate'>>
  ) {
    const responsible = 'responsible' in patch ? (patch.responsible?.trim() || '-') : row.responsible
    const targetDate = 'targetDate' in patch ? patch.targetDate || null : row.targetDate

    if (responsible === row.responsible && targetDate === row.targetDate) return

    const previous = row
    setError('')
    setSavingDetailsId(row.id)
    setRows((current) =>
      current.map((item) => (item.id === row.id ? { ...item, responsible, targetDate } : item))
    )

    try {
      const detailsPatch: {
        responsible?: string | null
        rowId: string
        targetDate?: string | null
      } = { rowId: row.id }

      if ('responsible' in patch) detailsPatch.responsible = responsible === '-' ? null : responsible
      if ('targetDate' in patch) detailsPatch.targetDate = targetDate

      await updateTaskActionDetails(supabase, detailsPatch)
    } catch (updateError) {
      setRows((current) => current.map((item) => (item.id === row.id ? previous : item)))
      setError(getTaskErrorMessage(updateError, 'Could not update task details.'))
    } finally {
      setSavingDetailsId(null)
    }
  }

  return (
    <SettingsPageShell
      title="Tasks"
      titleStyle={{ color: PROJECTS_PROCESS_ACCENT }}
      subtitle={subtitle}
      summary={<TaskSummaryTiles summary={headerSummary} />}
    >
      {error ? (
        <SettingsBanner tone="error">
          <b>Error:</b> {error}
        </SettingsBanner>
      ) : null}

      {customerBlocked ? (
        <SettingsBanner tone="neutral">
          Customer users do not have access to the internal task list.
        </SettingsBanner>
      ) : null}

      <div style={{ ...settingsFrameStyle, marginTop: 12, minHeight: 0 }}>
          <div
            style={{
              ...projectsTableShellStyle,
              ...settingsTableWrapStyle,
              padding: 0,
            }}
          >
            <div
              style={{
                ...projectsTableViewportScrollerStyle,
                maxHeight: 'calc(100vh - 206px)',
                overflowX: 'clip',
                width: '100%',
              }}
            >
              <table style={{ ...projectsTableStyle, maxWidth: '100%', minWidth: 0, width: '100%' }}>
                <colgroup>
                  <col style={{ width: columnWidths.process }} />
                  <col style={{ width: columnWidths.site }} />
                  <col style={{ width: columnWidths.failureMode }} />
                  <col style={{ width: columnWidths.rpn }} />
                  <col style={{ width: columnWidths.recommendedAction }} />
                  <col style={{ width: columnWidths.responsible }} />
                  <col style={{ width: columnWidths.targetDate }} />
                  <col style={{ width: columnWidths.status }} />
                  <col style={{ width: columnWidths.rpnAfter }} />
                </colgroup>
                <TasksTableHeader
                  filterOptions={filterOptions}
                  filters={filters}
                  hiddenColumns={hiddenColumns}
                  hiddenHeaderStyle={hiddenHeaderStyle}
                  setFilters={setFilters}
                  setHiddenColumns={setHiddenColumns}
                  setSortState={setSortState}
                />
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} style={taskTableCellStyle}>
                        Loading recommended actions...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={taskTableCellStyle}>
                        No recommended actions found for Open projects.
                      </td>
                    </tr>
                  ) : displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={taskTableCellStyle}>
                        No tasks match the current filters.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row) => (
                      <tr key={row.id} className="rowHover">
                        <td style={hiddenColumns.process ? hiddenCellStyle : taskTableCellStyle}>
                          {hiddenColumns.process ? null : <div style={projectsProcessCellStyle}>{row.process}</div>}
                        </td>
                        <td style={hiddenColumns.site ? hiddenCellStyle : taskCenteredCellStyle}>{hiddenColumns.site ? null : row.site}</td>
                        <td style={hiddenColumns.failureMode ? hiddenCellStyle : taskTableCellStyle}>{hiddenColumns.failureMode ? null : row.failureMode}</td>
                        <td style={hiddenColumns.rpn ? hiddenCellStyle : taskNumericCellStyle}>
                          {hiddenColumns.rpn ? null : (
                            <span style={taskRpnValueStyle(row.rpnColor, row.rpn)}>{formatNumber(row.rpn)}</span>
                          )}
                        </td>
                        <td style={hiddenColumns.recommendedAction ? hiddenCellStyle : taskTableCellStyle}>{hiddenColumns.recommendedAction ? null : row.recommendedAction}</td>
                        <td style={hiddenColumns.responsible ? hiddenCellStyle : taskCenteredCellStyle}>
                          {hiddenColumns.responsible ? null : (
                            <TaskResponsibleCell
                              disabled={savingDetailsId === row.id}
                              onSave={(responsible) => void changeTaskDetails(row, { responsible })}
                              value={row.responsible}
                            />
                          )}
                        </td>
                        <td
                          style={
                            hiddenColumns.targetDate
                              ? hiddenCellStyle
                              : {
                                  ...taskCenteredCellStyle,
                                  color: isTaskOverdue(row) ? '#fca5a5' : taskCenteredCellStyle.color,
                                  fontWeight: isTaskOverdue(row) ? 700 : taskCenteredCellStyle.fontWeight,
                                }
                          }
                        >
                          {hiddenColumns.targetDate ? null : (
                            <TaskTargetDateCell
                              disabled={savingDetailsId === row.id}
                              onSave={(targetDate) => void changeTaskDetails(row, { targetDate })}
                              overdue={isTaskOverdue(row)}
                              value={row.targetDate}
                            />
                          )}
                        </td>
                        <td style={hiddenColumns.status ? hiddenCellStyle : taskCenteredCellStyle}>
                          {hiddenColumns.status ? null : (
                            <TaskStatusCell
                              disabled={savingStatusId === row.id}
                              onChange={(nextStatus) => void changeTaskStatus(row, nextStatus)}
                              value={normalizeStatus(row.status)}
                            />
                          )}
                        </td>
                        <td style={hiddenColumns.rpnAfter ? hiddenCellStyle : taskNumericCellStyle}>
                          {hiddenColumns.rpnAfter ? null : (
                            <span style={taskRpnValueStyle(row.rpnAfterColor, row.rpnAfter)}>{formatNumber(row.rpnAfter)}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
      </div>
    </SettingsPageShell>
  )
}

function TasksTableHeader({
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
