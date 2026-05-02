'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import type { RiskColor } from '@/features/projects/types'
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
  getSettingsTableColumnWidths,
  settingsFrameStyle,
  settingsHiddenTableColumnWidthPx,
  settingsPopupItemStyle,
  settingsPopupPanelStyle,
  settingsProcessAccent,
  settingsRiskSummaryTileStyle,
  settingsTableWrapStyle,
} from '@/components/rf-ui'
import {
  PROJECTS_PROCESS_ACCENT,
  projectsAvgRpnStyle,
  projectsProcessCellStyle,
  projectsSummaryValueStyle,
  projectsTableCellStyle,
  projectsTableHeaderStyle,
  projectsTableShellStyle,
  projectsTableStyle,
  projectsTableViewportScrollerStyle,
} from '@/features/projects/view-styles'
import { getSessionUserWithRetries } from '@/lib/auth/client-session'
import { errorText } from '@/lib/error-utils'
import {
  fetchTaskActions,
  updateTaskActionDetails,
  updateTaskActionStatus,
  type TaskActionRow,
} from '@/features/tasks/task-service'
import type { RpnThresholds } from '@/features/projects/types'

type TaskSummary = {
  closed: number
  inProgress: number
  openActions: number
  openProjects: number
  overdue: number
  total: number
  withoutOwner: number
}

const EMPTY_SUMMARY: TaskSummary = {
  closed: 0,
  inProgress: 0,
  openActions: 0,
  openProjects: 0,
  overdue: 0,
  total: 0,
  withoutOwner: 0,
}

type TaskColumnKey =
  | 'failureMode'
  | 'process'
  | 'recommendedAction'
  | 'responsible'
  | 'rpn'
  | 'rpnAfter'
  | 'site'
  | 'status'
  | 'targetDate'

type TaskSortState = {
  column: TaskColumnKey
  direction: 'asc' | 'desc'
} | null

type TaskHiddenColumns = Record<TaskColumnKey, boolean>
type TaskFilterState = Record<TaskColumnKey, string[] | null>

const DEFAULT_HIDDEN_COLUMNS: TaskHiddenColumns = {
  failureMode: false,
  process: false,
  recommendedAction: false,
  responsible: false,
  rpn: false,
  rpnAfter: false,
  site: false,
  status: false,
  targetDate: false,
}

const DEFAULT_FILTERS: TaskFilterState = {
  failureMode: null,
  process: null,
  recommendedAction: null,
  responsible: null,
  rpn: null,
  rpnAfter: null,
  site: null,
  status: null,
  targetDate: null,
}

const TASK_COLUMN_BASE_WIDTHS: Record<TaskColumnKey | 'actions', number> = {
  process: 180,
  site: 68,
  failureMode: 150,
  rpn: 48,
  recommendedAction: 250,
  responsible: 98,
  targetDate: 76,
  status: 94,
  rpnAfter: 80,
  actions: 0,
}

const TASK_STATUS_OPTIONS = [
  { label: 'OPEN', value: 'OPEN' },
  { label: 'IN PROGRESS', value: 'IN PROGRESS' },
  { label: 'CLOSED', value: 'CLOSED' },
  { label: 'CANCELED', value: 'CANCELED' },
]

