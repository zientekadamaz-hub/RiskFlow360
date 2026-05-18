import type { CSSProperties } from 'react'

import type { RiskColor, RpnThresholds } from '@/features/projects/types'
import {
  projectsAvgRpnStyle,
  projectsTableCellStyle,
  projectsTableHeaderStyle,
} from '@/features/projects/view-styles'
import { errorText } from '@/lib/error-utils'
import type { TaskActionRow } from './task-service'
import { isTerminalTaskStatus, normalizeTaskStatus } from './task-status-utils'

export type TaskSummary = {
  closed: number
  inProgress: number
  openActions: number
  openProjects: number
  overdue: number
  total: number
  withoutOwner: number
}

export const EMPTY_SUMMARY: TaskSummary = {
  closed: 0,
  inProgress: 0,
  openActions: 0,
  openProjects: 0,
  overdue: 0,
  total: 0,
  withoutOwner: 0,
}

export type TaskColumnKey =
  | 'failureMode'
  | 'process'
  | 'recommendedAction'
  | 'responsible'
  | 'rpn'
  | 'rpnAfter'
  | 'site'
  | 'status'
  | 'targetDate'

export type TaskSortState = {
  column: TaskColumnKey
  direction: 'asc' | 'desc'
} | null

export type TaskHiddenColumns = Record<TaskColumnKey, boolean>
export type TaskFilterState = Record<TaskColumnKey, string[] | null>

export const DEFAULT_HIDDEN_COLUMNS: TaskHiddenColumns = {
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

export const DEFAULT_FILTERS: TaskFilterState = {
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

export const TASK_COLUMN_BASE_WIDTHS: Record<TaskColumnKey | 'actions', number> = {
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
export const TASK_TABLE_MIN_WIDTH = Object.values(TASK_COLUMN_BASE_WIDTHS).reduce((sum, width) => sum + width, 0)

export const TASK_STATUS_OPTIONS = [
  { label: 'OPEN', value: 'OPEN' },
  { label: 'IN PROGRESS', value: 'IN PROGRESS' },
  { label: 'CLOSED', value: 'CLOSED' },
  { label: 'CANCELED', value: 'CANCELED' },
]

const taskVerticalLine = '1px solid rgba(255,255,255,0.08)'
export const taskTableHeaderStyle: CSSProperties = {
  ...projectsTableHeaderStyle,
  borderRight: taskVerticalLine,
  boxSizing: 'border-box',
  fontSize: 12,
  overflow: 'hidden',
  padding: '8px 7px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
export const taskTableCellStyle: CSSProperties = {
  ...projectsTableCellStyle,
  borderRight: taskVerticalLine,
  boxSizing: 'border-box',
  fontSize: 14,
  overflow: 'hidden',
  padding: '8px 7px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
export const taskNumericCellStyle: CSSProperties = {
  ...taskTableCellStyle,
  paddingLeft: 5,
  paddingRight: 5,
  textAlign: 'center',
}
export const taskNumericHeaderStyle: CSSProperties = {
  ...taskTableHeaderStyle,
  paddingLeft: 5,
  paddingRight: 5,
  textAlign: 'center',
}
export const taskCenteredHeaderStyle: CSSProperties = {
  ...taskTableHeaderStyle,
  textAlign: 'center',
}
export const taskCenteredCellStyle: CSSProperties = {
  ...taskTableCellStyle,
  textAlign: 'center',
}
export const TASK_RPN_STYLE_THRESHOLDS: RpnThresholds = { greenMax: 100, yellowMax: 200, orangeMax: 360 }
export const taskInlineInputStyle: CSSProperties = {
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

export const taskCalendarBorder = 'rgba(255,255,255,0.16)'
export const taskCalendarMuted = 'rgba(255,255,255,0.72)'
export const taskCalendarAccent = '#d9a86c'
export const taskCalendarMonths = [
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
export const taskCalendarWeekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function formatDate(value: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function toDateInputValue(value: string | null) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

export function parseIsoDateParts(value: string | null | undefined) {
  const raw = (value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const [year, month, day] = raw.split('-').map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return { year, month: month - 1, day }
}

export function formatIsoDate(year: number, month: number, day: number) {
  const yyyy = String(year).padStart(4, '0')
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function todayIsoDate() {
  const now = new Date()
  return formatIsoDate(now.getFullYear(), now.getMonth(), now.getDate())
}

export function getCalendarCells(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const leading = (firstWeekday + 6) % 7
  const totalDays = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ key: string; day: number | null }> = []

  for (let index = 0; index < leading; index += 1) cells.push({ key: `empty-start-${index}`, day: null })
  for (let day = 1; day <= totalDays; day += 1) cells.push({ key: `day-${year}-${month}-${day}`, day })
  while (cells.length % 7 !== 0) cells.push({ key: `empty-end-${cells.length}`, day: null })
  return cells
}

export function anchoredPopupStyle(anchorEl: HTMLElement | null, width: number, topGap = 8, maxHeight = 320): CSSProperties {
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

export function formatNumber(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'
  return String(Math.round(value))
}

export function taskRpnValueStyle(color: RiskColor | null, value: number | null): CSSProperties {
  if (!color) return projectsAvgRpnStyle(value, TASK_RPN_STYLE_THRESHOLDS)
  const valueByColor: Record<RiskColor, number> = {
    green: TASK_RPN_STYLE_THRESHOLDS.greenMax,
    yellow: TASK_RPN_STYLE_THRESHOLDS.yellowMax,
    orange: TASK_RPN_STYLE_THRESHOLDS.orangeMax,
    red: TASK_RPN_STYLE_THRESHOLDS.orangeMax + 1,
  }
  return projectsAvgRpnStyle(valueByColor[color], TASK_RPN_STYLE_THRESHOLDS)
}

export function getTaskErrorMessage(error: unknown, fallback: string) {
  return errorText(error, fallback)
}

export function normalizeStatus(value: string) {
  return normalizeTaskStatus(value)
}

export function isTaskOverdue(row: Pick<TaskActionRow, 'status' | 'targetDate'>) {
  if (!row.targetDate) return false
  if (isTerminalTaskStatus(row.status)) return false

  const parsed = new Date(row.targetDate)
  if (Number.isNaN(parsed.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  parsed.setHours(0, 0, 0, 0)
  return parsed < today
}

export function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
  )
}

export function columnDisplayValue(row: TaskActionRow, column: TaskColumnKey) {
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

export function columnSortValue(row: TaskActionRow, column: TaskColumnKey) {
  if (column === 'rpn') return row.rpn ?? -1
  if (column === 'rpnAfter') return row.rpnAfter ?? -1
  if (column === 'targetDate') return row.targetDate ? new Date(row.targetDate).getTime() : Number.MAX_SAFE_INTEGER
  return columnDisplayValue(row, column)
}

export function calculateTaskSummary(rows: TaskActionRow[], openProjects: number): TaskSummary {
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
