import type { CSSProperties } from 'react'

import {
  asInt1to10,
  normalizeClassValue,
  normalizeText,
  PCP_PLACEHOLDER_PREFIX,
} from './pcp-utils'
import type { PcpEditSession, PcpOperation, PcpProjectView, PcpRow, PfmeaPcpSeedRow } from './pcp-service'

export type PcpColumnId =
  | 'id'
  | 'station'
  | 'operation'
  | 'process_step'
  | 'failure_mode'
  | 'characteristic'
  | 'class'
  | 'severity'
  | 'rpn'
  | 'current_prevention'
  | 'current_detection'
  | 'control_method'
  | 'sample_size'
  | 'frequency'
  | 'reaction_plan'

export type PcpSortState = {
  column: PcpColumnId
  direction: 'asc' | 'desc'
} | null

export type PcpFilterState = Record<PcpColumnId, string[] | null>

export const PCP_VISIBLE_COLUMNS_KEY_PREFIX = '__PCP_VISIBLE_COLUMNS__'
const EDIT_LOCK_HOURS = 48
export const EDIT_LOCK_MS = EDIT_LOCK_HOURS * 60 * 60 * 1000

export const SURFACE_RADIUS = 8
export const SURFACE_BG = 'rgba(255,255,255,0.08)'
export const SURFACE_BG_STRONG = 'rgba(255,255,255,0.12)'
export const SURFACE_BORDER = 'rgba(255,255,255,0.16)'
export const SURFACE_PANEL_BG = 'rgb(40, 39, 47)'
export const SURFACE_TEXT = '#f8fafc'
export const SURFACE_MUTED = 'rgba(255,255,255,0.72)'

export const PCP_CLASS_OPTIONS = ['', 'SC', 'CC']
export const CLASS_OPTION_DETAILS: Record<string, { title: string; description: string[] }> = {
  SC: {
    title: 'SC - Special Characteristic',
    description: [
      'A product characteristic or process parameter that requires special control because deviation may affect function, quality, compliance, performance, assembly, or downstream processing.',
      'This characteristic should be clearly identified and included in process controls, for example in the PCP.',
    ],
  },
  CC: {
    title: 'CC - Critical Characteristic',
    description: [
      'A critical characteristic, which is a specific subset of SC, where deviation may cause the most severe consequences.',
      'Examples include safety risk, non-compliance with legal requirements, or loss of a critical function.',
    ],
  },
}

export const PCP_COLUMNS: Array<{ id: PcpColumnId; label: string; width: number }> = [
  { id: 'id', label: 'ID#', width: 60 },
  { id: 'station', label: 'Station', width: 120 },
  { id: 'operation', label: 'Operation', width: 140 },
  { id: 'process_step', label: 'Process step', width: 180 },
  { id: 'failure_mode', label: 'Failure mode', width: 180 },
  { id: 'characteristic', label: 'Characteristic', width: 120 },
  { id: 'class', label: 'Class', width: 60 },
  { id: 'severity', label: 'Sev', width: 60 },
  { id: 'rpn', label: 'RPN', width: 60 },
  { id: 'current_prevention', label: 'Current controls (prev)', width: 180 },
  { id: 'current_detection', label: 'Current controls (det)', width: 180 },
  { id: 'control_method', label: 'Control method', width: 180 },
  { id: 'sample_size', label: 'Sample size', width: 100 },
  { id: 'frequency', label: 'Frequency', width: 100 },
  { id: 'reaction_plan', label: 'Reaction plan', width: 180 },
]

export const PCP_COLUMNS_BY_ID: Record<PcpColumnId, { id: PcpColumnId; label: string; width: number }> = PCP_COLUMNS.reduce(
  (acc, col) => {
    acc[col.id] = col
    return acc
  },
  {} as Record<PcpColumnId, { id: PcpColumnId; label: string; width: number }>
)

export const PCP_COLUMN_FILTER_GROUPS: Array<{ title: string; ids: PcpColumnId[] }> = [
  { title: 'Process Context', ids: ['id', 'station', 'operation', 'process_step'] },
  { title: 'PFMEA Link', ids: ['failure_mode', 'characteristic', 'class', 'severity', 'rpn', 'current_prevention', 'current_detection'] },
  { title: 'Control Definition', ids: ['control_method', 'sample_size', 'frequency', 'reaction_plan'] },
]

export const DEFAULT_VISIBLE_COLUMNS: Record<PcpColumnId, boolean> = {
  id: true,
  station: true,
  operation: true,
  process_step: true,
  failure_mode: true,
  characteristic: true,
  class: true,
  severity: true,
  rpn: true,
  current_prevention: true,
  current_detection: true,
  control_method: true,
  sample_size: true,
  frequency: true,
  reaction_plan: true,
}

export const DEFAULT_PCP_FILTERS: PcpFilterState = PCP_COLUMNS.reduce((acc, column) => {
  acc[column.id] = null
  return acc
}, {} as PcpFilterState)