const taskVerticalLine = '1px solid rgba(255,255,255,0.08)'
const taskTableHeaderStyle: CSSProperties = {
  ...projectsTableHeaderStyle,
  borderRight: taskVerticalLine,
  boxSizing: 'border-box',
  fontSize: 12,
  overflow: 'hidden',
  padding: '8px 7px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const taskTableCellStyle: CSSProperties = {
  ...projectsTableCellStyle,
  borderRight: taskVerticalLine,
  boxSizing: 'border-box',
  fontSize: 14,
  overflow: 'hidden',
  padding: '8px 7px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const taskNumericCellStyle: CSSProperties = {
  ...taskTableCellStyle,
  paddingLeft: 5,
  paddingRight: 5,
  textAlign: 'center',
}
const taskNumericHeaderStyle: CSSProperties = {
  ...taskTableHeaderStyle,
  paddingLeft: 5,
  paddingRight: 5,
  textAlign: 'center',
}
const taskCenteredHeaderStyle: CSSProperties = {
  ...taskTableHeaderStyle,
  textAlign: 'center',
}
const taskCenteredCellStyle: CSSProperties = {
  ...taskTableCellStyle,
  textAlign: 'center',
}
const TASK_RPN_STYLE_THRESHOLDS: RpnThresholds = { greenMax: 100, yellowMax: 200, orangeMax: 360 }
const taskInlineInputStyle: CSSProperties = {
  width: '100%',
  minHeight: 24,
  border: '1px solid transparent',
  borderRadius: 6,
  outline: 'none',
  background: 'transparent',
  color: '#f8fafc',
  font: 'inherit',
  fontSize: 13,
  lineHeight: 1.2,
  padding: '2px 6px',
  textAlign: 'center',
}
const taskCalendarBorder = 'rgba(255,255,255,0.16)'
const taskCalendarMuted = 'rgba(255,255,255,0.72)'
const taskCalendarAccent = '#d9a86c'
const taskCalendarMonths = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const taskCalendarWeekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function formatDate(value: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function toDateInputValue(value: string | null) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function parseIsoDateParts(value: string | null | undefined) {
  const raw = (value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const [year, month, day] = raw.split('-').map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return { year, month: month - 1, day }
}

function formatIsoDate(year: number, month: number, day: number) {
  const yyyy = String(year).padStart(4, '0')
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function todayIsoDate() {
  const now = new Date()
  return formatIsoDate(now.getFullYear(), now.getMonth(), now.getDate())
}

function getCalendarCells(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const leading = (firstWeekday + 6) % 7
  const totalDays = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ key: string; day: number | null }> = []

  for (let i = 0; i < leading; i += 1) cells.push({ key: `empty-start-${i}`, day: null })
  for (let day = 1; day <= totalDays; day += 1) cells.push({ key: `day-${year}-${month}-${day}`, day })
  while (cells.length % 7 !== 0) cells.push({ key: `empty-end-${cells.length}`, day: null })
  return cells
}

function anchoredPopupStyle(anchorEl: HTMLElement | null, width: number, topGap = 8, maxHeight = 320): CSSProperties {
  if (typeof window === 'undefined' || !anchorEl) {
    return {
      position: 'fixed',
      top: 0,
      left: 0,
      width,
      maxHeight,
      visibility: 'hidden',
      pointerEvents: 'none',
    }
  }

  const rect = anchorEl.getBoundingClientRect()
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
  const desiredHeight = Math.min(maxHeight, Math.max(160, window.innerHeight - 24))
  const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - topGap - 12)
  const spaceAbove = Math.max(0, rect.top - topGap - 12)
  const openAbove = spaceBelow < Math.min(desiredHeight, 220) && spaceAbove > spaceBelow
  const effectiveMaxHeight = Math.min(desiredHeight, Math.max(120, openAbove ? spaceAbove : spaceBelow))

  if (openAbove) {
    return {
      position: 'fixed',
      bottom: window.innerHeight - rect.top + topGap,
      left,
      width,
      maxHeight: effectiveMaxHeight,
    }
  }

  return {
    position: 'fixed',
    top: rect.bottom + topGap,
    left,
    width,
    maxHeight: effectiveMaxHeight,
  }
}

function formatNumber(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'
  return String(Math.round(value))
}

function taskRpnValueStyle(color: RiskColor | null, value: number | null): CSSProperties {
  if (!color) return projectsAvgRpnStyle(value, TASK_RPN_STYLE_THRESHOLDS)
  const valueByColor: Record<RiskColor, number> = {
    green: TASK_RPN_STYLE_THRESHOLDS.greenMax,
    yellow: TASK_RPN_STYLE_THRESHOLDS.yellowMax,
    orange: TASK_RPN_STYLE_THRESHOLDS.orangeMax,
    red: TASK_RPN_STYLE_THRESHOLDS.orangeMax + 1,
  }
  return projectsAvgRpnStyle(valueByColor[color], TASK_RPN_STYLE_THRESHOLDS)
}

function getTaskErrorMessage(error: unknown, fallback: string) {
  return errorText(error, fallback)
}

function normalizeStatus(value: string) {
  const normalized = value.trim().toUpperCase()
  if (!normalized) return 'OPEN'
  if (['DONE', 'COMPLETE', 'COMPLETED', 'CLOSED'].includes(normalized)) return 'CLOSED'
  if (['CANCELED', 'CANCELLED'].includes(normalized)) return 'CANCELED'
  if (['IN_PROGRESS', 'IN PROGRESS', 'ONGOING'].includes(normalized)) return 'IN PROGRESS'
  return normalized
}

function isTaskOverdue(row: Pick<TaskActionRow, 'status' | 'targetDate'>) {
  if (!row.targetDate) return false
  if (['CLOSED', 'CANCELED'].includes(normalizeStatus(row.status))) return false

  const parsed = new Date(row.targetDate)
  if (Number.isNaN(parsed.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  parsed.setHours(0, 0, 0, 0)
  return parsed < today
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
  )
}

function columnDisplayValue(row: TaskActionRow, column: TaskColumnKey) {
  if (column === 'process') return row.process
  if (column === 'site') return row.site
  if (column === 'failureMode') return row.failureMode
  if (column === 'rpn') return formatNumber(row.rpn)
  if (column === 'recommendedAction') return row.recommendedAction
  if (column === 'responsible') return row.responsible
  if (column === 'targetDate') return formatDate(row.targetDate)
  if (column === 'status') return normalizeStatus(row.status)
  return formatNumber(row.rpnAfter)
}

function columnSortValue(row: TaskActionRow, column: TaskColumnKey) {
  if (column === 'rpn') return row.rpn ?? -1
  if (column === 'rpnAfter') return row.rpnAfter ?? -1
  if (column === 'targetDate') return row.targetDate ? new Date(row.targetDate).getTime() : Number.MAX_SAFE_INTEGER
  return columnDisplayValue(row, column)
}

function calculateTaskSummary(rows: TaskActionRow[], openProjects: number): TaskSummary {
  return {
    closed: rows.filter((row) => normalizeStatus(row.status) === 'CLOSED').length,
    inProgress: rows.filter((row) => normalizeStatus(row.status) === 'IN PROGRESS').length,
    openActions: rows.filter((row) => normalizeStatus(row.status) === 'OPEN').length,
    openProjects,
    overdue: rows.filter(isTaskOverdue).length,
    total: rows.length,
    withoutOwner: rows.filter((row) => row.responsible === '-').length,
  }
}

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
  const [filters, setFilters] = useState<TaskFilterState>(DEFAULT_FILTERS)
  const [hiddenColumns, setHiddenColumns] = useState<TaskHiddenColumns>(DEFAULT_HIDDEN_COLUMNS)
  const [savingDetailsId, setSavingDetailsId] = useState<string | null>(null)
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null)
  const [sortState, setSortState] = useState<TaskSortState>({ column: 'rpn', direction: 'desc' })

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
  const headerSummary = useMemo(() => calculateTaskSummary(rows, summary.openProjects), [rows, summary.openProjects])

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

function TaskResponsibleCell({
  disabled,
  onSave,
  value,
}: {
  disabled?: boolean
  onSave: (value: string) => void
  value: string
}) {
  const [draft, setDraft] = useState(value === '-' ? '' : value)

  const commit = () => {
    const next = draft.trim() || '-'
    if (next !== value) onSave(next)
  }

  return (
    <input
      aria-label="Responsible"
      disabled={disabled}
      value={draft}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          setDraft(value === '-' ? '' : value)
          event.currentTarget.blur()
        }
      }}
      placeholder="-"
      style={{
        ...taskInlineInputStyle,
        cursor: disabled ? 'not-allowed' : 'text',
        opacity: disabled ? 0.62 : 1,
      }}
    />
  )
}

