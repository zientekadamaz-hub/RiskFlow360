'use client'

import {
  SettingsBanner,
  SettingsPageShell,
  SettingsSummaryGrid,
  SettingsSummaryTile,
  getSettingsSummaryGridMaxWidth,
  settingsFrameStyle,
  settingsRiskSummaryTileStyle,
  settingsTableScrollerStyle,
  settingsTableWrapStyle,
} from '@/components/rf-ui'
import {
  PROJECTS_PROCESS_ACCENT,
  projectsProcessCellStyle,
  projectsSummaryValueStyle,
  projectsTableShellStyle,
  projectsTableStyle,
} from '@/features/projects/view-styles'
import {
  TaskResponsibleCell,
  TaskStatusCell,
  TaskTargetDateCell,
} from '@/features/tasks/task-table-cells'
import { TasksTableHeader } from '@/features/tasks/task-table-header'
import {
  formatNumber,
  isTaskOverdue,
  normalizeStatus,
  taskCenteredCellStyle,
  taskNumericCellStyle,
  taskRpnValueStyle,
  TASK_TABLE_MIN_WIDTH,
  taskTableCellStyle,
  type TaskSummary,
} from '@/features/tasks/task-page-model'
import { useTaskActionsController } from '@/features/tasks/use-task-actions-controller'
import { useTaskTableController } from '@/features/tasks/use-task-table-controller'

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
  const {
    changeTaskDetails,
    changeTaskStatus,
    customerBlocked,
    error,
    loading,
    rows,
    savingDetailsId,
    savingStatusId,
    summary,
  } = useTaskActionsController()

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
                ...settingsTableScrollerStyle,
                maxHeight: 'calc(100vh - 206px)',
                overflowY: 'auto',
                width: '100%',
              }}
            >
              <table style={{ ...projectsTableStyle, minWidth: TASK_TABLE_MIN_WIDTH, width: '100%' }}>
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