export function formatDateTimePL(iso: string | null | undefined) {
  if (!iso) return '-'
  const dateValue = new Date(iso)
  if (Number.isNaN(dateValue.getTime())) return '-'
  const date = dateValue.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const time = dateValue.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${date} ${time}`
}

export function isPcpSessionExpired(editSession: PcpEditSession | null, now: number, timeoutMs = EDIT_LOCK_MS) {
  if (!editSession) return false
  const last = new Date(editSession.lastActivityAt).getTime()
  if (!Number.isFinite(last)) return true
  return now - last >= timeoutMs
}

export function formatPcpLockRemainingText(editSession: PcpEditSession | null, now: number, timeoutMs = EDIT_LOCK_MS) {
  if (!editSession) return ''
  const last = new Date(editSession.lastActivityAt).getTime()
  if (!Number.isFinite(last)) return ''
  const left = Math.max(0, timeoutMs - (now - last))
  const h = Math.floor(left / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  return `${h}h ${m}m`
}

export function getPcpEditState(params: {
  projectStatus?: PcpProjectView['status'] | null
  userId: string | null
  editSession: PcpEditSession | null
  now: number
}) {
  const isObsolete = (params.projectStatus ?? 'DRAFT') === 'OBSOLETE'
  const sessionExpired = isPcpSessionExpired(params.editSession, params.now)
  const isEditOwner = !!params.userId && !!params.editSession && params.editSession.lockedBy === params.userId && !sessionExpired
  const isLockedByOther = !!params.editSession && !isEditOwner && !sessionExpired

  return {
    isObsolete,
    sessionExpired,
    isEditOwner,
    isLockedByOther,
    readOnly: isObsolete || !isEditOwner,
  }
}

export function getPcpWorkingRevision(project: PcpProjectView | null, draftRevisionIdOverride: string | null) {
  return {
    workingRevisionId: draftRevisionIdOverride ?? project?.current_draft_revision_id ?? project?.current_open_revision_id ?? null,
    workingRevisionLabel: project?.current_draft_revision_id ? project?.draft_revision_label : project?.open_revision_label,
  }
}

export function sortPcpRows(rows: PcpRow[]) {
  const indexed = rows.map((row, index) => ({ row, index }))
  indexed.sort((a, b) => {
    const ao = a.row.operations?.operation_number ?? 0
    const bo = b.row.operations?.operation_number ?? 0
    if (ao !== bo) return ao - bo
    const as = a.row.__sortIndex ?? a.index
    const bs = b.row.__sortIndex ?? b.index
    return as - bs
  })
  return indexed.map((item) => item.row)
}

export function formatPcpCellNumber(value: number | string | null | undefined) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? String(Math.round(numeric)) : '-'
}

export function pcpColumnDisplayValue(row: PcpRow, column: PcpColumnId) {
  if (column === 'id') return formatPcpCellNumber(row.operations?.operation_number)
  if (column === 'station') return normalizeText(row.operations?.machine) || '-'
  if (column === 'operation') return normalizeText(row.operations?.operation) || '-'
  if (column === 'process_step') return normalizeText(row.operations?.name) || '-'
  if (column === 'failure_mode') return normalizeText(row.failure_mode) || '-'
  if (column === 'characteristic') return normalizeText(row.characteristic) || '-'
  if (column === 'class') return normalizeClassValue(row.class) ?? '-'
  if (column === 'severity') return formatPcpCellNumber(row.severity)
  if (column === 'rpn') return formatPcpCellNumber(row.rpn)
  if (column === 'current_prevention') return normalizeText(row.current_prevention) || '-'
  if (column === 'current_detection') return normalizeText(row.current_detection) || '-'
  if (column === 'control_method') return normalizeText(row.control_method) || '-'
  if (column === 'sample_size') return normalizeText(row.sample_size) || '-'
  if (column === 'frequency') return normalizeText(row.frequency) || '-'
  return normalizeText(row.reaction_plan) || '-'
}

export function pcpColumnSortValue(row: PcpRow, column: PcpColumnId) {
  if (column === 'id') return Number(row.operations?.operation_number ?? Number.MAX_SAFE_INTEGER)
  if (column === 'severity') return asInt1to10(row.severity) ?? -1
  if (column === 'rpn') {
    const numeric = Number(row.rpn)
    return Number.isFinite(numeric) ? numeric : -1
  }
  return pcpColumnDisplayValue(row, column)
}

export function uniqueSortedPcpValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
  )
}

export function anchoredPopupStyle(anchorEl: HTMLElement, width: number, gap = 8, minViewportPadding = 24): CSSProperties {
  const rect = anchorEl.getBoundingClientRect()
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : rect.right + width
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : rect.bottom + 240
  const maxLeft = Math.max(minViewportPadding, viewportWidth - width - minViewportPadding)
  const left = Math.max(minViewportPadding, Math.min(rect.left, maxLeft))
  const estimatedHeight = 220
  const top = rect.bottom + gap + estimatedHeight <= viewportHeight - minViewportPadding
    ? rect.bottom + gap
    : Math.max(minViewportPadding, rect.top - gap - estimatedHeight)

  return {
    left,
    top,
    width,
    maxWidth: `calc(100vw - ${minViewportPadding * 2}px)`,
    maxHeight: `calc(100vh - ${minViewportPadding * 2}px)`,
  }
}

export function makePcpPlaceholderRow(
  operation: PcpOperation,
  revisionId: string | null,
  seedKey: string,
  seed?: Partial<PfmeaPcpSeedRow> | null,
  sortIndex = 0
): PcpRow {
  return {
    id: `${PCP_PLACEHOLDER_PREFIX}${seedKey}`,
    revision_id: revisionId,
    operation_id: operation.id,
    pfmea_row_id: seed?.id ?? null,
    failure_mode: normalizeText(seed?.failure_mode) || null,
    characteristic: normalizeText(seed?.characteristic),
    class: normalizeClassValue((seed?.class as string | null | undefined) ?? null),
    severity: asInt1to10(seed?.severity),
    rpn: typeof seed?.rpn === 'number' && Number.isFinite(seed.rpn) ? seed.rpn : null,
    current_prevention: normalizeText(seed?.current_prevention) || null,
    current_detection: normalizeText(seed?.current_detection) || null,
    control_method: null,
    sample_size: null,
    frequency: null,
    reaction_plan: null,
    source: 'MANUAL',
    status: 'OPEN',
    created_at: '',
    updated_at: '',
    operations: operation,
    __placeholder: true,
    __sortIndex: sortIndex,
  }
}