function TaskTargetDateCell({
  disabled,
  onSave,
  overdue,
  value,
}: {
  disabled?: boolean
  onSave: (value: string | null) => void
  overdue: boolean
  value: string | null
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [popupStyle, setPopupStyle] = useState<CSSProperties | null>(null)
  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = parseIsoDateParts(toDateInputValue(value))
    if (parsed) return { year: parsed.year, month: parsed.month }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  useEffect(() => {
    if (!open) return

    const updatePopupPosition = () => {
      setPopupStyle(anchoredPopupStyle(triggerRef.current, 252, 8, 320))
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return
      setOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', updatePopupPosition)
    window.addEventListener('scroll', updatePopupPosition, true)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', updatePopupPosition)
      window.removeEventListener('scroll', updatePopupPosition, true)
    }
  }, [open])

  const selectedIso = toDateInputValue(value)
  const todayIso = todayIsoDate()
  const calendarCells = getCalendarCells(viewMonth.year, viewMonth.month)

  const changeMonth = (delta: number) => {
    setViewMonth((current) => {
      const nextDate = new Date(current.year, current.month + delta, 1)
      return { year: nextDate.getFullYear(), month: nextDate.getMonth() }
    })
  }

  const pickDate = (day: number) => {
    const nextValue = formatIsoDate(viewMonth.year, viewMonth.month, day)
    setOpen(false)
    onSave(nextValue)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Target date"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          const nextOpen = !open
          if (nextOpen) {
            const parsed = parseIsoDateParts(toDateInputValue(value))
            if (parsed) {
              setViewMonth({ year: parsed.year, month: parsed.month })
            } else {
              const now = new Date()
              setViewMonth({ year: now.getFullYear(), month: now.getMonth() })
            }
            setPopupStyle(anchoredPopupStyle(triggerRef.current, 252, 8, 320))
          }
          setOpen(nextOpen)
        }}
        style={{
          ...taskInlineInputStyle,
          alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          fontWeight: overdue ? 700 : 400,
          justifyContent: 'center',
          opacity: disabled ? 0.62 : 1,
        }}
      >
        <span style={{ color: overdue ? '#fca5a5' : '#f8fafc' }}>{formatDate(value)}</span>
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popupRef}
              role="dialog"
              aria-label="Target date calendar"
              style={{
                ...(popupStyle ?? anchoredPopupStyle(null, 252, 8, 320)),
                zIndex: 120,
                borderRadius: 10,
                border: `1px solid ${taskCalendarBorder}`,
                background: 'rgb(52, 57, 69)',
                boxShadow: '0 14px 32px rgba(0,0,0,0.16)',
                padding: 10,
                display: 'grid',
                gap: 10,
                position: 'fixed',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => changeMonth(-1)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: `1px solid ${taskCalendarBorder}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: taskCalendarAccent,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ‹
                </button>
                <div style={{ fontSize: 13, color: taskCalendarAccent, fontWeight: 700 }}>
                  {taskCalendarMonths[viewMonth.month]} {viewMonth.year}
                </div>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => changeMonth(1)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: `1px solid ${taskCalendarBorder}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: taskCalendarAccent,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ›
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {taskCalendarWeekdays.map((label) => (
                  <div key={label} style={{ textAlign: 'center', fontSize: 11, color: taskCalendarMuted, fontWeight: 700, paddingBottom: 2 }}>
                    {label}
                  </div>
                ))}
                {calendarCells.map((cell) =>
                  cell.day == null ? (
                    <div key={cell.key} style={{ height: 30 }} />
                  ) : (
                    <button
                      key={cell.key}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pickDate(cell.day!)}
                      style={{
                        height: 30,
                        borderRadius: 8,
                        border: `1px solid ${
                          formatIsoDate(viewMonth.year, viewMonth.month, cell.day) === selectedIso
                            ? 'rgba(96, 165, 250, 0.55)'
                            : 'transparent'
                        }`,
                        background:
                          formatIsoDate(viewMonth.year, viewMonth.month, cell.day) === selectedIso
                            ? 'rgba(96, 165, 250, 0.18)'
                            : formatIsoDate(viewMonth.year, viewMonth.month, cell.day) === todayIso
                              ? 'rgba(255,255,255,0.08)'
                              : 'transparent',
                        color: taskCalendarAccent,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {cell.day}
                    </button>
                  )
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setOpen(false)
                    onSave(null)
                  }}
                  style={{
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: `1px solid ${taskCalendarBorder}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: taskCalendarAccent,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setOpen(false)
                    onSave(todayIsoDate())
                  }}
                  style={{
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: `1px solid ${taskCalendarBorder}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: taskCalendarAccent,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Today
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

function TaskStatusCell({
  disabled,
  onChange,
  value,
}: {
  disabled?: boolean
  onChange: (value: string) => void
  value: string
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null)

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      setPosition({
        left: Math.max(12, rect.left + rect.width / 2 - 70),
        top: rect.bottom + 8,
        width: 140,
      })
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    updatePosition()
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return
          setOpen((current) => !current)
        }}
        style={{
          width: '100%',
          minHeight: 18,
          border: 0,
          outline: 'none',
          background: 'transparent',
          color: settingsProcessAccent,
          cursor: disabled ? 'not-allowed' : 'pointer',
          font: 'inherit',
          fontSize: 12,
          fontWeight: 400,
          lineHeight: 1.25,
          margin: 0,
          opacity: disabled ? 0.62 : 1,
          padding: 0,
          textAlign: 'center',
        }}
      >
        {value || '-'}
      </button>

      {open && position && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              style={{
                ...settingsPopupPanelStyle,
                left: position.left,
                padding: 6,
                position: 'fixed',
                top: position.top,
                width: position.width,
                zIndex: 120,
              }}
            >
              {TASK_STATUS_OPTIONS.map((option) => {
                const selected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitem"
                    className="settings-popup-button"
                    onClick={() => {
                      setOpen(false)
                      onChange(option.value)
                    }}
                    style={{
                      ...settingsPopupItemStyle(selected),
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>,
            document.body
          )
        : null}
    </>
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
