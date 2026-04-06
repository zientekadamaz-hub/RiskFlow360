'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabaseBrowser'
import { colorToBg as RISK_MATRIX_COLOR_HEX, type RiskColor as RiskMatrixColor } from '../settings/risk-matrix/_lib/matrixColors'

/* ===================== TYPES ===================== */

type ProjectView = {
  id: string
  name: string
  standard?: string | null
  status: 'DRAFT' | 'OPEN' | 'OBSOLETE'
  current_open_revision_id: string | null
  current_draft_revision_id: string | null
  open_revision_label: string | null
  draft_revision_label: string | null
}

type Operation = {
  id: string
  project_id: string
  operation_number: number | null
  name: string
  machine: string | null
  operation: string | null
  active?: boolean
}

type PfmeaRow = {
  id: string
  revision_id?: string | null
  operation_id: string
  row_no?: string | null
  failure_mode_group_id?: string | null
  failure_block_group_id?: string | null
  action_plan_group_id?: string | null

  failure_mode: string
  effect: string
  severity: number | string | null
  characteristic: string
  class: string | null
  cause: string
  occurrence: number | string | null
  current_prevention: string
  current_detection: string
  detection: number | string | null

  rpn: number | null
  oxd: number | null

  recommended_action: string
  responsible: string
  target_date: string | null
  action_status: string | null

  occurrence2: number | string | null
  detection2: number | string | null

  rpn2: number | null
  oxd2: number | null

  rpn_current: number | null
  oxd_current: number | null

  created_at: string
  __sortIndex?: number

  operations?: {
    id: string
    operation_number: number | null
    name: string
    machine: string | null
    operation: string | null
    project_id: string
    active?: boolean
  } | null
}

type NewRowDraft = { operation_id: string }
type PfmeaEditorElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement
type PfmeaEditorRef = React.MutableRefObject<PfmeaEditorElement | null>
type PfmeaGroupIds = {
  failure_mode_group_id: string
  failure_block_group_id: string
  action_plan_group_id: string
}
type PfmeaRowHierarchy = {
  rowLabel: string
  failureModeKey: string
  failureBlockKey: string
  causeBlockKey: string
  actionKey: string
}

type Mode = 'manual' | 'rpn'
type RiskColor = RiskMatrixColor

type DbCell = {
  project_id: string
  severity: number
  do_value: number
  color: RiskColor
}

type DbConfig = {
  id: number
  mode: Mode
  rpn_green_max: number
  rpn_yellow_max: number
  rpn_orange_max: number
}

type RpnThresholds = { greenMax: number; yellowMax: number; orangeMax: number }
type SeverityEffectiveRow = {
  level: number
  name?: string | null
  description?: string | null
  active: boolean
}
type SeverityOption = {
  level: number
  label: string
  examples: string[]
}
type SelectOption = {
  value: string
  label: string
}
type PfmeaHistoryEntry = {
  id: string
  at: string
  revisionLabel: string
  author: string
  riskCount: number | null
  avgRpn: number | null
  description: string
}
type PfmeaEditSession = {
  projectId: string
  lockedBy: string
  startedAt: string
  lastActivityAt: string
}

type PfdDiagramRow = {
  nodes?: Array<{ id?: string | null; data?: { kind?: string | null } | null }> | null
}
type ExcelScalar = string | number | null | undefined
type PfmeaColumnId =
  | 'id'
  | 'station'
  | 'operation'
  | 'process_step'
  | 'row_no'
  | 'failure_mode'
  | 'effect'
  | 'sev'
  | 'characteristic'
  | 'class'
  | 'cause'
  | 'occ'
  | 'current_prev'
  | 'current_det'
  | 'det'
  | 'rpn'
  | 'recommended_action'
  | 'responsible'
  | 'target_date'
  | 'action_status'
  | 'o2'
  | 'd2'
  | 'rpn2'
  | 'delete'

const PLACEHOLDER_ROW_PREFIX = '__pfmea_placeholder__:'
const PFMEA_VISIBLE_COLUMNS_KEY_PREFIX = '__PFMEA_VISIBLE_COLUMNS__'
const PFMEA_DIRTY_DRAFT_KEY_PREFIX = '__PFMEA_DIRTY_DRAFT__'
const EDIT_LOCK_HOURS = 48
const EDIT_LOCK_MS = EDIT_LOCK_HOURS * 60 * 60 * 1000
const SURFACE_RADIUS = 8
const SURFACE_BG = 'rgba(255,255,255,0.08)'
const SURFACE_BG_STRONG = 'rgba(255,255,255,0.12)'
const SURFACE_BORDER = 'rgba(255,255,255,0.16)'
const SURFACE_BORDER_STRONG = 'rgba(255,255,255,0.22)'
const SURFACE_PANEL_BG = 'rgb(40, 39, 47)'
const SURFACE_TEXT = '#f8fafc'
const SURFACE_MUTED = 'rgba(255,255,255,0.72)'

const CLASS_OPTIONS: SelectOption[] = [
  { value: 'SC', label: 'SC - Special Characteristic' },
  { value: 'CC', label: 'CC - Critical Characteristic' },
]

const CLASS_OPTION_DETAILS: Record<string, { title: string; description: string[] }> = {
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

const PFMEA_COLUMNS: Array<{ id: PfmeaColumnId; label: string; width: number }> = [
  { id: 'id', label: 'ID#', width: 50 },
  { id: 'station', label: 'STATION', width: 150 },
  { id: 'operation', label: 'OPERATION', width: 150 },
  { id: 'process_step', label: 'PROCESS STEP', width: 150 },
  { id: 'row_no', label: 'ROW#', width: 110 },
  { id: 'failure_mode', label: 'FAILURE MODE', width: 180 },
  { id: 'characteristic', label: 'CHARACTERISTIC', width: 180 },
  { id: 'class', label: 'CLASS', width: 70 },
  { id: 'effect', label: 'EFFECT', width: 180 },
  { id: 'sev', label: 'SEV', width: 50 },
  { id: 'cause', label: 'CAUSE', width: 180 },
  { id: 'occ', label: 'OCC', width: 50 },
  { id: 'current_prev', label: 'CURRENT CONTROLS (PREV)', width: 180 },
  { id: 'current_det', label: 'CURRENT CONTROLS (DET)', width: 180 },
  { id: 'det', label: 'DET', width: 50 },
  { id: 'rpn', label: 'RPN', width: 60 },
  { id: 'recommended_action', label: 'RECOMMENDED ACTION', width: 180 },
  { id: 'responsible', label: 'RESPONSIBLE', width: 120 },
  { id: 'target_date', label: 'TARGET DATE', width: 120 },
  { id: 'action_status', label: 'ACTION STATUS', width: 120 },
  { id: 'o2', label: 'OCC (AFTER)', width: 60 },
  { id: 'd2', label: 'DET (AFTER)', width: 60 },
  { id: 'rpn2', label: 'RPN (AFTER)', width: 60 },
  { id: 'delete', label: 'DELETE', width: 50 },
]

const PFMEA_COLUMNS_BY_ID: Record<PfmeaColumnId, { id: PfmeaColumnId; label: string; width: number }> = PFMEA_COLUMNS.reduce(
  (acc, col) => {
    acc[col.id] = col
    return acc
  },
  {} as Record<PfmeaColumnId, { id: PfmeaColumnId; label: string; width: number }>
)

const PFMEA_COLUMN_FILTER_GROUPS: Array<{ title: string; ids: PfmeaColumnId[] }> = [
  {
    title: 'Process Context',
    ids: ['id', 'station', 'operation', 'process_step', 'row_no'],
  },
  {
    title: 'Current Risk Analysis',
    ids: ['failure_mode', 'characteristic', 'class', 'effect', 'sev', 'cause', 'occ', 'current_prev', 'current_det', 'det', 'rpn'],
  },
  {
    title: 'Action Plan & Residual Risk',
    ids: ['recommended_action', 'responsible', 'target_date', 'action_status', 'o2', 'd2', 'rpn2'],
  },
]

const DEFAULT_VISIBLE_COLUMNS: Record<PfmeaColumnId, boolean> = {
  id: true,
  station: true,
  operation: true,
  process_step: true,
  row_no: true,
  failure_mode: true,
  effect: true,
  sev: true,
  characteristic: true,
  class: true,
  cause: true,
  occ: true,
  current_prev: true,
  current_det: true,
  det: true,
  rpn: true,
  recommended_action: true,
  responsible: true,
  target_date: true,
  action_status: true,
  o2: true,
  d2: true,
  rpn2: true,
  delete: true,
}

const PFMEA_EDITABLE_COLUMN_VISIBILITY: Record<
  | 'failure_mode'
  | 'effect'
  | 'severity'
  | 'characteristic'
  | 'class'
  | 'cause'
  | 'occurrence'
  | 'current_prevention'
  | 'current_detection'
  | 'detection'
  | 'recommended_action'
  | 'responsible'
  | 'target_date'
  | 'action_status'
  | 'occurrence2'
  | 'detection2',
  PfmeaColumnId
> = {
  failure_mode: 'failure_mode',
  effect: 'effect',
  severity: 'sev',
  characteristic: 'characteristic',
  class: 'class',
  cause: 'cause',
  occurrence: 'occ',
  current_prevention: 'current_prev',
  current_detection: 'current_det',
  detection: 'det',
  recommended_action: 'recommended_action',
  responsible: 'responsible',
  target_date: 'target_date',
  action_status: 'action_status',
  occurrence2: 'o2',
  detection2: 'd2',
}

const PFMEA_EDITABLE_FIELDS: Array<
  | 'failure_mode'
  | 'effect'
  | 'severity'
  | 'characteristic'
  | 'class'
  | 'cause'
  | 'occurrence'
  | 'current_prevention'
  | 'current_detection'
  | 'detection'
  | 'recommended_action'
  | 'responsible'
  | 'target_date'
  | 'action_status'
  | 'occurrence2'
  | 'detection2'
> = [
  'failure_mode',
  'effect',
  'severity',
  'characteristic',
  'class',
  'cause',
  'occurrence',
  'current_prevention',
  'current_detection',
  'detection',
  'recommended_action',
  'responsible',
  'target_date',
  'action_status',
  'occurrence2',
  'detection2',
]

/* ===================== RISK MATRIX (SUPABASE) ===================== */

const GLOBAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000'

const COLOR_HEX: Record<RiskColor, string> = RISK_MATRIX_COLOR_HEX

function rgba(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function cellKey(sev: number, doVal: number) {
  return `${sev}|${doVal}`
}

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, Math.trunc(v)))
}

function colorFill(c: RiskColor) {
  if (c === 'red') return 'rgba(239,68,68,0.12)'
  if (c === 'orange') return 'rgba(251,146,60,0.18)'
  if (c === 'yellow') return 'rgba(250,204,21,0.22)'
  return 'rgba(34,197,94,0.18)'
}

function colorText(c: RiskColor) {
  if (c === 'red') return 'rgb(239,68,68)'
  if (c === 'orange') return 'rgb(251,146,60)'
  if (c === 'yellow') return 'rgb(250,204,21)'
  return 'rgb(34,197,94)'
}

function colorFromRpn(sev: number, doVal: number, t: RpnThresholds): RiskColor {
  const rpn = sev * doVal
  if (rpn <= t.greenMax) return 'green'
  if (rpn <= t.yellowMax) return 'yellow'
  if (rpn <= t.orangeMax) return 'orange'
  return 'red'
}

function asInt1to10(v: any): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  if (!Number.isFinite(n)) return null
  const i = Math.trunc(n)
  if (i < 1 || i > 10) return null
  return i
}

function calcRpn(sevRaw: any, occRaw: any, detRaw: any) {
  const sev = asInt1to10(sevRaw)
  const occ = asInt1to10(occRaw)
  const det = asInt1to10(detRaw)
  const doVal = occ != null && det != null ? occ * det : null // 1..100
  const rpn = sev != null && doVal != null ? sev * doVal : null // 1..1000
  return { sev, occ, det, doVal, rpn }
}

function computeDerived(
  row: PfmeaRow
): Pick<PfmeaRow, 'rpn' | 'oxd' | 'rpn2' | 'oxd2' | 'rpn_current' | 'oxd_current'> {
  const a1 = calcRpn(row.severity, row.occurrence, row.detection)
  const a2 = calcRpn(row.severity, row.occurrence2, row.detection2)

  const oxd = a1.doVal
  const rpn = a1.rpn

  const oxd2 = a2.doVal
  const rpn2 = a2.rpn

  const isClosed = (row.action_status ?? '').toUpperCase() === 'CLOSED'
  const rpn_current = isClosed ? rpn2 : rpn
  const oxd_current = isClosed ? oxd2 : oxd

  return {
    rpn: rpn ?? null,
    oxd: oxd ?? null,
    rpn2: rpn2 ?? null,
    oxd2: oxd2 ?? null,
    rpn_current: rpn_current ?? null,
    oxd_current: oxd_current ?? null,
  }
}

function pfmeaRevisionNumberFromLabel(label: string | null | undefined) {
  const raw = (label ?? '').toString().trim()
  if (!raw) return '-'
  const parts = raw.split('.').map((v) => v.trim())
  return parts[1] || parts[0] || '-'
}

function nextPfmeaRevisionLabel(label: string | null | undefined) {
  const raw = (label ?? '').toString().trim()
  const parts = raw ? raw.split('.') : ['0', '0', '0']
  const pfd = Number.parseInt((parts[0] ?? '0').trim(), 10)
  const pfmea = Number.parseInt((parts[1] ?? '0').trim(), 10)
  const pcp = Number.parseInt((parts[2] ?? '0').trim(), 10)
  const a = Number.isFinite(pfd) ? pfd : 0
  const b = Number.isFinite(pfmea) ? pfmea : 0
  const c = Number.isFinite(pcp) ? pcp : 0
  return `${a}.${b + 1}.${c}`
}

function isPlaceholderRowId(id: string) {
  return typeof id === 'string' && id.startsWith(PLACEHOLDER_ROW_PREFIX)
}

function patchHasAnyValue(patch: Partial<PfmeaRow>) {
  for (const value of Object.values(patch)) {
    if (value == null) continue
    if (typeof value === 'string') {
      if (value.trim() !== '') return true
      continue
    }
    return true
  }
  return false
}

function isCauseContinuationEmpty(row: PfmeaRow) {
  return !patchHasAnyValue({
    cause: row.cause,
    occurrence: row.occurrence,
    current_prevention: row.current_prevention,
    current_detection: row.current_detection,
    detection: row.detection,
    recommended_action: row.recommended_action,
    responsible: row.responsible,
    target_date: row.target_date,
    action_status: row.action_status,
    occurrence2: row.occurrence2,
    detection2: row.detection2,
  })
}

function isRecommendedActionContinuationEmpty(row: PfmeaRow) {
  return !patchHasAnyValue({
    recommended_action: row.recommended_action,
    responsible: row.responsible,
    target_date: row.target_date,
    action_status: row.action_status,
    occurrence2: row.occurrence2,
    detection2: row.detection2,
  })
}

function isFailureModeContinuationEmpty(row: PfmeaRow) {
  return !patchHasAnyValue({
    failure_mode: row.failure_mode,
    effect: row.effect,
    severity: row.severity,
    characteristic: row.characteristic,
    class: row.class,
    cause: row.cause,
    occurrence: row.occurrence,
    current_prevention: row.current_prevention,
    current_detection: row.current_detection,
    detection: row.detection,
    recommended_action: row.recommended_action,
    responsible: row.responsible,
    target_date: row.target_date,
    action_status: row.action_status,
    occurrence2: row.occurrence2,
    detection2: row.detection2,
  })
}

function isEffectContinuationEmpty(row: PfmeaRow) {
  return !patchHasAnyValue({
    effect: row.effect,
    severity: row.severity,
    cause: row.cause,
    occurrence: row.occurrence,
    current_prevention: row.current_prevention,
    current_detection: row.current_detection,
    detection: row.detection,
    recommended_action: row.recommended_action,
    responsible: row.responsible,
    target_date: row.target_date,
    action_status: row.action_status,
    occurrence2: row.occurrence2,
    detection2: row.detection2,
  })
}

function normalizePfmeaGroupId(value: string | null | undefined) {
  const normalized = (value ?? '').trim()
  return normalized || null
}

function normalizePfmeaRowNo(value: string | null | undefined) {
  const normalized = (value ?? '').trim()
  return normalized || null
}

function parsePfmeaRowNo(value: string | null | undefined): PfmeaRowHierarchy | null {
  const rowLabel = normalizePfmeaRowNo(value)
  if (!rowLabel) return null

  const parts = rowLabel.split('.').map((part) => part.trim())
  if (parts.length !== 5 || parts.some((part) => part.length === 0)) return null

  return {
    rowLabel,
    failureModeKey: parts.slice(0, 2).join('.'),
    failureBlockKey: parts.slice(0, 3).join('.'),
    causeBlockKey: parts.slice(0, 4).join('.'),
    actionKey: parts.slice(0, 5).join('.'),
  }
}

function parsePfmeaRowNoParts(value: string | null | undefined) {
  const rowLabel = normalizePfmeaRowNo(value)
  if (!rowLabel) return null

  const parts = rowLabel.split('.').map((part) => Number.parseInt(part.trim(), 10))
  if (parts.length !== 5 || parts.some((part) => !Number.isFinite(part))) return null
  return parts
}

function samePfmeaGroupValue(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizePfmeaGroupId(a)
  const right = normalizePfmeaGroupId(b)
  return !!left && !!right && left === right
}

function createPfmeaGroupId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const rand = Math.floor(Math.random() * 16)
    const value = ch === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

function createDeterministicPfmeaGroupId(seed: string) {
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  let h3 = 0x85ebca6b
  let h4 = 0xc2b2ae35

  for (let index = 0; index < seed.length; index += 1) {
    const code = seed.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 16777619)
    h2 = Math.imul((h2 + code) ^ (h2 >>> 13), 2246822519)
    h3 = Math.imul((h3 ^ code) + 0x27d4eb2d, 3266489917)
    h4 = Math.imul((h4 + (code << (index % 5))) ^ (h4 >>> 15), 668265263)
  }

  const chars = [h1, h2, h3, h4]
    .map((value) => (value >>> 0).toString(16).padStart(8, '0'))
    .join('')
    .slice(0, 32)
    .split('')

  chars[12] = '5'
  chars[16] = (((Number.parseInt(chars[16] ?? '0', 16) & 0x3) | 0x8) >>> 0).toString(16)

  const hex = chars.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function createPfmeaGroupIds(overrides: Partial<PfmeaGroupIds> = {}): PfmeaGroupIds {
  return {
    failure_mode_group_id: normalizePfmeaGroupId(overrides.failure_mode_group_id) ?? createPfmeaGroupId(),
    failure_block_group_id: normalizePfmeaGroupId(overrides.failure_block_group_id) ?? createPfmeaGroupId(),
    action_plan_group_id: normalizePfmeaGroupId(overrides.action_plan_group_id) ?? createPfmeaGroupId(),
  }
}

function derivePfmeaGroupIds(row: Partial<PfmeaRow>, hierarchy?: PfmeaRowHierarchy | null): PfmeaGroupIds {
  const rowHierarchy = hierarchy ?? parsePfmeaRowNo(row.row_no)
  const rowSeed = row.id || `${row.operation_id || row.operations?.id || 'op'}:${normalizePfmeaRowNo(row.row_no) || 'row'}`

  return {
    failure_mode_group_id:
      normalizePfmeaGroupId(row.failure_mode_group_id) ??
      createDeterministicPfmeaGroupId(`pfmea:fm:${rowHierarchy?.failureModeKey || rowSeed}`),
    failure_block_group_id:
      normalizePfmeaGroupId(row.failure_block_group_id) ??
      createDeterministicPfmeaGroupId(`pfmea:fb:${rowHierarchy?.failureBlockKey || rowSeed}`),
    action_plan_group_id:
      normalizePfmeaGroupId(row.action_plan_group_id) ??
      createDeterministicPfmeaGroupId(`pfmea:cb:${rowHierarchy?.causeBlockKey || rowSeed}`),
  }
}

function pickPfmeaGroupIds(row: Partial<PfmeaRow> | null | undefined): Partial<PfmeaGroupIds> {
  return {
    failure_mode_group_id: normalizePfmeaGroupId(row?.failure_mode_group_id) ?? undefined,
    failure_block_group_id: normalizePfmeaGroupId(row?.failure_block_group_id) ?? undefined,
    action_plan_group_id: normalizePfmeaGroupId(row?.action_plan_group_id) ?? undefined,
  }
}

function hydratePfmeaGroupIds(rows: PfmeaRow[]) {
  const hydrated: PfmeaRow[] = []

  for (const row of rows) {
    hydrated.push({
      ...row,
      ...derivePfmeaGroupIds(row),
    })
  }

  return hydrated
}

function buildPfmeaHierarchy(rows: PfmeaRow[]): PfmeaRowHierarchy[] {
  const persistedHierarchy = rows.map((row) => parsePfmeaRowNo(row.row_no))
  const canUsePersistedHierarchy =
    rows.length > 0 &&
    rows.every((row, index) => isPlaceholderRowId(row.id) || !!persistedHierarchy[index])

  if (canUsePersistedHierarchy) {
    return rows.map((row, index) => {
      const item = persistedHierarchy[index]
      if (item) return item

      const opNumberLabel =
        row.operations?.operation_number != null && Number.isFinite(row.operations.operation_number)
          ? String(row.operations.operation_number)
          : '-'

      return {
        rowLabel: `${opNumberLabel}.1.1.1.1`,
        failureModeKey: `${opNumberLabel}.1`,
        failureBlockKey: `${opNumberLabel}.1.1`,
        causeBlockKey: `${opNumberLabel}.1.1.1`,
        actionKey: `${opNumberLabel}.1.1.1.1`,
      }
    })
  }

  const failureModeIndexByKey = new Map<string, number>()
  const failureModeCountByOperation = new Map<string, number>()
  const failureBlockIndexByKey = new Map<string, number>()
  const failureBlockCountByFailureMode = new Map<string, number>()
  const causeBlockIndexByKey = new Map<string, number>()
  const causeBlockCountByFailureBlock = new Map<string, number>()
  const actionCountByCauseBlock = new Map<string, number>()

  return rows.map((row) => {
    const opId = row.operation_id || row.operations?.id || `op:${row.id}`
    const opNumberLabel =
      row.operations?.operation_number != null && Number.isFinite(row.operations.operation_number)
        ? String(row.operations.operation_number)
        : '-'

    const failureModeGroupId = normalizePfmeaGroupId(row.failure_mode_group_id) ?? `fm:${row.id}`
    const failureModeScopeKey = `${opId}`
    const failureModeKey = `${failureModeScopeKey}::${failureModeGroupId}`
    let failureModeIndex = failureModeIndexByKey.get(failureModeKey)
    if (!failureModeIndex) {
      failureModeIndex = (failureModeCountByOperation.get(failureModeScopeKey) ?? 0) + 1
      failureModeCountByOperation.set(failureModeScopeKey, failureModeIndex)
      failureModeIndexByKey.set(failureModeKey, failureModeIndex)
    }

    const failureBlockGroupId = normalizePfmeaGroupId(row.failure_block_group_id) ?? `fb:${row.id}`
    const failureBlockScopeKey = `${failureModeKey}`
    const failureBlockKey = `${failureBlockScopeKey}::${failureBlockGroupId}`
    let failureBlockIndex = failureBlockIndexByKey.get(failureBlockKey)
    if (!failureBlockIndex) {
      failureBlockIndex = (failureBlockCountByFailureMode.get(failureBlockScopeKey) ?? 0) + 1
      failureBlockCountByFailureMode.set(failureBlockScopeKey, failureBlockIndex)
      failureBlockIndexByKey.set(failureBlockKey, failureBlockIndex)
    }

    const causeBlockGroupId = normalizePfmeaGroupId(row.action_plan_group_id) ?? `cause:${row.id}`
    const causeBlockScopeKey = `${failureBlockKey}`
    const causeBlockKey = `${causeBlockScopeKey}::${causeBlockGroupId}`
    let causeBlockIndex = causeBlockIndexByKey.get(causeBlockKey)
    if (!causeBlockIndex) {
      causeBlockIndex = (causeBlockCountByFailureBlock.get(causeBlockScopeKey) ?? 0) + 1
      causeBlockCountByFailureBlock.set(causeBlockScopeKey, causeBlockIndex)
      causeBlockIndexByKey.set(causeBlockKey, causeBlockIndex)
    }

    const actionIndex = (actionCountByCauseBlock.get(causeBlockKey) ?? 0) + 1
    actionCountByCauseBlock.set(causeBlockKey, actionIndex)

    return {
      rowLabel: `${opNumberLabel}.${failureModeIndex}.${failureBlockIndex}.${causeBlockIndex}.${actionIndex}`,
      failureModeKey: `${opId}.${failureModeIndex}`,
      failureBlockKey: `${opId}.${failureModeIndex}.${failureBlockIndex}`,
      causeBlockKey: `${opId}.${failureModeIndex}.${failureBlockIndex}.${causeBlockIndex}`,
      actionKey: `${opId}.${failureModeIndex}.${failureBlockIndex}.${causeBlockIndex}.${actionIndex}`,
    }
  })
}

function buildPfmeaBlockMergeInfoByHierarchy(
  rows: PfmeaRow[],
  hierarchy: PfmeaRowHierarchy[],
  keySelector: (item: PfmeaRowHierarchy) => string
) {
  const spans = rows.map((_, index) => ({ span: 1, end: index }))
  let i = 0

  while (i < rows.length) {
    const currentItem = hierarchy[i]
    const currentKey = currentItem ? keySelector(currentItem) : ''
    let j = i + 1

    while (j < rows.length) {
      const nextItem = hierarchy[j]
      const nextKey = nextItem ? keySelector(nextItem) : ''
      if (!currentKey || !nextKey || currentKey !== nextKey) break
      j += 1
    }

    if (j - i > 1) {
      for (let k = i; k < j; k += 1) {
        spans[k] = { span: k === i ? j - i : 0, end: j - 1 }
      }
    }

    i = j
  }

  return spans
}

function shortSeverityLabel(nameRaw: string | null | undefined, descriptionRaw: string | null | undefined) {
  const source = (nameRaw ?? descriptionRaw ?? '').toString().replace(/\r/g, '')
  const firstLine = source
    .split('\n')
    .map((x) => x.trim())
    .find(Boolean) ?? ''
  const cut = firstLine.split(/[-\u2013\u2014]/)[0]?.trim() ?? ''
  return cut || firstLine || 'No description'
}

function parseExamples(descriptionRaw: string | null | undefined) {
  return (descriptionRaw ?? '')
    .toString()
    .replace(/\r/g, '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
}

function normalizeHistoryText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function pickHistoryAuthor(row: Record<string, unknown>): string {
  return (
    normalizeHistoryText(row.author_name) ||
    normalizeHistoryText(row.updated_by_name) ||
    normalizeHistoryText(row.created_by_name) ||
    normalizeHistoryText(row.user_name) ||
    normalizeHistoryText(row.updated_by) ||
    normalizeHistoryText(row.created_by) ||
    normalizeHistoryText(row.user_id) ||
    'Unknown user'
  )
}

function normalizeClassValue(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const source = String(raw).trim()
  if (!source) return null
  const upper = source.toUpperCase()
  const token = upper.split(/[\s-]/)[0] ?? ''

  if (token === 'SC' || upper.includes('SPECIAL CHARACTERISTIC')) return 'SC'
  if (token === 'CC' || upper.includes('CRITICAL CHARACTERISTIC')) return 'CC'

  return null
}

function opGroupKeyFromOperation(op: Pick<Operation, 'id' | 'operation_number'>): string {
  if (typeof op.operation_number === 'number' && Number.isFinite(op.operation_number)) {
    return `no:${op.operation_number}`
  }
  return `id:${op.id}`
}

function opGroupKeyFromRow(r: PfmeaRow): string {
  const opNo = r.operations?.operation_number
  if (typeof opNo === 'number' && Number.isFinite(opNo)) {
    return `no:${opNo}`
  }
  return `id:${r.operation_id || r.operations?.id || ''}`
}

function opQualityScore(op: Operation, rowHits: number): number {
  const hasName = (op.name ?? '').trim() !== '' ? 1 : 0
  const hasStation = (op.machine ?? '').trim() !== '' ? 1 : 0
  const hasOperation = (op.operation ?? '').trim() !== '' ? 1 : 0
  const hasRows = rowHits > 0 ? 1 : 0
  return hasRows * 1000 + hasName * 100 + hasStation * 10 + hasOperation * 5 + Math.min(rowHits, 99)
}

function excelXmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function sanitizeFileNamePart(value: string): string {
  const clean = value.replace(/[\\/:*?"<>|]+/g, '_').trim()
  return clean || 'PFMEA'
}

function buildExcelReportXml(params: {
  sheetName: string
  title: string
  generatedAtIso: string
  summaryRows: Array<[string, ExcelScalar]>
  headers: string[]
  dataRows: ExcelScalar[][]
}): string {
  const toCell = (raw: ExcelScalar, styleId: string) => {
    const v = raw ?? ''
    const isNum = typeof v === 'number' && Number.isFinite(v)
    const type = isNum ? 'Number' : 'String'
    const text = isNum ? String(v) : excelXmlEscape(String(v))
    return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${text}</Data></Cell>`
  }

  const maxCols = Math.max(
    2,
    params.headers.length,
    ...params.dataRows.map((r) => r.length)
  )

  const titleRow = `<Row><Cell ss:StyleID="title" ss:MergeAcross="${Math.max(0, maxCols - 1)}"><Data ss:Type="String">${excelXmlEscape(params.title)}</Data></Cell></Row>`
  const generatedRow = `<Row><Cell ss:StyleID="metaLabel"><Data ss:Type="String">Generated at</Data></Cell><Cell ss:StyleID="metaValue"><Data ss:Type="String">${excelXmlEscape(params.generatedAtIso)}</Data></Cell></Row>`
  const blankRow = '<Row/>'

  const summaryXml = params.summaryRows
    .map(
      ([k, v]) =>
        `<Row>${toCell(k, 'metaLabel')}${toCell(v, 'metaValue')}</Row>`
    )
    .join('')

  const headerXml = `<Row>${params.headers.map((h) => toCell(h, 'header')).join('')}</Row>`
  const rowsXml = params.dataRows
    .map((row) => `<Row>${row.map((c) => toCell(c, 'cell')).join('')}</Row>`)
    .join('')

  const sheetName = excelXmlEscape(params.sheetName.slice(0, 31))

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
    <Style ss:ID="title">
      <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1"/>
    </Style>
    <Style ss:ID="header">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
      <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="metaLabel">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
    </Style>
    <Style ss:ID="metaValue">
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
    <Style ss:ID="cell">
      <Font ss:FontName="Calibri" ss:Size="11"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
  </Styles>
  <Worksheet ss:Name="${sheetName}">
    <Table>
      ${titleRow}
      ${generatedRow}
      ${blankRow}
      ${summaryXml}
      ${blankRow}
      ${headerXml}
      ${rowsXml}
    </Table>
  </Worksheet>
</Workbook>`
}

function makeEmptyPfmeaPayload(
  operationId: string,
  revisionId: string,
  groups?: Partial<PfmeaGroupIds>
): Partial<PfmeaRow> & { operation_id: string; revision_id: string } {
  const groupIds = createPfmeaGroupIds(groups)
  return {
    revision_id: revisionId,
    operation_id: operationId,
    row_no: null,
    ...groupIds,
    failure_mode: '',
    effect: '',
    severity: null,
    characteristic: '',
    class: null,
    cause: '',
    occurrence: null,
    current_prevention: '',
    current_detection: '',
    detection: null,
    rpn: null,
    oxd: null,
    recommended_action: '',
    responsible: '',
    target_date: null,
    action_status: null,
    occurrence2: null,
    detection2: null,
    rpn2: null,
    oxd2: null,
    rpn_current: null,
    oxd_current: null,
  }
}

function makePlaceholderRow(op: Operation, workingRevisionId: string | null, token: string, sortIndex: number): PfmeaRow {
  const base = makeEmptyPfmeaPayload(op.id, workingRevisionId ?? '')
  return {
    id: `${PLACEHOLDER_ROW_PREFIX}${op.id}:${token}`,
    ...base,
    created_at: '',
    __sortIndex: sortIndex,
    operations: {
      id: op.id,
      operation_number: op.operation_number,
      name: op.name,
      machine: op.machine ?? null,
      operation: op.operation ?? null,
      project_id: op.project_id,
      active: op.active,
    },
  } as PfmeaRow
}

function getOperationNodeIdsFromDiagram(diagram: PfdDiagramRow | null): Set<string> {
  const ids = new Set<string>()
  const nodes = Array.isArray(diagram?.nodes) ? diagram.nodes : []
  for (const node of nodes) {
    const id = (node?.id ?? '').toString().trim()
    const kind = (node?.data?.kind ?? '').toString().trim()
    if (!id || kind !== 'operation') continue
    ids.add(id)
  }
  return ids
}

function hasFailureModeContext(row: PfmeaRow) {
  return !!(row.failure_mode ?? '').trim()
}

function hasPfmeaTextValue(value: string | null | undefined) {
  return !!(value ?? '').trim()
}

function reindexPfmeaRows(rows: PfmeaRow[]) {
  let changed = false
  const next = rows.map((row, index) => {
    if (row.__sortIndex === index) return row
    changed = true
    return { ...row, __sortIndex: index }
  })
  return changed ? next : rows
}

function insertPfmeaRowAfterAnchor(prev: PfmeaRow[], anchorRowId: string, nextRow: PfmeaRow) {
  const normalized = reindexPfmeaRows(prev)
  const insertIndex = normalized.findIndex((item) => item.id === anchorRowId)
  const next =
    insertIndex < 0
      ? [...normalized, nextRow]
      : [...normalized.slice(0, insertIndex + 1), nextRow, ...normalized.slice(insertIndex + 1)]
  return reindexPfmeaRows(next)
}

function insertPfmeaRowAtSortIndex(prev: PfmeaRow[], nextRow: PfmeaRow, sortIndex: number | undefined) {
  const normalized = reindexPfmeaRows(prev)
  const safeIndex = Number.isFinite(sortIndex) ? Math.max(0, Math.min(Math.trunc(sortIndex as number), normalized.length)) : normalized.length
  const next = [...normalized.slice(0, safeIndex), nextRow, ...normalized.slice(safeIndex)]
  return reindexPfmeaRows(next)
}

function buildPfmeaRowMatchKey(row: PfmeaRow) {
  return JSON.stringify([
    row.operation_id || row.operations?.id || '',
    normalizePfmeaRowNo(row.row_no) ?? '',
    row.created_at ?? '',
    normalizePfmeaGroupId(row.failure_mode_group_id) ?? '',
    normalizePfmeaGroupId(row.failure_block_group_id) ?? '',
    normalizePfmeaGroupId(row.action_plan_group_id) ?? '',
    row.failure_mode ?? '',
    row.effect ?? '',
    asInt1to10(row.severity) ?? '',
    row.characteristic ?? '',
    normalizeClassValue(row.class) ?? '',
    row.cause ?? '',
    asInt1to10(row.occurrence) ?? '',
    row.current_prevention ?? '',
    row.current_detection ?? '',
    asInt1to10(row.detection) ?? '',
    row.recommended_action ?? '',
    row.responsible ?? '',
    row.target_date ?? '',
    row.action_status ?? '',
    asInt1to10(row.occurrence2) ?? '',
    asInt1to10(row.detection2) ?? '',
  ])
}

function findEquivalentPfmeaRow(rows: PfmeaRow[], sourceRow: PfmeaRow) {
  const operationId = sourceRow.operation_id || sourceRow.operations?.id || null
  const sameOperationRows = rows.filter((row) => (row.operation_id || row.operations?.id || null) === operationId)
  if (sameOperationRows.length === 0) return null

  const sourceRowNo = normalizePfmeaRowNo(sourceRow.row_no)
  if (sourceRowNo) {
    const byRowNo = sameOperationRows.filter((row) => normalizePfmeaRowNo(row.row_no) === sourceRowNo)
    if (byRowNo.length === 1) return byRowNo[0]
  }

  const sourceCreatedAt = (sourceRow.created_at ?? '').trim()
  if (sourceCreatedAt) {
    const byCreatedAt = sameOperationRows.filter((row) => (row.created_at ?? '').trim() === sourceCreatedAt)
    if (byCreatedAt.length === 1) return byCreatedAt[0]
  }

  const sourceKey = buildPfmeaRowMatchKey(sourceRow)
  const bySignature = sameOperationRows.filter((row) => buildPfmeaRowMatchKey(row) === sourceKey)
  if (bySignature.length === 1) return bySignature[0]

  return null
}

function sortPfmeaRows(rows: PfmeaRow[]) {
  const indexed = rows.map((row, index) => ({ row, index }))
  indexed.sort((a, b) => {
    const aRowNoParts = parsePfmeaRowNoParts(a.row.row_no)
    const bRowNoParts = parsePfmeaRowNoParts(b.row.row_no)
    if (aRowNoParts && bRowNoParts) {
      for (let i = 0; i < aRowNoParts.length; i += 1) {
        if (aRowNoParts[i] !== bRowNoParts[i]) return aRowNoParts[i] - bRowNoParts[i]
      }
    }

    const ao = a.row.operations?.operation_number ?? 0
    const bo = b.row.operations?.operation_number ?? 0
    if (ao !== bo) return ao - bo

    const as = a.row.__sortIndex ?? a.index
    const bs = b.row.__sortIndex ?? b.index
    if (as !== bs) return as - bs

    return a.index - b.index
  })
  return indexed.map((item) => item.row)
}

function buildPfmeaCreatedAtOrder(rows: PfmeaRow[]) {
  const baseTime = Date.now() - Math.max(rows.length - 1, 0)
  const hierarchy = buildPfmeaHierarchy(rows)
  return rows.map((row, index) => ({
    id: row.id,
    created_at: new Date(baseTime + index).toISOString(),
    row_no: hierarchy[index]?.rowLabel ?? null,
    ...createPfmeaGroupIds(pickPfmeaGroupIds(row)),
  }))
}

function buildPfmeaPublishedSyncPatch(row: PfmeaRow) {
  return {
    row_no: normalizePfmeaRowNo(row.row_no),
    failure_mode_group_id: normalizePfmeaGroupId(row.failure_mode_group_id),
    failure_block_group_id: normalizePfmeaGroupId(row.failure_block_group_id),
    action_plan_group_id: normalizePfmeaGroupId(row.action_plan_group_id),
    failure_mode: row.failure_mode ?? '',
    effect: row.effect ?? '',
    severity: asInt1to10(row.severity),
    characteristic: row.characteristic ?? '',
    class: normalizeClassValue(row.class),
    cause: row.cause ?? '',
    occurrence: asInt1to10(row.occurrence),
    current_prevention: row.current_prevention ?? '',
    current_detection: row.current_detection ?? '',
    detection: asInt1to10(row.detection),
    rpn: row.rpn ?? null,
    oxd: row.oxd ?? null,
    recommended_action: row.recommended_action ?? '',
    responsible: row.responsible ?? '',
    target_date: row.target_date ?? null,
    action_status: row.action_status ?? null,
    occurrence2: asInt1to10(row.occurrence2),
    detection2: asInt1to10(row.detection2),
    rpn2: row.rpn2 ?? null,
    oxd2: row.oxd2 ?? null,
    rpn_current: row.rpn_current ?? null,
    oxd_current: row.oxd_current ?? null,
    created_at: row.created_at,
  }
}

function hasFailureBlockContext(row: PfmeaRow) {
  return hasFailureModeContext(row) && !!(row.effect ?? '').trim() && asInt1to10(row.severity) != null
}

function hasCurrentRiskBlockContext(row: PfmeaRow) {
  return (
    hasFailureBlockContext(row) &&
    !!(row.cause ?? '').trim() &&
    asInt1to10(row.occurrence) != null &&
    !!(row.current_prevention ?? '').trim() &&
    !!(row.current_detection ?? '').trim() &&
    asInt1to10(row.detection) != null
  )
}

const PFMEA_CLONE_FIELDS: Array<keyof PfmeaRow> = [
  'operation_id',
  'row_no',
  'failure_mode_group_id',
  'failure_block_group_id',
  'action_plan_group_id',
  'failure_mode',
  'effect',
  'severity',
  'characteristic',
  'class',
  'cause',
  'occurrence',
  'current_prevention',
  'current_detection',
  'detection',
  'rpn',
  'oxd',
  'recommended_action',
  'responsible',
  'target_date',
  'action_status',
  'occurrence2',
  'detection2',
  'rpn2',
  'oxd2',
  'rpn_current',
  'oxd_current',
  'created_at',
]

const PFMEA_CLONE_FIELDS_LEGACY: Array<keyof PfmeaRow> = PFMEA_CLONE_FIELDS.filter(
  (field) =>
    field !== 'row_no' &&
    field !== 'failure_mode_group_id' &&
    field !== 'failure_block_group_id' &&
    field !== 'action_plan_group_id'
)

const PFMEA_SELECT_FIELDS = [
  'id',
  'revision_id',
  'operation_id',
  'row_no',
  'failure_mode_group_id',
  'failure_block_group_id',
  'action_plan_group_id',
  'failure_mode',
  'effect',
  'severity',
  'characteristic',
  'class',
  'cause',
  'occurrence',
  'current_prevention',
  'current_detection',
  'detection',
  'rpn',
  'oxd',
  'recommended_action',
  'responsible',
  'target_date',
  'action_status',
  'occurrence2',
  'detection2',
  'rpn2',
  'oxd2',
  'rpn_current',
  'oxd_current',
  'created_at',
  'operations!inner(id,operation_number,name,machine,operation,project_id,active)',
].join(',')

const PFMEA_SELECT_FIELDS_LEGACY = [
  'id',
  'revision_id',
  'operation_id',
  'failure_mode',
  'effect',
  'severity',
  'characteristic',
  'class',
  'cause',
  'occurrence',
  'current_prevention',
  'current_detection',
  'detection',
  'rpn',
  'oxd',
  'recommended_action',
  'responsible',
  'target_date',
  'action_status',
  'occurrence2',
  'detection2',
  'rpn2',
  'oxd2',
  'rpn_current',
  'oxd_current',
  'created_at',
  'operations!inner(id,operation_number,name,machine,operation,project_id,active)',
].join(',')

function getMissingRequiredForRecommendedAction(row: PfmeaRow): Array<keyof PfmeaRow> {
  const missing: Array<keyof PfmeaRow> = []
  if (!row.failure_mode.trim()) missing.push('failure_mode')
  if (!row.effect.trim()) missing.push('effect')
  if (asInt1to10(row.severity) == null) missing.push('severity')
  if (!row.cause.trim()) missing.push('cause')
  if (asInt1to10(row.occurrence) == null) missing.push('occurrence')
  if (!row.current_prevention.trim()) missing.push('current_prevention')
  if (!row.current_detection.trim()) missing.push('current_detection')
  if (asInt1to10(row.detection) == null) missing.push('detection')
  return missing
}

function getPreviousRequiredFieldForActionPlan(target: keyof PfmeaRow, row: PfmeaRow): Array<keyof PfmeaRow> {
  switch (target) {
    case 'recommended_action':
      return getMissingRequiredForRecommendedAction(row)
    case 'responsible':
      return row.recommended_action.trim() ? [] : ['recommended_action']
    case 'target_date':
      return row.responsible.trim() ? [] : ['responsible', 'recommended_action']
    case 'action_status':
      return row.target_date ? [] : ['target_date', 'responsible', 'recommended_action']
    case 'occurrence2':
      return row.action_status ? [] : ['action_status', 'target_date', 'responsible', 'recommended_action']
    case 'detection2':
      return asInt1to10(row.occurrence2) != null ? [] : ['occurrence2', 'action_status', 'target_date', 'responsible', 'recommended_action']
    default:
      return []
  }
}

/* ===================== PFMEA PAGE ===================== */

export default function PfmeaFullPage() {
  return (
    <Suspense fallback={<PfmeaPageFallback />}>
      <PfmeaFullPageContent />
    </Suspense>
  )
}

function PfmeaFullPageContent() {
  const sp = useSearchParams()
  const projectId = sp.get('project') ?? ''
  const opFromUrl = sp.get('op') ?? ''

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [userId, setUserId] = useState<string | null>(null)

  const [project, setProject] = useState<ProjectView | null>(null)
  const [draftRevisionIdOverride, setDraftRevisionIdOverride] = useState<string | null>(null)
  const [ops, setOps] = useState<Operation[]>([])
  const [rows, setRows] = useState<PfmeaRow[]>([])
  const rowsRef = useRef<PfmeaRow[]>([])
  const [severityOptions, setSeverityOptions] = useState<SeverityOption[]>([])
  const [occurrenceOptions, setOccurrenceOptions] = useState<SeverityOption[]>([])
  const [detectionOptions, setDetectionOptions] = useState<SeverityOption[]>([])

  const [draft, setDraft] = useState<NewRowDraft>({ operation_id: '' })

  const [edit, setEdit] = useState<{ rowId: string; col: keyof PfmeaRow } | null>(null)
  const editorRef = useRef<PfmeaEditorElement | null>(null)
  const placeholderMaterializeRef = useRef<Partial<Record<string, Promise<string>>>>({})
  const placeholderMaterializedIdRef = useRef<Partial<Record<string, string>>>({})

  // Risk matrix config
  const [rmMode, setRmMode] = useState<Mode>('rpn')
  const [rmRpn, setRmRpn] = useState<RpnThresholds>({ greenMax: 100, yellowMax: 168, orangeMax: 360 })
  const [rmCells, setRmCells] = useState<Record<string, RiskColor>>({})

  // ===== REVISION SAVE (dirty tracking) =====
  const [dirtyPfmeaIds, setDirtyPfmeaIds] = useState<string[]>([])
  const [deletedPfmeaIds, setDeletedPfmeaIds] = useState<string[]>([])
  const [persistedDirtyDraft, setPersistedDirtyDraft] = useState(false)
  const [showSave, setShowSave] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [changeDesc, setChangeDesc] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<null | {
    title: string
    body: string
    dangerNote?: string
    onConfirm: () => Promise<boolean | void> | boolean | void
  }>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [organizationName, setOrganizationName] = useState('Unknown organization')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<PfmeaHistoryEntry[]>([])
  const [currentAuthorName, setCurrentAuthorName] = useState('Unknown user')
  const [isChampion, setIsChampion] = useState(false)
  const [editSession, setEditSession] = useState<PfmeaEditSession | null>(null)
  const [sessionBusy, setSessionBusy] = useState(false)
  const [sessionMsg, setSessionMsg] = useState('')
  const [sessionNow, setSessionNow] = useState(() => Date.now())
  const [expandedOperationId, setExpandedOperationId] = useState<string | null>(null)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
  const [highlightedMissingCells, setHighlightedMissingCells] = useState<string[] | null>(null)
  const tableWrapRef = useRef<HTMLDivElement | null>(null)
  const [columnFiltersOpen, setColumnFiltersOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<PfmeaColumnId, boolean>>(DEFAULT_VISIBLE_COLUMNS)
  const pendingCellValuesRef = useRef<Record<string, unknown>>({})
  const [, setPendingCellRenderVersion] = useState(0)
  const rowHierarchyByIdRef = useRef<Map<string, PfmeaRowHierarchy>>(new Map())
  const forceRefreshExistingDraftFromOpenRef = useRef(false)
  const transientCauseContinuationIdsRef = useRef<Set<string>>(new Set())
  const transientRecommendedActionContinuationIdsRef = useRef<Set<string>>(new Set())
  const transientFailureModeContinuationIdsRef = useRef<Set<string>>(new Set())
  const transientEffectContinuationIdsRef = useRef<Set<string>>(new Set())
  const pendingTransientDeletePromisesRef = useRef<Record<string, Promise<void>>>({})
  const pendingCellUpdatePromisesRef = useRef<Set<Promise<void>>>(new Set())
  const pfmeaGroupIdsSupportedRef = useRef<boolean | null>(null)
  const previousEditRef = useRef<{ rowId: string; col: keyof PfmeaRow } | null>(null)

  const pendingCellKey = useCallback((rowId: string, col: keyof PfmeaRow) => `${rowId}::${String(col)}`, [])
  const refreshPendingCellRender = useCallback(() => {
    setPendingCellRenderVersion((prev) => prev + 1)
  }, [])
  const setPendingCellValue = useCallback((rowId: string, col: keyof PfmeaRow, value: unknown) => {
    const key = pendingCellKey(rowId, col)
    if (Object.is(pendingCellValuesRef.current[key], value)) return
    pendingCellValuesRef.current[key] = value
    refreshPendingCellRender()
  }, [pendingCellKey, refreshPendingCellRender])
  const clearPendingCellValue = useCallback((rowId: string, col: keyof PfmeaRow) => {
    const key = pendingCellKey(rowId, col)
    if (!(key in pendingCellValuesRef.current)) return
    delete pendingCellValuesRef.current[key]
    refreshPendingCellRender()
  }, [pendingCellKey, refreshPendingCellRender])
  const applyPendingCellValues = useCallback((row: PfmeaRow): PfmeaRow => {
    let next = row
    for (const [key, value] of Object.entries(pendingCellValuesRef.current)) {
      const [rowId, col] = key.split('::') as [string, keyof PfmeaRow]
      if (rowId !== row.id) continue
      if (next === row) next = { ...row }
      ;(next as any)[col] = value
    }
    return next
  }, [])
  const clearRecommendedActionTransientIfFilled = useCallback((rowId: string, value: string | null | undefined) => {
    if (!transientRecommendedActionContinuationIdsRef.current.has(rowId)) return
    if (!(value ?? '').toString().trim()) return
    transientRecommendedActionContinuationIdsRef.current.delete(rowId)
  }, [])

  const isMissingPfmeaGroupIdColumnError = useCallback((error: unknown) => {
    const message = (error as { message?: string } | null)?.message ?? String(error ?? '')
    const normalized = message.toLowerCase()
    return (
      normalized.includes('row_no') ||
      normalized.includes('failure_mode_group_id') ||
      normalized.includes('failure_block_group_id') ||
      normalized.includes('action_plan_group_id')
    )
  }, [])

  const stripPfmeaGroupIdsFromPayload = useCallback((payload: Record<string, unknown>) => {
    const { row_no, failure_mode_group_id, failure_block_group_id, action_plan_group_id, ...rest } = payload
    return rest
  }, [])

  const scheduleTransientRowDeletion = useCallback((rowId: string) => {
    const existing = pendingTransientDeletePromisesRef.current[rowId]
    if (existing) return existing

    const task = (async () => {
      const res = await supabase.from('pfmea_rows').delete().eq('id', rowId)
      if (res.error) throw res.error
    })()

    pendingTransientDeletePromisesRef.current[rowId] = task
    task.finally(() => {
      delete pendingTransientDeletePromisesRef.current[rowId]
    })
    return task
  }, [])

  const clearPfmeaTransientTracking = useCallback(() => {
    transientCauseContinuationIdsRef.current.clear()
    transientRecommendedActionContinuationIdsRef.current.clear()
    transientFailureModeContinuationIdsRef.current.clear()
    transientEffectContinuationIdsRef.current.clear()
    pendingTransientDeletePromisesRef.current = {}
  }, [])

  const resetPfmeaEditRuntimeState = useCallback((options?: { clearTransient?: boolean }) => {
    setEdit(null)
    previousEditRef.current = null
    editorRef.current = null
    pendingCellValuesRef.current = {}
    placeholderMaterializeRef.current = {}
    placeholderMaterializedIdRef.current = {}
    if (options?.clearTransient !== false) {
      clearPfmeaTransientTracking()
    }
    refreshPendingCellRender()
  }, [clearPfmeaTransientTracking, refreshPendingCellRender])

  const flushPendingTransientDeletes = useCallback(async () => {
    const pending = Object.values(pendingTransientDeletePromisesRef.current)
    if (pending.length === 0) return
    await Promise.all(pending)
  }, [])

  const flushPendingCellUpdates = useCallback(async () => {
    const pending = Array.from(pendingCellUpdatePromisesRef.current)
    if (pending.length === 0) return
    await Promise.allSettled(pending)
  }, [])

  useEffect(() => {
    rowsRef.current = rows
    const nextPending: Record<string, unknown> = {}
    for (const [key, pendingValue] of Object.entries(pendingCellValuesRef.current)) {
      const [rowId, col] = key.split('::') as [string, keyof PfmeaRow]
      const row = rows.find((item) => item.id === rowId)
      if (!row) {
        nextPending[key] = pendingValue
        continue
      }
      const actualValue = (row as any)[col]
      if (String(actualValue ?? '') !== String(pendingValue ?? '')) {
        nextPending[key] = pendingValue
      }
    }
    pendingCellValuesRef.current = nextPending
  }, [rows])

  const dirtyDraftStorageKey = useMemo(
    () => (projectId ? `${PFMEA_DIRTY_DRAFT_KEY_PREFIX}:${projectId}` : ''),
    [projectId]
  )

  const isDirty = dirtyPfmeaIds.length > 0 || deletedPfmeaIds.length > 0 || persistedDirtyDraft

  useEffect(() => {
    if (!dirtyDraftStorageKey || typeof window === 'undefined') {
      setPersistedDirtyDraft(false)
      return
    }
    try {
      setPersistedDirtyDraft(window.sessionStorage.getItem(dirtyDraftStorageKey) === '1')
    } catch {
      setPersistedDirtyDraft(false)
    }
  }, [dirtyDraftStorageKey])

  const markDirtyDraftPersisted = useCallback(() => {
    setPersistedDirtyDraft(true)
    if (!dirtyDraftStorageKey || typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(dirtyDraftStorageKey, '1')
    } catch {}
  }, [dirtyDraftStorageKey])

  const clearDirtyDraftPersisted = useCallback(() => {
    setPersistedDirtyDraft(false)
    if (!dirtyDraftStorageKey || typeof window === 'undefined') return
    try {
      window.sessionStorage.removeItem(dirtyDraftStorageKey)
    } catch {}
  }, [dirtyDraftStorageKey])

  useEffect(() => {
    if (!project) return
    if (project?.current_draft_revision_id) return
    clearDirtyDraftPersisted()
  }, [project, project?.current_draft_revision_id, clearDirtyDraftPersisted])

  const markPfmeaDirty = useCallback((id: string) => {
    setDirtyPfmeaIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    markDirtyDraftPersisted()
  }, [markDirtyDraftPersisted])

  const canWork = !!projectId
  const canAdd = useMemo(() => canWork && !!draft.operation_id && ops.length > 0, [canWork, draft.operation_id, ops.length])

  const isObsolete = (project?.status ?? 'DRAFT') === 'OBSOLETE'
  const sessionExpired = useMemo(() => {
    if (!editSession) return false
    const last = new Date(editSession.lastActivityAt).getTime()
    if (!Number.isFinite(last)) return true
    return Date.now() - last >= EDIT_LOCK_MS
  }, [editSession])
  const isEditOwner = !!userId && !!editSession && editSession.lockedBy === userId && !sessionExpired
  const isLockedByOther = !!editSession && !isEditOwner && !sessionExpired
  const lockRemainingText = useMemo(() => {
    if (!editSession || !isLockedByOther) return ''
    const last = new Date(editSession.lastActivityAt).getTime()
    const left = Math.max(0, EDIT_LOCK_MS - (sessionNow - last))
    const h = Math.floor(left / 3_600_000)
    const m = Math.floor((left % 3_600_000) / 60_000)
    return `${h}h ${m}m`
  }, [editSession, isLockedByOther, sessionNow])
  const readOnly = isObsolete || !isEditOwner
  const activeDraftRevisionId = draftRevisionIdOverride ?? project?.current_draft_revision_id ?? null
  const workingRevisionId = isEditOwner
    ? activeDraftRevisionId ?? project?.current_open_revision_id ?? null
    : project?.current_open_revision_id ?? activeDraftRevisionId
  const workingRevisionLabel = isEditOwner
    ? project?.draft_revision_label ?? project?.open_revision_label
    : project?.open_revision_label ?? project?.draft_revision_label

  useEffect(() => {
    if (!highlightedMissingCells || highlightedMissingCells.length === 0) return
    const clearHighlights = () => setHighlightedMissingCells(null)
    document.addEventListener('mousedown', clearHighlights)
    return () => document.removeEventListener('mousedown', clearHighlights)
  }, [highlightedMissingCells])

  /* ---------- auth user ---------- */
  useEffect(() => {
  let alive = true

  ;(async () => {
    const { data } = await supabase.auth.getSession()
    if (!alive) return

    if (!data.session) {
      const next =
        window.location.pathname + window.location.search

      window.location.assign(
        `/login?next=${encodeURIComponent(next)}`
      )
      return
    }

    setUserId(data.session.user.id)
  })()

  return () => {
    alive = false
  }
}, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!userId) return
    try {
      const raw = window.localStorage.getItem(`${PFMEA_VISIBLE_COLUMNS_KEY_PREFIX}:${userId}`)
      if (!raw) {
        setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
        return
      }
      const parsed = JSON.parse(raw) as Partial<Record<PfmeaColumnId, boolean>>
      const next: Record<PfmeaColumnId, boolean> = { ...DEFAULT_VISIBLE_COLUMNS }
      for (const col of PFMEA_COLUMNS) {
        const value = parsed?.[col.id]
        if (typeof value === 'boolean') next[col.id] = value
      }
      next.delete = true
      setVisibleColumns(next)
    } catch {
      setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    }
  }, [userId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!userId) return
    try {
      window.localStorage.setItem(`${PFMEA_VISIBLE_COLUMNS_KEY_PREFIX}:${userId}`, JSON.stringify(visibleColumns))
    } catch {}
  }, [userId, visibleColumns])

  useEffect(() => {
    let alive = true
    if (!userId) {
      setCurrentAuthorName('Unknown user')
      return () => {
        alive = false
      }
    }

    ;(async () => {
      try {
        const res = await supabase
          .from('profiles')
          .select('first_name,last_name')
          .eq('id', userId)
          .maybeSingle()
        if (!alive) return
        const first = ((res.data as { first_name?: string | null } | null)?.first_name ?? '').trim()
        const last = ((res.data as { last_name?: string | null } | null)?.last_name ?? '').trim()
        const full = `${first} ${last}`.trim()
        setCurrentAuthorName(full || 'Unknown user')
      } catch {
        if (!alive) return
        setCurrentAuthorName('Unknown user')
      }
    })()

    return () => {
      alive = false
    }
  }, [userId])

  const loadUserContext = useCallback(async () => {
    if (!projectId || !userId) {
      setIsChampion(false)
      return
    }
    try {
      const projectRes = await supabase.from('projects').select('organization_id').eq('id', projectId).maybeSingle()
      const organizationId = (projectRes.data as { organization_id?: string | null } | null)?.organization_id ?? null
      if (!organizationId) {
        setIsChampion(false)
        return
      }
      const memberRes = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle()
      const role = ((memberRes.data as { role?: string | null } | null)?.role ?? '').toLowerCase()
      setIsChampion(role === 'champion' || role === 'admin')
    } catch {
      setIsChampion(false)
    }
  }, [projectId, userId])

  const loadEditSession = useCallback(async () => {
    if (!projectId) {
      setEditSession(null)
      return
    }
    try {
      const res = await supabase
        .from('pfmea_edit_sessions')
        .select('project_id,locked_by,started_at,last_activity_at')
        .eq('project_id', projectId)
        .maybeSingle()
      if (res.error || !res.data) {
        setEditSession(null)
        return
      }
      const row = res.data as {
        project_id: string
        locked_by: string
        started_at: string
        last_activity_at: string
      }
      setEditSession({
        projectId: row.project_id,
        lockedBy: row.locked_by,
        startedAt: row.started_at,
        lastActivityAt: row.last_activity_at,
      })
    } catch {
      setEditSession(null)
    }
  }, [projectId])

  const startEditSession = useCallback(async () => {
    if (!projectId || !userId || isObsolete) return
    setSessionBusy(true)
    setErr('')
    setSessionMsg('')
    resetPfmeaEditRuntimeState()
    try {
      const nowIso = new Date().toISOString()
      const res = await supabase
        .from('pfmea_edit_sessions')
        .select('project_id,locked_by,last_activity_at')
        .eq('project_id', projectId)
        .maybeSingle()
      const row = (res.data ?? null) as { locked_by?: string | null; last_activity_at?: string | null } | null
      const otherOwner = row?.locked_by ?? null
      const last = row?.last_activity_at ? new Date(row.last_activity_at).getTime() : 0
      const hasExistingDraftRevision = !!(project?.current_draft_revision_id ?? draftRevisionIdOverride)
      const hasActiveOwnedSession = !!otherOwner && otherOwner === userId && Date.now() - last < EDIT_LOCK_MS
      const hasActiveOther = !!otherOwner && otherOwner !== userId && Date.now() - last < EDIT_LOCK_MS

      forceRefreshExistingDraftFromOpenRef.current = hasExistingDraftRevision && !hasActiveOwnedSession

      if (hasActiveOther && !isChampion) {
        setErr('This PFMEA is currently locked by another user.')
        forceRefreshExistingDraftFromOpenRef.current = false
        return
      }

      if (otherOwner && otherOwner !== userId) {
        const projectRes = await supabase
          .from('projects_with_revision')
          .select('current_draft_revision_id')
          .eq('id', projectId)
          .maybeSingle()
        const draftId = (projectRes.data?.current_draft_revision_id as string | null | undefined) ?? draftRevisionIdOverride
        if (draftId) {
          await supabase.from('pfmea_rows').delete().eq('revision_id', draftId)
          setDraftRevisionIdOverride(null)
          setDirtyPfmeaIds([])
          setDeletedPfmeaIds([])
          clearDirtyDraftPersisted()
        }
        forceRefreshExistingDraftFromOpenRef.current = false
        const reason = Date.now() - last >= EDIT_LOCK_MS ? '48h inactivity timeout' : 'session takeover by Champion'
        setSessionMsg(`Previous PFMEA draft was discarded (${reason}).`)
      }

      if (!hasActiveOther && !hasActiveOwnedSession && hasExistingDraftRevision) {
        const projectRes = await supabase
          .from('projects_with_revision')
          .select('current_draft_revision_id')
          .eq('id', projectId)
          .maybeSingle()
        const draftId = (projectRes.data?.current_draft_revision_id as string | null | undefined) ?? draftRevisionIdOverride
        if (draftId) {
          const deleteDraftRowsRes = await supabase.from('pfmea_rows').delete().eq('revision_id', draftId)
          if (deleteDraftRowsRes.error) throw deleteDraftRowsRes.error
          setDraftRevisionIdOverride(null)
          setDirtyPfmeaIds([])
          setDeletedPfmeaIds([])
          clearDirtyDraftPersisted()
          setSessionMsg('Previous PFMEA draft was refreshed from the latest OPEN revision.')
        }
      }

      const upsertRes = await supabase.from('pfmea_edit_sessions').upsert(
        [
          {
            project_id: projectId,
            locked_by: userId,
            started_at: nowIso,
            last_activity_at: nowIso,
            updated_at: nowIso,
          },
        ],
        { onConflict: 'project_id' }
      )
      if (upsertRes.error) throw new Error(upsertRes.error.message)

      const ensureDraftRes = await supabase.rpc('ensure_process_draft', {
        p_project_id: projectId,
        p_user_id: userId,
      })
      if (ensureDraftRes.error) throw ensureDraftRes.error

      const refreshedProjectRes = await supabase
        .from('projects_with_revision')
        .select('id,name,standard,status,current_open_revision_id,current_draft_revision_id,open_revision_label,draft_revision_label')
        .eq('id', projectId)
        .single()
      if (refreshedProjectRes.error) throw refreshedProjectRes.error

      const refreshedView = refreshedProjectRes.data as ProjectView
      setProject(refreshedView as any)

      const refreshedDraftRevisionId =
        refreshedView.current_draft_revision_id ?? (ensureDraftRes.data as string | null) ?? null
      const refreshedOpenRevisionId = refreshedView.current_open_revision_id ?? null

      const hydrateDraftRowsFromOpen = async () => {
        if (!refreshedDraftRevisionId || !refreshedOpenRevisionId || refreshedDraftRevisionId === refreshedOpenRevisionId) return

        const deleteExistingDraftRowsRes = await supabase.from('pfmea_rows').delete().eq('revision_id', refreshedDraftRevisionId)
        if (deleteExistingDraftRowsRes.error) throw deleteExistingDraftRowsRes.error

        const loadSourceRows = async () => {
          const sourceSelect =
            pfmeaGroupIdsSupportedRef.current === false ? PFMEA_CLONE_FIELDS_LEGACY.join(',') : PFMEA_CLONE_FIELDS.join(',')

          let sourceRowsRes = await supabase
            .from('pfmea_rows')
            .select(sourceSelect)
            .eq('revision_id', refreshedOpenRevisionId)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })

          if (sourceRowsRes.error && isMissingPfmeaGroupIdColumnError(sourceRowsRes.error)) {
            pfmeaGroupIdsSupportedRef.current = false
            sourceRowsRes = await supabase
              .from('pfmea_rows')
              .select(PFMEA_CLONE_FIELDS_LEGACY.join(','))
              .eq('revision_id', refreshedOpenRevisionId)
              .order('created_at', { ascending: true })
              .order('id', { ascending: true })
          } else if (!sourceRowsRes.error && pfmeaGroupIdsSupportedRef.current !== false) {
            pfmeaGroupIdsSupportedRef.current = true
          }

          if (sourceRowsRes.error) throw sourceRowsRes.error
          return (sourceRowsRes.data ?? []) as Array<Partial<PfmeaRow>>
        }

        const sourceRows = await loadSourceRows()
        if (sourceRows.length === 0) return

        const clonePayload = sourceRows.map((sourceRow) => {
          const clonedRow = { revision_id: refreshedDraftRevisionId } as Partial<PfmeaRow> & { revision_id: string }
          for (const field of PFMEA_CLONE_FIELDS) {
            ;(clonedRow as any)[field] = sourceRow[field] ?? null
          }
          return clonedRow
        })

        const insertPayload =
          pfmeaGroupIdsSupportedRef.current === false
            ? clonePayload.map((row) => stripPfmeaGroupIdsFromPayload(row as Record<string, unknown>))
            : clonePayload

        const cloneInsertRes = await supabase.from('pfmea_rows').insert(insertPayload)
        if (cloneInsertRes.error) throw cloneInsertRes.error
      }

      await hydrateDraftRowsFromOpen()
      if (refreshedDraftRevisionId) {
        setDraftRevisionIdOverride(refreshedDraftRevisionId)
      }

      await loadEditSession()
      await loadAll(refreshedDraftRevisionId ?? refreshedOpenRevisionId)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSessionBusy(false)
    }
  }, [projectId, userId, isObsolete, isChampion, loadEditSession, draftRevisionIdOverride, project?.current_draft_revision_id, clearDirtyDraftPersisted, resetPfmeaEditRuntimeState])

  const discardDraftAndCloseSession = useCallback(async () => {
    if (!projectId || !userId || !isEditOwner) return
    setSessionBusy(true)
    setErr('')
    resetPfmeaEditRuntimeState()
    try {
      const projectRes = await supabase
        .from('projects_with_revision')
        .select('current_draft_revision_id')
        .eq('id', projectId)
        .maybeSingle()
      const draftId = (projectRes.data?.current_draft_revision_id as string | null | undefined) ?? draftRevisionIdOverride
      if (draftId) await supabase.from('pfmea_rows').delete().eq('revision_id', draftId)
      await supabase.from('pfmea_edit_sessions').delete().eq('project_id', projectId).eq('locked_by', userId)
      setDraftRevisionIdOverride(null)
      setDirtyPfmeaIds([])
      setDeletedPfmeaIds([])
      clearDirtyDraftPersisted()
      await loadEditSession()
      await loadAll()
      setSessionMsg('Draft discarded. Session closed without publishing.')
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSessionBusy(false)
    }
  }, [projectId, userId, isEditOwner, draftRevisionIdOverride, loadEditSession, resetPfmeaEditRuntimeState])

  const isColumnVisible = useCallback((id: PfmeaColumnId) => {
    // Keep the delete column width reserved in both modes so row wrapping/height
    // stays stable when toggling edit mode.
    if (id === 'delete') return true
    return visibleColumns[id] !== false
  }, [visibleColumns])
  const toggleColumnVisibility = useCallback((id: PfmeaColumnId, checked: boolean) => {
    setVisibleColumns((prev) => ({ ...prev, [id]: checked }))
  }, [])
  const clearColumnGroup = useCallback((ids: PfmeaColumnId[]) => {
    setVisibleColumns((prev) => {
      const next = { ...prev }
      for (const id of ids) next[id] = true
      return next
    })
  }, [])
  const uncheckColumnGroup = useCallback((ids: PfmeaColumnId[]) => {
    setVisibleColumns((prev) => {
      const next = { ...prev }
      for (const id of ids) next[id] = false
      next.delete = true
      return next
    })
  }, [])

  /* ---------- load risk matrix (global) ---------- */
  const loadRiskMatrix = useCallback(async () => {
    const cfg = await supabase
      .from('risk_matrix_config')
      .select('id,mode,rpn_green_max,rpn_yellow_max,rpn_orange_max')
      .eq('id', 1)
      .maybeSingle()

    if (!cfg.error && cfg.data) {
      const c = cfg.data as DbConfig
      setRmMode(c.mode)
      setRmRpn({
        greenMax: clampInt(c.rpn_green_max, 1, 1000),
        yellowMax: clampInt(c.rpn_yellow_max, 1, 1000),
        orangeMax: clampInt(c.rpn_yellow_max, 1, 1000),
      })
      setRmRpn({
        greenMax: clampInt(c.rpn_green_max, 1, 1000),
        yellowMax: clampInt(c.rpn_yellow_max, 1, 1000),
        orangeMax: clampInt(c.rpn_orange_max, 1, 1000),
      })
    }

    const cellsRes = await supabase
      .from('risk_matrix_cells')
      .select('project_id,severity,do_value,color')
      .eq('project_id', GLOBAL_PROJECT_ID)

    if (!cellsRes.error) {
      const map: Record<string, RiskColor> = {}
      for (const row of (cellsRes.data ?? []) as DbCell[]) {
        map[cellKey(row.severity, row.do_value)] = row.color
      }
      setRmCells(map)
    }
  }, [])

  const loadScaleOptions = useCallback(async () => {
    if (!projectId) {
      setSeverityOptions([])
      setOccurrenceOptions([])
      setDetectionOptions([])
      setOrganizationName('Unknown organization')
      return
    }

    const projectRes = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .maybeSingle()

    if (projectRes.error) throw projectRes.error

    const orgId = (projectRes.data as { organization_id?: string | null } | null)?.organization_id ?? null
    if (!orgId) {
      setSeverityOptions([])
      setOccurrenceOptions([])
      setDetectionOptions([])
      setOrganizationName('Unknown organization')
      return
    }

    const orgNameRes = await supabase.from('organizations').select('name').eq('id', orgId).maybeSingle()
    const orgName = ((orgNameRes.data as { name?: string | null } | null)?.name ?? '').trim()
    setOrganizationName(orgName || 'Unknown organization')

    const [sevRes, occRes, detRes] = await Promise.all([
      supabase.rpc('get_severity_effective', { p_org: orgId }),
      supabase.rpc('get_occurrence_effective', { p_org: orgId }),
      supabase.rpc('get_detection_effective', { p_org: orgId }),
    ])

    if (sevRes.error) throw sevRes.error
    if (occRes.error) throw occRes.error
    if (detRes.error) throw detRes.error

    const toOptions = (rowsRaw: SeverityEffectiveRow[]) =>
      rowsRaw
        .filter((row) => row.active !== false && Number.isFinite(row.level))
        .sort((a, b) => b.level - a.level)
        .map((row) => ({
          level: row.level,
          label: shortSeverityLabel(row.name ?? null, row.description ?? null),
          examples: parseExamples(row.description ?? null),
        }))

    setSeverityOptions(toOptions((sevRes.data ?? []) as SeverityEffectiveRow[]))
    setOccurrenceOptions(toOptions((occRes.data ?? []) as SeverityEffectiveRow[]))
    setDetectionOptions(toOptions((detRes.data ?? []) as SeverityEffectiveRow[]))
  }, [projectId])

  function getRiskColorFor(sev: number | null, doVal: number | null): RiskColor | null {
    if (sev == null || doVal == null) return null

    const s = clampInt(sev, 1, 10)
    const d = clampInt(doVal, 1, 100)

    if (rmMode === 'manual') {
      const hit = rmCells[cellKey(s, d)]
      if (hit) return hit
      return colorFromRpn(s, d, rmRpn)
    }
    return colorFromRpn(s, d, rmRpn)
  }

  /* ---------- helper: reload only project view ---------- */
  const loadProjectView = useCallback(async (options?: { syncDraftOverride?: boolean }) => {
    const pr = await supabase
      .from('projects_with_revision')
      .select('id,name,standard,status,current_open_revision_id,current_draft_revision_id,open_revision_label,draft_revision_label')
      .eq('id', projectId)
      .single()

    if (pr.error) throw pr.error
    const view = pr.data as ProjectView
    setProject(view as any)
    if (options?.syncDraftOverride === true && view.current_draft_revision_id) {
      setDraftRevisionIdOverride(view.current_draft_revision_id)
    }
    return view
  }, [projectId])

  /* ---------- helper: ensure draft exists before making changes ---------- */
  const ensureDraftIfNeeded = useCallback(async () => {
    if (!projectId) return null
    if (!userId) throw new Error('Not authenticated.')
    if (!isEditOwner) throw new Error('Click "Edit PFMEA" to start an edit session.')
    const sourceRevisionIdBeforeDraft = project?.current_open_revision_id ?? workingRevisionId ?? null

    const ensureDraftRowsHydrated = async (
      draftRevisionId: string | null,
      sourceRevisionId: string | null,
      options?: { replaceExisting?: boolean }
    ) => {
      if (!draftRevisionId || !sourceRevisionId || draftRevisionId === sourceRevisionId) return

      const existingDraftRowsRes = await supabase
        .from('pfmea_rows')
        .select('id')
        .eq('revision_id', draftRevisionId)
        .limit(1)

      if (existingDraftRowsRes.error) throw existingDraftRowsRes.error
      const hasExistingDraftRows = (existingDraftRowsRes.data?.length ?? 0) > 0
      if (hasExistingDraftRows && !options?.replaceExisting) return
      if (hasExistingDraftRows && options?.replaceExisting) {
        const deleteExistingDraftRowsRes = await supabase.from('pfmea_rows').delete().eq('revision_id', draftRevisionId)
        if (deleteExistingDraftRowsRes.error) throw deleteExistingDraftRowsRes.error
      }

      const openRowsRes = await supabase
        .from('pfmea_rows')
        .select((pfmeaGroupIdsSupportedRef.current === false ? PFMEA_CLONE_FIELDS_LEGACY : PFMEA_CLONE_FIELDS).join(','))
        .eq('revision_id', sourceRevisionId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      if (openRowsRes.error && isMissingPfmeaGroupIdColumnError(openRowsRes.error)) {
        pfmeaGroupIdsSupportedRef.current = false
        const legacyOpenRowsRes = await supabase
          .from('pfmea_rows')
          .select(PFMEA_CLONE_FIELDS_LEGACY.join(','))
          .eq('revision_id', sourceRevisionId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
        if (legacyOpenRowsRes.error) throw legacyOpenRowsRes.error
        var sourceRows = (legacyOpenRowsRes.data ?? []) as Array<Partial<PfmeaRow>>
      } else {
        if (openRowsRes.error) throw openRowsRes.error
        pfmeaGroupIdsSupportedRef.current = true
        var sourceRows = (openRowsRes.data ?? []) as Array<Partial<PfmeaRow>>
      }
      if (sourceRows.length === 0) {
        sourceRows = rowsRef.current.map((row) => {
          const sourceRow = {} as Partial<PfmeaRow>
          for (const field of PFMEA_CLONE_FIELDS) {
            sourceRow[field] = row[field] as never
          }
          return sourceRow
        })
      }
      if (sourceRows.length === 0) return

      const clonePayload = sourceRows.map((sourceRow) => {
        const clonedRow = { revision_id: draftRevisionId } as Partial<PfmeaRow> & { revision_id: string }
        for (const field of PFMEA_CLONE_FIELDS) {
          ;(clonedRow as any)[field] = sourceRow[field] ?? null
        }
        return clonedRow
      })

      const insertClonePayload =
        pfmeaGroupIdsSupportedRef.current === false
          ? clonePayload.map((row) => stripPfmeaGroupIdsFromPayload(row as Record<string, unknown>))
          : clonePayload

      const insertCloneRes = await supabase.from('pfmea_rows').insert(insertClonePayload)
      if (insertCloneRes.error) throw insertCloneRes.error
    }

      const hasVisibleRowsFromCurrentDraft =
        !!(project?.current_draft_revision_id || draftRevisionIdOverride) &&
        rowsRef.current.some(
          (row) =>
            !isPlaceholderRowId(row.id) &&
            row.revision_id === (draftRevisionIdOverride ?? project?.current_draft_revision_id ?? null)
        )
      const shouldRefreshExistingDraftFromOpen =
        !!project?.current_open_revision_id &&
        !!(draftRevisionIdOverride ?? project?.current_draft_revision_id) &&
        (
          forceRefreshExistingDraftFromOpenRef.current ||
          (!persistedDirtyDraft && !hasVisibleRowsFromCurrentDraft)
        )

    if (draftRevisionIdOverride) {
      await ensureDraftRowsHydrated(draftRevisionIdOverride, project?.current_open_revision_id ?? sourceRevisionIdBeforeDraft, {
        replaceExisting: shouldRefreshExistingDraftFromOpen,
      })
      forceRefreshExistingDraftFromOpenRef.current = false
      return draftRevisionIdOverride
    }
    // if draft already exists -> ensure it contains a cloned snapshot from OPEN
    if (project?.current_draft_revision_id) {
      await ensureDraftRowsHydrated(project.current_draft_revision_id, project.current_open_revision_id ?? sourceRevisionIdBeforeDraft, {
        replaceExisting: shouldRefreshExistingDraftFromOpen,
      })
      forceRefreshExistingDraftFromOpenRef.current = false
      return project.current_draft_revision_id
    }

    // if project is obsolete -> no draft changes
    if ((project?.status ?? 'DRAFT') === 'OBSOLETE') throw new Error('Process is OBSOLETE (read-only).')

    const { data, error } = await supabase.rpc('ensure_process_draft', {
      p_project_id: projectId,
      p_user_id: userId,
    })

    if (error) throw error
    // refresh project to get current_draft_revision_id
    const pv = await loadProjectView({ syncDraftOverride: false })
    const ensured = pv.current_draft_revision_id ?? (data as string | null) ?? null
    await ensureDraftRowsHydrated(ensured, pv.current_open_revision_id ?? sourceRevisionIdBeforeDraft)
    forceRefreshExistingDraftFromOpenRef.current = false
    if (ensured) setDraftRevisionIdOverride(ensured)
    return ensured
  }, [projectId, userId, isEditOwner, draftRevisionIdOverride, project?.current_draft_revision_id, project?.status, loadProjectView, workingRevisionId, project?.current_open_revision_id, persistedDirtyDraft])

  /* ---------- load project / operations / rows ---------- */
  async function loadAll(forceRevisionId?: string | null) {
    if (!projectId) return
    setLoading(true)
    setErr('')

    try {
      const fetchPfmeaRowsForRevision = async (revisionId: string) => {
        const selectFields = pfmeaGroupIdsSupportedRef.current === false ? PFMEA_SELECT_FIELDS_LEGACY : PFMEA_SELECT_FIELDS
        let response = await supabase
          .from('pfmea_rows')
          .select(selectFields)
          .eq('operations.project_id', projectId)
          .eq('revision_id', revisionId)
          .order('operation_number', { foreignTable: 'operations', ascending: true })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })

        if (response.error && isMissingPfmeaGroupIdColumnError(response.error)) {
          pfmeaGroupIdsSupportedRef.current = false
          response = await supabase
            .from('pfmea_rows')
            .select(PFMEA_SELECT_FIELDS_LEGACY)
            .eq('operations.project_id', projectId)
            .eq('revision_id', revisionId)
            .order('operation_number', { foreignTable: 'operations', ascending: true })
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
        } else if (!response.error && pfmeaGroupIdsSupportedRef.current !== false) {
          pfmeaGroupIdsSupportedRef.current = true
        }

        if (response.error) throw response.error
        return (response.data ?? []) as unknown as PfmeaRow[]
      }

      const [pv, pfdDiagRes] = await Promise.all([
        loadProjectView(),
        supabase.from('pfd_diagrams').select('nodes').eq('project_id', projectId).maybeSingle(),
        loadRiskMatrix(),
        loadScaleOptions(),
      ])

      const diagramOperationIds =
        pfdDiagRes.error ? new Set<string>() : getOperationNodeIdsFromDiagram((pfdDiagRes.data ?? null) as PfdDiagramRow | null)
      const useDiagramOperationFilter = diagramOperationIds.size > 0

      const opsRes = await supabase
        .from('operations')
        .select('id,project_id,operation_number,name,machine,operation,active')
        .eq('project_id', projectId)
        .eq('active', true)
        .order('operation_number', { ascending: true })

      if (opsRes.error) throw opsRes.error

      const operations = ((opsRes.data ?? []) as Operation[]).filter((op) => !useDiagramOperationFilter || diagramOperationIds.has(op.id))
      setOps(operations)
      if (!isEditOwner && !forceRevisionId && draftRevisionIdOverride && pv.current_open_revision_id) {
        setDraftRevisionIdOverride(null)
      }
      // owner sees own draft; others see latest published (OPEN)
      const openRevId = pv.current_open_revision_id ?? null
      const draftRevId = draftRevisionIdOverride ?? pv.current_draft_revision_id ?? null
      let revId = forceRevisionId ?? null
      if (!revId) {
        revId = isEditOwner ? draftRevId ?? openRevId : openRevId ?? draftRevId
      }

      // If no revision exists yet (rare), show empty
      if (!revId) {
        clearPfmeaTransientTracking()
        rowsRef.current = []
        setRows([])
        setLoading(false)
        return
      }

      let pfmeaRows = await fetchPfmeaRowsForRevision(revId)
      if (useDiagramOperationFilter) {
        pfmeaRows = pfmeaRows.filter((row) => {
          const opId = row.operation_id || row.operations?.id || ''
          return !!opId && diagramOperationIds.has(opId)
        })
      }

      if (pfmeaRows.length === 0 && isEditOwner && draftRevId && revId === draftRevId && openRevId && openRevId !== draftRevId) {
        try {
          pfmeaRows = await fetchPfmeaRowsForRevision(openRevId)
          if (useDiagramOperationFilter) {
            pfmeaRows = pfmeaRows.filter((row) => {
              const opId = row.operation_id || row.operations?.id || ''
              return !!opId && diagramOperationIds.has(opId)
            })
          }
        } catch {}
        if (pfmeaRows.length > 0) {
          // rows already assigned above
        }
      }

      // Fallback: if current/open revision has no rows, but PFMEA rows exist on another revision,
      // load that revision so user does not see an empty table despite persisted data.
      if (pfmeaRows.length === 0) {
        const latestRevRes = await supabase
          .from('pfmea_rows')
          .select('revision_id,created_at,operations!inner(project_id,active)')
          .eq('operations.project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1)

        if (!latestRevRes.error) {
          const fallbackRevisionId =
            (((latestRevRes.data ?? [])[0] as { revision_id?: string | null } | undefined)?.revision_id ?? '').trim() || null

          if (fallbackRevisionId && fallbackRevisionId !== revId) {
            try {
              pfmeaRows = await fetchPfmeaRowsForRevision(fallbackRevisionId)
              if (useDiagramOperationFilter) {
                pfmeaRows = pfmeaRows.filter((row) => {
                  const opId = row.operation_id || row.operations?.id || ''
                  return !!opId && diagramOperationIds.has(opId)
                })
              }
              if (pfmeaRows.length > 0 && isEditOwner) {
                setDraftRevisionIdOverride(fallbackRevisionId)
              }
            } catch {}
          }
        }
      }

      clearPfmeaTransientTracking()
      const nextRows = reindexPfmeaRows(hydratePfmeaGroupIds(pfmeaRows))
      rowsRef.current = nextRows
      setRows(nextRows)

      if (opFromUrl) {
        const exists = operations.some((o) => o.id === opFromUrl)
        if (exists) {
          setDraft({ operation_id: opFromUrl })
          setLoading(false)
          return
        }
      }

      if (!draft.operation_id && operations.length > 0) {
        setDraft({ operation_id: operations[0].id })
      }

      setLoading(false)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!projectId) return
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isEditOwner, draftRevisionIdOverride])

  useEffect(() => {
    if (!opFromUrl) return
    setDraft({ operation_id: opFromUrl })
  }, [opFromUrl])

  useEffect(() => {
    setDraftRevisionIdOverride(null)
    setEditSession(null)
    setSessionMsg('')
    setExpandedOperationId(null)
    forceRefreshExistingDraftFromOpenRef.current = false
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    void loadUserContext()
    void loadEditSession()
  }, [projectId, loadUserContext, loadEditSession])

  useEffect(() => {
    if (!projectId) return
    const timer = setInterval(() => {
      void loadEditSession()
      setSessionNow(Date.now())
    }, 30_000)
    return () => clearInterval(timer)
  }, [projectId, loadEditSession])

  useEffect(() => {
    if (!projectId || !userId || !isEditOwner) return
    const beat = async () => {
      await supabase
        .from('pfmea_edit_sessions')
        .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('project_id', projectId)
        .eq('locked_by', userId)
    }
    const timer = setInterval(() => {
      void beat()
    }, 30_000)
    return () => clearInterval(timer)
  }, [projectId, userId, isEditOwner])

  useEffect(() => {
    if (!edit) return
    setTimeout(() => editorRef.current?.focus?.(), 0)
  }, [edit])

  useEffect(() => {
    const prev = previousEditRef.current
    previousEditRef.current = edit
    if (!prev) return
    if (edit && edit.rowId === prev.rowId) return
    const isCauseTransient = transientCauseContinuationIdsRef.current.has(prev.rowId)
    const isRecommendedActionTransient = transientRecommendedActionContinuationIdsRef.current.has(prev.rowId)
    const isFailureModeTransient = transientFailureModeContinuationIdsRef.current.has(prev.rowId)
    const isEffectTransient = transientEffectContinuationIdsRef.current.has(prev.rowId)
    if (!isCauseTransient && !isRecommendedActionTransient && !isFailureModeTransient && !isEffectTransient) return

    const transientRow = rowsRef.current.find((row) => row.id === prev.rowId)
    if (!transientRow) return
    const effectiveTransientRow = applyPendingCellValues(transientRow)
    const shouldDelete = isCauseTransient
      ? isCauseContinuationEmpty(effectiveTransientRow)
      : isRecommendedActionTransient
        ? isRecommendedActionContinuationEmpty(effectiveTransientRow)
        : isFailureModeTransient
          ? isFailureModeContinuationEmpty(effectiveTransientRow)
          : isEffectContinuationEmpty(effectiveTransientRow)
    if (!shouldDelete) return

    transientCauseContinuationIdsRef.current.delete(prev.rowId)
    transientRecommendedActionContinuationIdsRef.current.delete(prev.rowId)
    transientFailureModeContinuationIdsRef.current.delete(prev.rowId)
    transientEffectContinuationIdsRef.current.delete(prev.rowId)
    pendingCellValuesRef.current = Object.fromEntries(
      Object.entries(pendingCellValuesRef.current).filter(([key]) => !key.startsWith(`${prev.rowId}::`))
    )
    const nextRows = reindexPfmeaRows(rowsRef.current.filter((row) => row.id !== prev.rowId))
    rowsRef.current = nextRows
    setRows(nextRows)
    setDirtyPfmeaIds((current) => current.filter((id) => id !== prev.rowId))
    void scheduleTransientRowDeletion(prev.rowId).catch((error: any) => {
      console.warn('Failed to delete empty transient PFMEA row:', error?.message ?? String(error))
    })
  }, [edit, applyPendingCellValues, scheduleTransientRowDeletion])

  const cleanupEmptyTransientRows = useCallback(async () => {
    const transientIds = new Set<string>([
      ...transientCauseContinuationIdsRef.current,
      ...transientRecommendedActionContinuationIdsRef.current,
      ...transientFailureModeContinuationIdsRef.current,
      ...transientEffectContinuationIdsRef.current,
    ])
    if (transientIds.size === 0) return rowsRef.current

    const rowsById = new Map(rowsRef.current.map((row) => [row.id, row] as const))
    const idsToDelete: string[] = []

    for (const id of transientIds) {
      const row = rowsById.get(id)
      if (!row) continue
      const effectiveRow = applyPendingCellValues(row)
      const shouldDelete = transientCauseContinuationIdsRef.current.has(id)
        ? isCauseContinuationEmpty(effectiveRow)
        : transientRecommendedActionContinuationIdsRef.current.has(id)
          ? isRecommendedActionContinuationEmpty(effectiveRow)
          : transientFailureModeContinuationIdsRef.current.has(id)
            ? isFailureModeContinuationEmpty(effectiveRow)
            : transientEffectContinuationIdsRef.current.has(id)
              ? isEffectContinuationEmpty(effectiveRow)
              : false
      if (shouldDelete) idsToDelete.push(id)
    }

    if (idsToDelete.length === 0) return rowsRef.current

    const deleteResults = await Promise.all(idsToDelete.map((id) => supabase.from('pfmea_rows').delete().eq('id', id)))
    for (const result of deleteResults) {
      if (result.error) throw result.error
    }

    const idsToDeleteSet = new Set(idsToDelete)
    transientCauseContinuationIdsRef.current = new Set(
      [...transientCauseContinuationIdsRef.current].filter((id) => !idsToDeleteSet.has(id))
    )
    transientRecommendedActionContinuationIdsRef.current = new Set(
      [...transientRecommendedActionContinuationIdsRef.current].filter((id) => !idsToDeleteSet.has(id))
    )
    transientFailureModeContinuationIdsRef.current = new Set(
      [...transientFailureModeContinuationIdsRef.current].filter((id) => !idsToDeleteSet.has(id))
    )
    transientEffectContinuationIdsRef.current = new Set(
      [...transientEffectContinuationIdsRef.current].filter((id) => !idsToDeleteSet.has(id))
    )
    pendingCellValuesRef.current = Object.fromEntries(
      Object.entries(pendingCellValuesRef.current).filter(([key]) => !idsToDelete.some((id) => key.startsWith(`${id}::`)))
    )

    const nextRows = reindexPfmeaRows(rowsRef.current.filter((row) => !idsToDeleteSet.has(row.id)))
    rowsRef.current = nextRows
    setRows(nextRows)
    setDirtyPfmeaIds((prev) => prev.filter((id) => !idsToDeleteSet.has(id)))
    setDeletedPfmeaIds((prev) => prev.filter((id) => !idsToDeleteSet.has(id)))
    setHighlightedMissingCells((prev) => prev?.filter((key) => !idsToDelete.some((id) => key.startsWith(`${id}::`))) ?? null)
    setHoveredRowId((prev) => (prev && idsToDeleteSet.has(prev) ? null : prev))
    setEdit((prev) => (prev && idsToDeleteSet.has(prev.rowId) ? null : prev))

    return nextRows
  }, [applyPendingCellValues])

  useEffect(() => {
    if (!expandedOperationId) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (target instanceof Element && target.closest('[data-pfmea-popup="true"]')) return
      if (tableWrapRef.current?.contains(target)) return
      setExpandedOperationId(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [expandedOperationId])

  async function addRow() {
    if (!canAdd || readOnly) return
    setErr('')

    try {
      // ensure we have a draft to work on (if currently on OPEN)
      const revId = await ensureDraftIfNeeded()
      const finalRev = revId ?? workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const payload = makeEmptyPfmeaPayload(draft.operation_id, finalRev)

      const res = await supabase
        .from('pfmea_rows')
        .insert([pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload])
        .select('id')
        .single()
      if (res.error) throw res.error

      if (res.data?.id) markPfmeaDirty(res.data.id)
      await loadAll()
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }

  async function deleteRow(id: string) {
    if (readOnly) return
    setConfirmDialog({
      title: 'Delete PFMEA row',
      body: 'Are you sure you want to delete this PFMEA row?',
      dangerNote: 'DATA WILL BE PERMANENTLY LOST',
      onConfirm: async () => {
        setErr('')
        try {
          const currentRow = rowsRef.current.find((row) => row.id === id)
          if (!currentRow) return true

          const opId = currentRow.operation_id || currentRow.operations?.id || null
          const rowsForOperation = rowsRef.current.filter(
            (row) => !isPlaceholderRowId(row.id) && (row.operation_id || row.operations?.id || null) === opId
          )
          const removeRowLocally = () => {
            transientCauseContinuationIdsRef.current.delete(id)
            transientRecommendedActionContinuationIdsRef.current.delete(id)
            transientFailureModeContinuationIdsRef.current.delete(id)
            transientEffectContinuationIdsRef.current.delete(id)
            pendingCellValuesRef.current = Object.fromEntries(
              Object.entries(pendingCellValuesRef.current).filter(([key]) => !key.startsWith(`${id}::`))
            )
            setRows((prev) => reindexPfmeaRows(prev.filter((row) => row.id !== id)))
            setDirtyPfmeaIds((prev) => prev.filter((x) => x !== id))
            setDeletedPfmeaIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
            setHighlightedMissingCells((prev) => prev?.filter((key) => !key.startsWith(`${id}::`)) ?? null)
            setHoveredRowId((prev) => (prev === id ? null : prev))
            setEdit((prev) => (prev?.rowId === id ? null : prev))
          }

          // Last row for a process step cannot be removed; clear only PFMEA content.
          if (rowsForOperation.length === 1) {
            await ensureDraftIfNeeded()
            const finalRev = draftRevisionIdOverride ?? project?.current_draft_revision_id ?? project?.current_open_revision_id ?? null
            if (!finalRev) throw new Error('No working revision found.')

            const clearedPatch = {
              ...makeEmptyPfmeaPayload(currentRow.operation_id, finalRev, pickPfmeaGroupIds(currentRow)),
              revision_id: currentRow.revision_id || finalRev,
              operation_id: currentRow.operation_id,
            }
            const res = await supabase
              .from('pfmea_rows')
              .update({
                failure_mode: clearedPatch.failure_mode,
                effect: clearedPatch.effect,
                severity: clearedPatch.severity,
                characteristic: clearedPatch.characteristic,
                class: clearedPatch.class,
                cause: clearedPatch.cause,
                occurrence: clearedPatch.occurrence,
                current_prevention: clearedPatch.current_prevention,
                current_detection: clearedPatch.current_detection,
                detection: clearedPatch.detection,
                rpn: clearedPatch.rpn,
                oxd: clearedPatch.oxd,
                recommended_action: clearedPatch.recommended_action,
                responsible: clearedPatch.responsible,
                target_date: clearedPatch.target_date,
                action_status: clearedPatch.action_status,
                occurrence2: clearedPatch.occurrence2,
                detection2: clearedPatch.detection2,
                rpn2: clearedPatch.rpn2,
                oxd2: clearedPatch.oxd2,
                rpn_current: clearedPatch.rpn_current,
                oxd_current: clearedPatch.oxd_current,
              })
              .eq('id', id)
            if (res.error) throw res.error

            markPfmeaDirty(id)
            setRows((prev) =>
              prev.map((row) =>
                row.id === id
                  ? ({
                      ...row,
                      failure_mode: '',
                      effect: '',
                      severity: null,
                      characteristic: '',
                      class: null,
                      cause: '',
                      occurrence: null,
                      current_prevention: '',
                      current_detection: '',
                      detection: null,
                      rpn: null,
                      oxd: null,
                      recommended_action: '',
                      responsible: '',
                      target_date: null,
                      action_status: null,
                      occurrence2: null,
                      detection2: null,
                      rpn2: null,
                      oxd2: null,
                      rpn_current: null,
                      oxd_current: null,
                    } as PfmeaRow)
                  : row
              )
            )
            return true
          }

          await ensureDraftIfNeeded()

          const res = await supabase.from('pfmea_rows').delete().eq('id', id)
          if (res.error) throw res.error

          removeRowLocally()
          return true
        } catch (e: any) {
          setErr(e?.message ?? String(e))
          return false
        }
      },
    })
  }

  function getInsertedCreatedAtForAnchor(anchorRow: PfmeaRow) {
    const opId = anchorRow.operation_id || anchorRow.operations?.id || null
    const visibleRows = tableRows.filter((item) => {
      if (isPlaceholderRowId(item.id)) return false
      return (item.operation_id || item.operations?.id || null) === opId
    })

    const anchorIndex = visibleRows.findIndex((item) => item.id === anchorRow.id)
    const currentTime = new Date(anchorRow.created_at || new Date().toISOString()).getTime()
    const nextRow = anchorIndex >= 0 ? visibleRows[anchorIndex + 1] ?? null : null
    const nextTime = nextRow ? new Date(nextRow.created_at || anchorRow.created_at || new Date().toISOString()).getTime() : Number.NaN

    if (Number.isFinite(currentTime) && Number.isFinite(nextTime) && nextTime > currentTime) {
      return new Date(currentTime + Math.max(1, Math.floor((nextTime - currentTime) / 2))).toISOString()
    }
    if (Number.isFinite(currentTime)) {
      return new Date(currentTime + 1).toISOString()
    }
    return new Date().toISOString()
  }

  function getCauseContinuationSourceRow(row: PfmeaRow) {
    const effectiveRow = applyPendingCellValues(row)
    if ((effectiveRow.effect ?? '').trim() && asInt1to10(effectiveRow.severity) != null) return effectiveRow

    const opId = effectiveRow.operation_id || effectiveRow.operations?.id || null
    const failureMode = (effectiveRow.failure_mode ?? '').trim()
    const failureModeGroupId = normalizePfmeaGroupId(effectiveRow.failure_mode_group_id)
    const failureBlockGroupId = normalizePfmeaGroupId(effectiveRow.failure_block_group_id)
    const failureBlockKey = parsePfmeaRowNo(effectiveRow.row_no)?.failureBlockKey ?? null
    const visibleRows = tableRows.filter((item) => {
      if (isPlaceholderRowId(item.id)) return false
      return (item.operation_id || item.operations?.id || null) === opId
    })

    const rowIndex = visibleRows.findIndex((item) => item.id === row.id)
    if (rowIndex < 0) return effectiveRow

    for (let i = rowIndex - 1; i >= 0; i -= 1) {
      const candidate = applyPendingCellValues(visibleRows[i])
      if (failureModeGroupId) {
        if (!samePfmeaGroupValue(candidate.failure_mode_group_id, failureModeGroupId)) break
      } else if ((candidate.failure_mode ?? '').trim() !== failureMode) {
        break
      }
      if (failureBlockGroupId) {
        if (!samePfmeaGroupValue(candidate.failure_block_group_id, failureBlockGroupId)) break
      } else if (failureBlockKey && parsePfmeaRowNo(candidate.row_no)?.failureBlockKey !== failureBlockKey) {
        break
      }
      if ((candidate.effect ?? '').trim() && asInt1to10(candidate.severity) != null) {
        return {
          ...candidate,
          cause: effectiveRow.cause,
          occurrence: effectiveRow.occurrence,
          current_prevention: effectiveRow.current_prevention,
          current_detection: effectiveRow.current_detection,
          detection: effectiveRow.detection,
        }
      }
    }

    return effectiveRow
  }

  function getRecommendedActionContinuationSourceRow(row: PfmeaRow) {
    const effectiveRow = applyPendingCellValues(row)
    const hasCurrentRiskBlock =
      !!(effectiveRow.effect ?? '').trim() &&
      asInt1to10(effectiveRow.severity) != null &&
      !!(effectiveRow.cause ?? '').trim() &&
      asInt1to10(effectiveRow.occurrence) != null &&
      !!(effectiveRow.current_prevention ?? '').trim() &&
      !!(effectiveRow.current_detection ?? '').trim() &&
      asInt1to10(effectiveRow.detection) != null

    if (hasCurrentRiskBlock) return effectiveRow

    const opId = effectiveRow.operation_id || effectiveRow.operations?.id || null
    const failureMode = (effectiveRow.failure_mode ?? '').trim()
    const failureModeGroupId = normalizePfmeaGroupId(effectiveRow.failure_mode_group_id)
    const failureBlockGroupId = normalizePfmeaGroupId(effectiveRow.failure_block_group_id)
    const actionPlanGroupId = normalizePfmeaGroupId(effectiveRow.action_plan_group_id)
    const visibleRows = tableRows.filter((item) => {
      if (isPlaceholderRowId(item.id)) return false
      return (item.operation_id || item.operations?.id || null) === opId
    })

    const rowIndex = visibleRows.findIndex((item) => item.id === row.id)
    if (rowIndex < 0) return effectiveRow

    for (let i = rowIndex - 1; i >= 0; i -= 1) {
      const candidate = applyPendingCellValues(visibleRows[i])
      if (failureModeGroupId) {
        if (!samePfmeaGroupValue(candidate.failure_mode_group_id, failureModeGroupId)) break
      } else if ((candidate.failure_mode ?? '').trim() !== failureMode) {
        break
      }
      if (failureBlockGroupId && !samePfmeaGroupValue(candidate.failure_block_group_id, failureBlockGroupId)) break
      if (actionPlanGroupId && !samePfmeaGroupValue(candidate.action_plan_group_id, actionPlanGroupId)) break

      const candidateHasCurrentRiskBlock =
        !!(candidate.effect ?? '').trim() &&
        asInt1to10(candidate.severity) != null &&
        !!(candidate.cause ?? '').trim() &&
        asInt1to10(candidate.occurrence) != null &&
        !!(candidate.current_prevention ?? '').trim() &&
        !!(candidate.current_detection ?? '').trim() &&
        asInt1to10(candidate.detection) != null

      if (candidateHasCurrentRiskBlock) {
        return {
          ...candidate,
          recommended_action: effectiveRow.recommended_action,
          responsible: effectiveRow.responsible,
          target_date: effectiveRow.target_date,
          action_status: effectiveRow.action_status,
          occurrence2: effectiveRow.occurrence2,
          detection2: effectiveRow.detection2,
        }
      }
    }

    return effectiveRow
  }

  function computePfmeaDerivedFromContext(row: PfmeaRow) {
    const effectiveRow = applyPendingCellValues(row)
    const currentRiskRow = getCauseContinuationSourceRow(effectiveRow)
    const currentRisk = calcRpn(currentRiskRow.severity, currentRiskRow.occurrence, currentRiskRow.detection)
    const residualRisk = calcRpn(currentRiskRow.severity, effectiveRow.occurrence2, effectiveRow.detection2)
    const isClosed = (effectiveRow.action_status ?? '').toUpperCase() === 'CLOSED'

    return {
      currentRisk,
      residualRisk,
      derived: {
        rpn: currentRisk.rpn ?? null,
        oxd: currentRisk.doVal ?? null,
        rpn2: residualRisk.rpn ?? null,
        oxd2: residualRisk.doVal ?? null,
        rpn_current: (isClosed ? residualRisk.rpn : currentRisk.rpn) ?? null,
        oxd_current: (isClosed ? residualRisk.doVal : currentRisk.doVal) ?? null,
      } as Pick<PfmeaRow, 'rpn' | 'oxd' | 'rpn2' | 'oxd2' | 'rpn_current' | 'oxd_current'>,
    }
  }

  function getFailureBlockSourceRowAtIndex(rowIndex: number) {
    const effectiveRow = applyPendingCellValues(tableRows[rowIndex] ?? ({} as PfmeaRow))
    if ((effectiveRow.effect ?? '').trim() && asInt1to10(effectiveRow.severity) != null) return effectiveRow

    const opId = effectiveRow.operation_id || effectiveRow.operations?.id || null
    const failureMode = (effectiveRow.failure_mode ?? '').trim()
    const failureModeGroupId = normalizePfmeaGroupId(effectiveRow.failure_mode_group_id)
    const failureBlockGroupId = normalizePfmeaGroupId(effectiveRow.failure_block_group_id)
    const failureBlockKey = parsePfmeaRowNo(effectiveRow.row_no)?.failureBlockKey ?? null
    for (let i = rowIndex - 1; i >= 0; i -= 1) {
      const candidate = applyPendingCellValues(tableRows[i] ?? ({} as PfmeaRow))
      if ((candidate.operation_id || candidate.operations?.id || null) !== opId) break
      if (failureModeGroupId) {
        if (!samePfmeaGroupValue(candidate.failure_mode_group_id, failureModeGroupId)) break
      } else if ((candidate.failure_mode ?? '').trim() !== failureMode) {
        break
      }
      if (failureBlockGroupId) {
        if (!samePfmeaGroupValue(candidate.failure_block_group_id, failureBlockGroupId)) break
      } else if (failureBlockKey && parsePfmeaRowNo(candidate.row_no)?.failureBlockKey !== failureBlockKey) {
        break
      }
      if ((candidate.effect ?? '').trim() && asInt1to10(candidate.severity) != null) return candidate
    }

    return effectiveRow
  }

  function getActionPlanBlockSourceRowAtIndex(rowIndex: number) {
    const effectiveRow = tableRows[rowIndex] ?? ({} as PfmeaRow)
    const hasCurrentRiskBlock =
      !!(effectiveRow.effect ?? '').trim() &&
      asInt1to10(effectiveRow.severity) != null &&
      !!(effectiveRow.cause ?? '').trim() &&
      asInt1to10(effectiveRow.occurrence) != null &&
      !!(effectiveRow.current_prevention ?? '').trim() &&
      !!(effectiveRow.current_detection ?? '').trim() &&
      asInt1to10(effectiveRow.detection) != null

    if (hasCurrentRiskBlock) return effectiveRow

    const opId = effectiveRow.operation_id || effectiveRow.operations?.id || null
    const failureMode = (effectiveRow.failure_mode ?? '').trim()
    const failureModeGroupId = normalizePfmeaGroupId(effectiveRow.failure_mode_group_id)
    const failureBlockGroupId = normalizePfmeaGroupId(effectiveRow.failure_block_group_id)
    for (let i = rowIndex - 1; i >= 0; i -= 1) {
      const candidate = tableRows[i]
      if ((candidate.operation_id || candidate.operations?.id || null) !== opId) break
      if (failureModeGroupId) {
        if (!samePfmeaGroupValue(candidate.failure_mode_group_id, failureModeGroupId)) break
      } else if ((candidate.failure_mode ?? '').trim() !== failureMode) {
        break
      }
      if (failureBlockGroupId && !samePfmeaGroupValue(candidate.failure_block_group_id, failureBlockGroupId)) break

      const candidateHasCurrentRiskBlock =
        !!(candidate.effect ?? '').trim() &&
        asInt1to10(candidate.severity) != null &&
        !!(candidate.cause ?? '').trim() &&
        asInt1to10(candidate.occurrence) != null &&
        !!(candidate.current_prevention ?? '').trim() &&
        !!(candidate.current_detection ?? '').trim() &&
        asInt1to10(candidate.detection) != null

      if (candidateHasCurrentRiskBlock) return candidate
    }

    return effectiveRow
  }

  async function addCauseContinuationRow(row: PfmeaRow, anchorRow: PfmeaRow = row) {
    if (readOnly || isPlaceholderRowId(row.id)) return
    setErr('')

    try {
      const effectiveRow = applyPendingCellValues(row)
      const sourceRow = getCauseContinuationSourceRow(row)
      if (!hasPfmeaTextValue(effectiveRow.cause)) {
        setEdit({ rowId: row.id, col: 'cause' })
        return
      }

      const revId = await ensureDraftIfNeeded()
      const finalRev = revId ?? workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const opId = row.operation_id || row.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(anchorRow)

      const payload = {
        ...makeEmptyPfmeaPayload(
          row.operation_id,
          finalRev,
          createPfmeaGroupIds({
            failure_mode_group_id: sourceRow.failure_mode_group_id ?? undefined,
            failure_block_group_id: sourceRow.failure_block_group_id ?? undefined,
          })
        ),
        failure_mode: sourceRow.failure_mode,
        effect: sourceRow.effect,
        severity: asInt1to10(sourceRow.severity),
        characteristic: sourceRow.characteristic,
        class: normalizeClassValue(sourceRow.class),
        created_at: insertedCreatedAt,
      }

      const insertRes = await supabase
        .from('pfmea_rows')
        .insert([pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload])
        .select('id')
        .single()
      if (insertRes.error) throw insertRes.error

      const newId = insertRes.data?.id
      if (!newId) throw new Error('Failed to create PFMEA row.')

      markPfmeaDirty(newId)
      transientCauseContinuationIdsRef.current.add(newId)
      setExpandedOperationId(opId)
      setRows((prev) => {
        const nextRow = {
          ...sourceRow,
          ...payload,
          id: newId,
          revision_id: finalRev,
          created_at: insertedCreatedAt,
          __sortIndex: anchorRow.__sortIndex,
        } as PfmeaRow
        return insertPfmeaRowAfterAnchor(prev, anchorRow.id, nextRow)
      })
      setEdit({ rowId: newId, col: 'cause' })
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }

  async function addFailureModeContinuationRow(row: PfmeaRow, anchorRow: PfmeaRow = row) {
    if (readOnly || isPlaceholderRowId(row.id)) return
    setErr('')

    try {
      const revId = await ensureDraftIfNeeded()
      const finalRev = revId ?? workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const opId = row.operation_id || row.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(anchorRow)

      const payload = {
        ...makeEmptyPfmeaPayload(row.operation_id, finalRev),
        created_at: insertedCreatedAt,
      }

      const insertRes = await supabase
        .from('pfmea_rows')
        .insert([pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload])
        .select('id')
        .single()
      if (insertRes.error) throw insertRes.error

      const newId = insertRes.data?.id
      if (!newId) throw new Error('Failed to create PFMEA row.')

      markPfmeaDirty(newId)
      transientFailureModeContinuationIdsRef.current.add(newId)
      setExpandedOperationId(opId)
      setRows((prev) => {
        const nextRow = {
          ...row,
          ...payload,
          id: newId,
          revision_id: finalRev,
          created_at: insertedCreatedAt,
          __sortIndex: anchorRow.__sortIndex,
        } as PfmeaRow
        return insertPfmeaRowAfterAnchor(prev, anchorRow.id, nextRow)
      })
      setEdit({ rowId: newId, col: 'failure_mode' })
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }

  async function addEffectContinuationRow(row: PfmeaRow, anchorRow: PfmeaRow = row) {
    if (readOnly || isPlaceholderRowId(row.id)) return
    setErr('')

    try {
      const effectiveRow = applyPendingCellValues(row)
      if (!hasFailureModeContext(effectiveRow)) {
        setEdit({ rowId: row.id, col: 'failure_mode' })
        return
      }

      const revId = await ensureDraftIfNeeded()
      const finalRev = revId ?? workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const opId = row.operation_id || row.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(anchorRow)

      const payload = {
        ...makeEmptyPfmeaPayload(
          row.operation_id,
          finalRev,
          createPfmeaGroupIds({
            failure_mode_group_id: effectiveRow.failure_mode_group_id ?? undefined,
          })
        ),
        failure_mode: effectiveRow.failure_mode,
        characteristic: effectiveRow.characteristic,
        class: normalizeClassValue(effectiveRow.class),
        created_at: insertedCreatedAt,
      }

      const insertRes = await supabase
        .from('pfmea_rows')
        .insert([pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload])
        .select('id')
        .single()
      if (insertRes.error) throw insertRes.error

      const newId = insertRes.data?.id
      if (!newId) throw new Error('Failed to create PFMEA row.')

      markPfmeaDirty(newId)
      transientEffectContinuationIdsRef.current.add(newId)
      setExpandedOperationId(opId)
      setRows((prev) => {
        const nextRow = {
          ...row,
          ...payload,
          id: newId,
          revision_id: finalRev,
          created_at: insertedCreatedAt,
          __sortIndex: anchorRow.__sortIndex,
        } as PfmeaRow
        return insertPfmeaRowAfterAnchor(prev, anchorRow.id, nextRow)
      })
      setEdit({ rowId: newId, col: 'effect' })
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }

  async function addRecommendedActionContinuationRow(row: PfmeaRow, anchorRow: PfmeaRow = row) {
    if (readOnly || isPlaceholderRowId(row.id)) return
    setErr('')

    try {
      const effectiveRow = applyPendingCellValues(row)
      const sourceRow = getRecommendedActionContinuationSourceRow(row)
      if (!hasPfmeaTextValue(effectiveRow.recommended_action)) {
        setEdit({ rowId: row.id, col: 'recommended_action' })
        return
      }

      const revId = await ensureDraftIfNeeded()
      const finalRev = revId ?? workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      const opId = row.operation_id || row.operations?.id || null
      const insertedCreatedAt = getInsertedCreatedAtForAnchor(anchorRow)

      const payload = {
        ...makeEmptyPfmeaPayload(
          row.operation_id,
          finalRev,
          createPfmeaGroupIds({
            failure_mode_group_id: sourceRow.failure_mode_group_id ?? undefined,
            failure_block_group_id: sourceRow.failure_block_group_id ?? undefined,
            action_plan_group_id: sourceRow.action_plan_group_id ?? undefined,
          })
        ),
        failure_mode: sourceRow.failure_mode,
        effect: sourceRow.effect,
        severity: asInt1to10(sourceRow.severity),
        characteristic: sourceRow.characteristic,
        class: normalizeClassValue(sourceRow.class),
        cause: sourceRow.cause,
        occurrence: asInt1to10(sourceRow.occurrence),
        current_prevention: sourceRow.current_prevention,
        current_detection: sourceRow.current_detection,
        detection: asInt1to10(sourceRow.detection),
        ...computeDerived({
          ...sourceRow,
          recommended_action: '',
          responsible: '',
          target_date: null,
          action_status: '',
          occurrence2: null,
          detection2: null,
        } as PfmeaRow),
        created_at: insertedCreatedAt,
      }

      const insertRes = await supabase
        .from('pfmea_rows')
        .insert([pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload])
        .select('id')
        .single()
      if (insertRes.error) throw insertRes.error

      const newId = insertRes.data?.id
      if (!newId) throw new Error('Failed to create PFMEA row.')

      markPfmeaDirty(newId)
      transientRecommendedActionContinuationIdsRef.current.add(newId)
      setExpandedOperationId(opId)
      setRows((prev) => {
        const nextRow = {
          ...sourceRow,
          ...payload,
          id: newId,
          revision_id: finalRev,
          created_at: insertedCreatedAt,
          __sortIndex: anchorRow.__sortIndex,
        } as PfmeaRow
        return insertPfmeaRowAfterAnchor(prev, anchorRow.id, nextRow)
      })
      setEdit({ rowId: newId, col: 'recommended_action' })
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }

  async function updateCellWithDerived(row: PfmeaRow, patch: Partial<PfmeaRow>) {
    if (readOnly) return
    setErr('')

    const task = (async () => {
      try {
      const guarded: Partial<PfmeaRow> = { ...patch }
      ;(['severity', 'occurrence', 'detection', 'occurrence2', 'detection2'] as (keyof PfmeaRow)[]).forEach((k) => {
        if (!(k in guarded)) return
        const v = (guarded as any)[k]
        if (v === null) return
        const n = asInt1to10(v)
        ;(guarded as any)[k] = n
      })
      if ('class' in guarded) {
        guarded.class = normalizeClassValue((guarded.class as string | null | undefined) ?? null)
      }

      const isPlaceholder = isPlaceholderRowId(row.id)
      if (isPlaceholder && !patchHasAnyValue(guarded)) return

      // ensure draft exists (editing is a change)
      const hadDraftBeforeEdit = !!project?.current_draft_revision_id
      const revId = await ensureDraftIfNeeded()
      const finalRev = revId ?? workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')

      let targetRow = row
      let reloadedDraftRows = false
      if (!isPlaceholder && row.revision_id !== finalRev) {
        await loadAll(finalRev)
        reloadedDraftRows = true
        const inferredRowNo = normalizePfmeaRowNo(row.row_no) ?? rowHierarchyByIdRef.current.get(row.id)?.rowLabel ?? null
        const rowForMapping = inferredRowNo && inferredRowNo !== row.row_no ? ({ ...row, row_no: inferredRowNo } as PfmeaRow) : row
        const mappedRow = findEquivalentPfmeaRow(rowsRef.current, rowForMapping)
        if (!mappedRow) throw new Error('Failed to map PFMEA row into the current draft revision.')
        targetRow = mappedRow
        pendingCellValuesRef.current = Object.fromEntries(
          Object.entries(pendingCellValuesRef.current).filter(([key]) => !key.startsWith(`${row.id}::`))
        )
        refreshPendingCellRender()
        setEdit((prev) => (prev && prev.rowId === row.id ? { ...prev, rowId: mappedRow.id } : prev))
      }

      const merged: PfmeaRow = { ...targetRow, ...(guarded as any) }
      const localPatch: Partial<PfmeaRow> = { ...guarded, ...computePfmeaDerivedFromContext(merged).derived }

      if (isPlaceholder) {
        const payload = {
          ...makeEmptyPfmeaPayload(row.operation_id, finalRev, pickPfmeaGroupIds(row)),
          ...localPatch,
        }
        const insertRes = await supabase
          .from('pfmea_rows')
          .insert([pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload])
          .select('id,created_at')
          .single()
        if (insertRes.error) throw insertRes.error
        const newId = insertRes.data?.id
        if (!newId) throw new Error('Failed to create PFMEA row.')

        const createdAt =
          ((insertRes.data as { created_at?: string | null } | null)?.created_at ?? '').trim() || new Date().toISOString()

        markPfmeaDirty(newId)
        placeholderMaterializedIdRef.current[row.id] = newId
        pendingCellValuesRef.current = Object.fromEntries(
          Object.entries(pendingCellValuesRef.current).filter(([key]) => !key.startsWith(`${row.id}::`))
        )
        refreshPendingCellRender()
        setRows((prev) => {
          if (prev.some((x) => x.id === newId)) return prev
          const nextRow = {
            ...row,
            ...makeEmptyPfmeaPayload(row.operation_id, finalRev, pickPfmeaGroupIds(row)),
            ...(localPatch as any),
            id: newId,
            revision_id: finalRev,
            created_at: createdAt,
            __sortIndex: row.__sortIndex,
          } as PfmeaRow
          return insertPfmeaRowAtSortIndex(prev, nextRow, row.__sortIndex)
        })
        setEdit((prev) => (prev && prev.rowId === row.id ? { ...prev, rowId: newId } : prev))
      } else {
        const res = await supabase
          .from('pfmea_rows')
          .update(pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(localPatch as Record<string, unknown>) : localPatch)
          .eq('id', targetRow.id)
          .eq('revision_id', finalRev)
        if (res.error) throw res.error
        if (transientCauseContinuationIdsRef.current.has(targetRow.id)) {
          const nextRow = { ...targetRow, ...(localPatch as any) } as PfmeaRow
          if (!isCauseContinuationEmpty(nextRow)) {
            transientCauseContinuationIdsRef.current.delete(targetRow.id)
          }
        }
        if (transientRecommendedActionContinuationIdsRef.current.has(targetRow.id)) {
          const nextRow = { ...targetRow, ...(localPatch as any) } as PfmeaRow
          if (!isRecommendedActionContinuationEmpty(nextRow)) {
            transientRecommendedActionContinuationIdsRef.current.delete(targetRow.id)
          }
        }
        if (transientFailureModeContinuationIdsRef.current.has(targetRow.id)) {
          const nextRow = { ...targetRow, ...(localPatch as any) } as PfmeaRow
          if (!isFailureModeContinuationEmpty(nextRow)) {
            transientFailureModeContinuationIdsRef.current.delete(targetRow.id)
          }
        }
        if (transientEffectContinuationIdsRef.current.has(targetRow.id)) {
          const nextRow = { ...targetRow, ...(localPatch as any) } as PfmeaRow
          if (!isEffectContinuationEmpty(nextRow)) {
            transientEffectContinuationIdsRef.current.delete(targetRow.id)
          }
        }
        markPfmeaDirty(targetRow.id)
        const nextRows = rowsRef.current.map((x) => (x.id === targetRow.id ? ({ ...x, ...(localPatch as any) } as PfmeaRow) : x))
        rowsRef.current = nextRows
        setRows(nextRows)
      }

      // first edit after switching OPEN -> DRAFT can remap row ids on backend
      if (reloadedDraftRows || !hadDraftBeforeEdit) await loadAll(finalRev)
      } catch (e: any) {
        setErr(e?.message ?? String(e))
      }
    })()

    pendingCellUpdatePromisesRef.current.add(task)
    try {
      await task
    } finally {
      pendingCellUpdatePromisesRef.current.delete(task)
    }
  }

  async function persistPfmeaDraftSnapshot(revisionId: string, sourceRows: PfmeaRow[]) {
    const snapshotRows = sortPfmeaRows(sourceRows)
      .filter((row) => !isPlaceholderRowId(row.id))
      .map((row) => {
        const effectiveRow = applyPendingCellValues(row)
        const derived = computePfmeaDerivedFromContext(effectiveRow).derived
        return {
          ...effectiveRow,
          ...derived,
        } as PfmeaRow
      })

    if (snapshotRows.length === 0) return snapshotRows

    const batchSize = 25
    for (let index = 0; index < snapshotRows.length; index += batchSize) {
      const batch = snapshotRows.slice(index, index + batchSize)
      const results = await Promise.all(
        batch.map((row) => {
          const patch = buildPfmeaPublishedSyncPatch(row)
          return supabase
            .from('pfmea_rows')
            .update(
              pfmeaGroupIdsSupportedRef.current === false
                ? stripPfmeaGroupIdsFromPayload(patch as Record<string, unknown>)
                : patch
            )
            .eq('id', row.id)
            .eq('revision_id', revisionId)
        })
      )

      for (const result of results) {
        if (result.error) throw result.error
      }
    }

    rowsRef.current = snapshotRows
    setRows(snapshotRows)
    return snapshotRows
  }

  async function handleSaveRevision() {
    if (saveBusy) return
    setErr('')

    if (!isDirty) {
      setShowSave(false)
      return
    }

    const desc = changeDesc.trim()
    if (!desc) {
      setErr('Change description is required.')
      return
    }

    try {
      setSaveBusy(true)
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess?.session?.user?.id
      if (!uid) throw new Error('Not authenticated.')

      const draftRevisionId =
        draftRevisionIdOverride ??
        project?.current_draft_revision_id ??
        (workingRevisionId && workingRevisionId !== project?.current_open_revision_id ? workingRevisionId : null)
      if (!draftRevisionId) throw new Error('No draft revision found.')

      await flushPendingCellUpdates()
      await flushPendingTransientDeletes()
      const cleanedRows = await cleanupEmptyTransientRows()
      const persistedRows = await persistPfmeaDraftSnapshot(draftRevisionId, cleanedRows)
      await persistPfmeaRowOrder(draftRevisionId, persistedRows)

      const { data, error } = await supabase.rpc('publish_process_module_revision', {
        p_project_id: projectId,
        p_module: 'PFMEA',
        p_change_description: desc,
        p_user_id: uid,
      })

      if (error) throw error

      let publishedRevisionId =
        typeof data === 'string'
          ? data
          : data && typeof data === 'object' && 'id' in (data as Record<string, unknown>) && typeof (data as Record<string, unknown>).id === 'string'
            ? ((data as Record<string, unknown>).id as string)
            : null

      if (!publishedRevisionId) {
        try {
          const publishedView = await loadProjectView({ syncDraftOverride: false })
          publishedRevisionId = publishedView.current_open_revision_id ?? null
        } catch {}
      }

      if (publishedRevisionId) {
        try {
          await syncPublishedPfmeaRowMetadata(publishedRevisionId, persistedRows)
        } catch (syncError: any) {
          console.warn('PFMEA published row metadata sync skipped:', syncError?.message ?? String(syncError))
        }
      }

      let revisionLabel = '0.0.0'
      try {
        const revRes = await supabase
          .from('process_module_revisions')
          .select('revision_label')
          .eq('project_id', projectId)
          .eq('module', 'PFMEA')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!revRes.error) {
          const row = (revRes.data ?? null) as { revision_label?: string | null } | null
          revisionLabel = (row?.revision_label ?? '0.0.0').toString()
        }
      } catch {}

      let historyAuthor = 'Unknown user'
      try {
        historyAuthor = currentAuthorName || 'Unknown user'
      } catch {}

      const avgRpnValue = avgRpnSummary.avg == null ? null : Math.round(avgRpnSummary.avg * 100) / 100
      const historyInsert = await supabase.from('pfmea_change_history').insert([
        {
          project_id: projectId,
          revision_label: revisionLabel || '0.0.0',
          change_description: desc,
          author_id: uid,
          author_name: historyAuthor,
          risk_count: rowsSorted.length,
          avg_rpn: avgRpnValue,
          created_at: new Date().toISOString(),
        },
      ])
      if (historyInsert.error) {
        // Optional table; keep publish successful even if custom history insert is unavailable.
        console.warn('PFMEA history insert skipped:', historyInsert.error.message)
      }

      setShowSave(false)
      setChangeDesc('')
      setDirtyPfmeaIds([])
      setDeletedPfmeaIds([])
      clearDirtyDraftPersisted()
      setDraftRevisionIdOverride(null)
      resetPfmeaEditRuntimeState()
      if (draftRevisionId && publishedRevisionId && draftRevisionId !== publishedRevisionId) {
        try {
          const cleanupDraftRes = await supabase.from('pfmea_rows').delete().eq('revision_id', draftRevisionId)
          if (cleanupDraftRes.error) throw cleanupDraftRes.error
        } catch (cleanupDraftError: any) {
          console.warn('PFMEA draft cleanup skipped:', cleanupDraftError?.message ?? String(cleanupDraftError))
        }
      }
      if (projectId && userId) {
        await supabase.from('pfmea_edit_sessions').delete().eq('project_id', projectId).eq('locked_by', userId)
      }
      setEditSession(null)
      forceRefreshExistingDraftFromOpenRef.current = false

      if (data) console.log('Published PFMEA revision id:', data)

      await loadEditSession()
      await loadAll(publishedRevisionId ?? project?.current_open_revision_id ?? null)
      await loadRevisionHistory()
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSaveBusy(false)
    }
  }

  const syncPublishedPfmeaRowMetadata = useCallback(
    async (revisionId: string, sourceRows: PfmeaRow[]) => {
      const orderedSourceRows = sortPfmeaRows(sourceRows).filter(
        (row) => !isPlaceholderRowId(row.id) && (!row.revision_id || row.revision_id === draftRevisionIdOverride || row.revision_id === workingRevisionId)
      )
      if (!revisionId || orderedSourceRows.length === 0) return

      const publishedRes = await supabase
        .from('pfmea_rows')
        .select('id,operation_id,created_at')
        .eq('revision_id', revisionId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      if (publishedRes.error) throw publishedRes.error

      const publishedRows = (publishedRes.data ?? []) as Array<{ id: string; operation_id: string; created_at?: string | null }>
      if (publishedRows.length === 0) return

      const sourceMeta = buildPfmeaCreatedAtOrder(orderedSourceRows)
      const metadataBySourceId = new Map(sourceMeta.map((item) => [item.id, item] as const))
      const updates: Array<{
        id: string
        patch: ReturnType<typeof buildPfmeaPublishedSyncPatch>
      }> = []

      if (
        publishedRows.length === orderedSourceRows.length &&
        publishedRows.every((row, index) => row.operation_id === orderedSourceRows[index]?.operation_id)
      ) {
        for (let index = 0; index < publishedRows.length; index += 1) {
          const publishedRow = publishedRows[index]
          const sourceRow = orderedSourceRows[index]
          const meta = metadataBySourceId.get(sourceRow.id)
          if (!meta) continue
          updates.push({
            id: publishedRow.id,
            patch: {
              ...buildPfmeaPublishedSyncPatch(sourceRow),
              created_at: meta.created_at,
              row_no: meta.row_no,
              failure_mode_group_id: meta.failure_mode_group_id,
              failure_block_group_id: meta.failure_block_group_id,
              action_plan_group_id: meta.action_plan_group_id,
            },
          })
        }
      } else {
        const publishedByOperation = new Map<string, Array<{ id: string; operation_id: string }>>()
        const sourceByOperation = new Map<string, PfmeaRow[]>()

        for (const row of publishedRows) {
          if (!publishedByOperation.has(row.operation_id)) publishedByOperation.set(row.operation_id, [])
          publishedByOperation.get(row.operation_id)!.push(row)
        }
        for (const row of orderedSourceRows) {
          if (!sourceByOperation.has(row.operation_id)) sourceByOperation.set(row.operation_id, [])
          sourceByOperation.get(row.operation_id)!.push(row)
        }

        for (const [operationId, publishedGroup] of publishedByOperation.entries()) {
          const sourceGroup = sourceByOperation.get(operationId) ?? []
          const count = Math.min(publishedGroup.length, sourceGroup.length)
          for (let index = 0; index < count; index += 1) {
            const publishedRow = publishedGroup[index]
            const sourceRow = sourceGroup[index]
            const meta = metadataBySourceId.get(sourceRow.id)
            if (!meta) continue
            updates.push({
              id: publishedRow.id,
              patch: {
                ...buildPfmeaPublishedSyncPatch(sourceRow),
                created_at: meta.created_at,
                row_no: meta.row_no,
                failure_mode_group_id: meta.failure_mode_group_id,
                failure_block_group_id: meta.failure_block_group_id,
                action_plan_group_id: meta.action_plan_group_id,
              },
            })
          }
        }
      }

      if (updates.length === 0) return

      const batchSize = 25
      for (let index = 0; index < updates.length; index += batchSize) {
        const batch = updates.slice(index, index + batchSize)
        const results = await Promise.all(
          batch.map((item) =>
            supabase
              .from('pfmea_rows')
              .update(
                pfmeaGroupIdsSupportedRef.current === false
                  ? stripPfmeaGroupIdsFromPayload(item.patch as Record<string, unknown>)
                  : item.patch
              )
              .eq('id', item.id)
              .eq('revision_id', revisionId)
          )
        )

        for (const result of results) {
          if (result.error) throw result.error
        }
      }
    },
    [draftRevisionIdOverride, workingRevisionId, stripPfmeaGroupIdsFromPayload]
  )

  const ensureRowForEditing = useCallback(
    async (row: PfmeaRow) => {
      if (!isPlaceholderRowId(row.id)) return row.id

      const cached = placeholderMaterializedIdRef.current[row.id]
      if (cached) return cached

      const pending = placeholderMaterializeRef.current[row.id]
      if (pending) return pending

      const task = (async () => {
        const revId = await ensureDraftIfNeeded()
        const finalRev = revId ?? workingRevisionId
        if (!finalRev) throw new Error('No working revision found.')

        const effectiveRow = applyPendingCellValues(row)
        const pendingPatch: Partial<PfmeaRow> = {}
        for (const field of PFMEA_EDITABLE_FIELDS) {
          ;(pendingPatch as any)[field] = (effectiveRow as any)[field]
        }
        ;(['severity', 'occurrence', 'detection', 'occurrence2', 'detection2'] as (keyof PfmeaRow)[]).forEach((field) => {
          if (!(field in pendingPatch)) return
          const value = (pendingPatch as any)[field]
          if (value === null) return
          ;(pendingPatch as any)[field] = asInt1to10(value)
        })
        if ('class' in pendingPatch) {
          pendingPatch.class = normalizeClassValue((pendingPatch.class as string | null | undefined) ?? null)
        }

        const merged = { ...row, ...(pendingPatch as any) } as PfmeaRow
        const payload = {
          ...makeEmptyPfmeaPayload(row.operation_id, finalRev, pickPfmeaGroupIds(row)),
          ...pendingPatch,
          ...computeDerived(merged),
        }
        const ins = await supabase
          .from('pfmea_rows')
          .insert([pfmeaGroupIdsSupportedRef.current === false ? stripPfmeaGroupIdsFromPayload(payload as Record<string, unknown>) : payload])
          .select('id,created_at')
          .single()
        if (ins.error) throw ins.error
        const newId = ins.data?.id
        if (!newId) throw new Error('Failed to create PFMEA row.')

        const createdAt = ((ins.data as { created_at?: string | null } | null)?.created_at ?? '').trim() || new Date().toISOString()

        markPfmeaDirty(newId)
        pendingCellValuesRef.current = Object.fromEntries(
          Object.entries(pendingCellValuesRef.current).filter(([key]) => !key.startsWith(`${row.id}::`))
        )
        refreshPendingCellRender()
        setRows((prev) => {
          if (prev.some((x) => x.id === newId)) return prev
          const nextRow = {
            ...row,
            ...payload,
            id: newId,
            revision_id: finalRev,
            created_at: createdAt,
            __sortIndex: row.__sortIndex,
          } as PfmeaRow
          return insertPfmeaRowAtSortIndex(prev, nextRow, row.__sortIndex)
        })
        placeholderMaterializedIdRef.current[row.id] = newId
        return newId
      })()

      placeholderMaterializeRef.current[row.id] = task
      try {
        return await task
      } finally {
        delete placeholderMaterializeRef.current[row.id]
      }
    },
    [applyPendingCellValues, ensureDraftIfNeeded, refreshPendingCellRender, workingRevisionId, markPfmeaDirty]
  )

  const startEditCell = useCallback(
    async (row: PfmeaRow, col: keyof PfmeaRow) => {
      const opId = row.operation_id || row.operations?.id || null
      if (opId) setExpandedOperationId(opId)
      if (readOnly) return
      if (isPlaceholderRowId(row.id)) {
        const cachedRowId = placeholderMaterializedIdRef.current[row.id]
        const pendingRow = placeholderMaterializeRef.current[row.id]
        if (cachedRowId || pendingRow) {
          try {
            const rowId = await ensureRowForEditing(row)
            setEdit({ rowId, col })
          } catch (e: any) {
            setErr(e?.message ?? String(e))
          }
          return
        }
        setEdit({ rowId: row.id, col })
        return
      }
      try {
        const rowId = await ensureRowForEditing(row)
        setEdit({ rowId, col })
      } catch (e: any) {
        setErr(e?.message ?? String(e))
      }
    },
    [readOnly, ensureRowForEditing]
  )

  const materializePlaceholderRowForAdd = useCallback(
    async (row: PfmeaRow) => {
      if (!isPlaceholderRowId(row.id)) return applyPendingCellValues(row)

      const effectiveRow = applyPendingCellValues(row)
      const rowId = await ensureRowForEditing(row)
      const materializedRow = rowsRef.current.find((item) => item.id === rowId)
      if (materializedRow) return materializedRow

      return {
        ...row,
        ...effectiveRow,
        id: rowId,
        revision_id: draftRevisionIdOverride ?? workingRevisionId ?? row.revision_id,
        created_at: row.created_at || new Date().toISOString(),
      } as PfmeaRow
    },
    [applyPendingCellValues, draftRevisionIdOverride, ensureRowForEditing, workingRevisionId]
  )

  const loadRevisionHistory = useCallback(async () => {
    if (!projectId) {
      setHistoryEntries([])
      return
    }

    setHistoryLoading(true)
    try {
      const customRes = await supabase
        .from('pfmea_change_history')
        .select('id,created_at,revision_label,change_description,author_name,risk_count,avg_rpn')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (!customRes.error && (customRes.data?.length ?? 0) > 0) {
        const rowsRaw = (customRes.data ?? []) as Array<{
          id?: string | null
          created_at?: string | null
          revision_label?: string | null
          change_description?: string | null
          author_name?: string | null
          risk_count?: number | null
          avg_rpn?: number | string | null
        }>

        setHistoryEntries(
          rowsRaw.map((x, idx) => ({
            id: x.id ?? `pfmea-h-db-${idx}`,
            at: x.created_at ?? new Date(0).toISOString(),
            revisionLabel: (x.revision_label ?? '0.0.0').toString(),
            author: normalizeHistoryText(x.author_name) || 'Unknown user',
            riskCount: toFiniteNumber(x.risk_count),
            avgRpn: toFiniteNumber(x.avg_rpn),
            description: x.change_description ?? '',
          }))
        )
        return
      }

      const fallbackRes = await supabase
        .from('process_module_revisions')
        .select('*')
        .eq('project_id', projectId)
        .eq('module', 'PFMEA')
        .order('created_at', { ascending: false })
        .limit(200)
      if (fallbackRes.error) throw fallbackRes.error

      const rowsRaw = (fallbackRes.data ?? []) as Array<Record<string, unknown>>
      setHistoryEntries(
        rowsRaw.map((x, idx) => ({
          id: normalizeHistoryText(x.id) || `pfmea-h-fb-${idx}`,
          at: normalizeHistoryText(x.created_at) || new Date(0).toISOString(),
          revisionLabel: normalizeHistoryText(x.revision_label) || '0.0.0',
          author: pickHistoryAuthor(x),
          riskCount: toFiniteNumber(x.risk_count),
          avgRpn: toFiniteNumber(x.avg_rpn),
          description: normalizeHistoryText(x.change_description),
        }))
      )
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setHistoryEntries([])
    } finally {
      setHistoryLoading(false)
    }
  }, [projectId])

  const openRevisionHistory = useCallback(async () => {
    setHistoryOpen(true)
    await loadRevisionHistory()
  }, [loadRevisionHistory])

  const rowsSorted = useMemo(() => {
    return sortPfmeaRows(rows)
  }, [rows])

  const persistPfmeaRowOrder = useCallback(
    async (revisionId: string, sourceRows?: PfmeaRow[]) => {
      const orderedRows = sortPfmeaRows(sourceRows ?? rowsRef.current).filter(
        (row) => !isPlaceholderRowId(row.id) && (!row.revision_id || row.revision_id === revisionId)
      )
      if (orderedRows.length === 0) return

      const updates = buildPfmeaCreatedAtOrder(orderedRows)
      const batchSize = 25

      for (let index = 0; index < updates.length; index += batchSize) {
        const batch = updates.slice(index, index + batchSize)
        const results = await Promise.all(
          batch.map((item) =>
            supabase
              .from('pfmea_rows')
              .update(
                pfmeaGroupIdsSupportedRef.current === false
                  ? { created_at: item.created_at }
                  : {
                      created_at: item.created_at,
                      row_no: item.row_no,
                      failure_mode_group_id: item.failure_mode_group_id,
                      failure_block_group_id: item.failure_block_group_id,
                      action_plan_group_id: item.action_plan_group_id,
                    }
              )
              .eq('id', item.id)
              .eq('revision_id', revisionId)
          )
        )

        for (const result of results) {
          if (result.error) throw result.error
        }
      }

      const createdAtById = new Map(updates.map((item) => [item.id, item.created_at]))
      const rowNoById = new Map(updates.map((item) => [item.id, item.row_no]))
      const groupIdsById = new Map(
        updates.map((item) => [
          item.id,
          {
            failure_mode_group_id: item.failure_mode_group_id,
            failure_block_group_id: item.failure_block_group_id,
            action_plan_group_id: item.action_plan_group_id,
          },
        ])
      )
      setRows((prev) =>
        prev.map((row) => {
          const createdAt = createdAtById.get(row.id)
          const rowNo = rowNoById.get(row.id)
          const groupIds = groupIdsById.get(row.id)
          if (
            !createdAt ||
            (row.created_at === createdAt &&
              row.row_no === rowNo &&
              row.failure_mode_group_id === groupIds?.failure_mode_group_id &&
              row.failure_block_group_id === groupIds?.failure_block_group_id &&
              row.action_plan_group_id === groupIds?.action_plan_group_id)
          ) {
            return row
          }
          return { ...row, created_at: createdAt, row_no: rowNo, ...groupIds }
        })
      )
    },
    []
  )

  const displayOps = useMemo(() => {
    const rowHitsByOperationId = new Map<string, number>()
    for (const r of rowsSorted) {
      const id = r.operation_id || r.operations?.id || ''
      if (!id) continue
      rowHitsByOperationId.set(id, (rowHitsByOperationId.get(id) ?? 0) + 1)
    }

    const byGroup = new Map<string, Operation>()
    const chooseCandidate = (candidate: Operation) => {
      const key = opGroupKeyFromOperation(candidate)
      const prev = byGroup.get(key)
      if (!prev) {
        byGroup.set(key, candidate)
        return
      }
      const prevScore = opQualityScore(prev, rowHitsByOperationId.get(prev.id) ?? 0)
      const nextScore = opQualityScore(candidate, rowHitsByOperationId.get(candidate.id) ?? 0)
      if (nextScore > prevScore) byGroup.set(key, candidate)
    }

    for (const op of ops) {
      if (op.active === false) continue
      chooseCandidate(op)
    }
    for (const r of rowsSorted) {
      const rop = r.operations
      if (!rop) continue
      chooseCandidate({
        id: rop.id,
        project_id: rop.project_id,
        operation_number: rop.operation_number,
        name: rop.name,
        machine: rop.machine,
        operation: rop.operation,
        active: rop.active,
      })
    }

    const list = [...byGroup.values()]
    list.sort((a, b) => {
      const ao = a.operation_number ?? Number.MAX_SAFE_INTEGER
      const bo = b.operation_number ?? Number.MAX_SAFE_INTEGER
      if (ao !== bo) return ao - bo
      return a.id.localeCompare(b.id)
    })
    return list
  }, [ops, rowsSorted])

  const tableRows = useMemo(() => {
    const groupedByKey = new Map<string, PfmeaRow[]>()
    for (const r of rowsSorted) {
      const keys = new Set<string>()
      const no = r.operations?.operation_number
      if (typeof no === 'number' && Number.isFinite(no)) keys.add(`no:${no}`)
      const id = r.operation_id || r.operations?.id || ''
      if (id) keys.add(`id:${id}`)
      if (keys.size === 0) keys.add(opGroupKeyFromRow(r))

      for (const key of keys) {
        if (!groupedByKey.has(key)) groupedByKey.set(key, [])
        groupedByKey.get(key)!.push(r)
      }
    }

    const out: PfmeaRow[] = []
    const emittedRowIds = new Set<string>()
    const consumedKeys = new Set<string>()
    let emittedNonPlaceholderCount = 0

    for (const op of displayOps) {
      const keys = new Set<string>([opGroupKeyFromOperation(op), `id:${op.id}`])
      const group: PfmeaRow[] = []
      const seenInGroup = new Set<string>()

      for (const key of keys) {
        const hit = groupedByKey.get(key) ?? []
        for (const row of hit) {
          if (seenInGroup.has(row.id)) continue
          seenInGroup.add(row.id)
          group.push(row)
        }
        consumedKeys.add(key)
      }

      for (const row of group) {
        if (emittedRowIds.has(row.id)) continue
        emittedRowIds.add(row.id)
        out.push(row)
        emittedNonPlaceholderCount += 1
      }

      if (group.length === 0) {
        const placeholderToken = `base:${op.id}`
        out.push(makePlaceholderRow(op, workingRevisionId, placeholderToken, emittedNonPlaceholderCount))
      }

    }

    // Safety fallback: keep remaining persisted rows not yet emitted.
    for (const [key, group] of groupedByKey.entries()) {
      if (consumedKeys.has(key)) continue
      for (const row of group) {
        if (emittedRowIds.has(row.id)) continue
        emittedRowIds.add(row.id)
        out.push(row)
        emittedNonPlaceholderCount += 1
      }
    }

    return out
  }, [displayOps, rowsSorted, workingRevisionId, expandedOperationId])

  const avgRpnSummary = useMemo(() => {
    const buckets: Record<RiskColor, number> = { green: 0, yellow: 0, orange: 0, red: 0 }
    const resolveColor = (sev: number | null, doVal: number | null): RiskColor | null => {
      if (sev == null || doVal == null) return null
      const s = clampInt(sev, 1, 10)
      const d = clampInt(doVal, 1, 100)
      if (rmMode === 'manual') {
        const hit = rmCells[cellKey(s, d)]
        if (hit) return hit
      }
      return colorFromRpn(s, d, rmRpn)
    }

    const values = rowsSorted
      .map((r) => {
        const { currentRisk } = computePfmeaDerivedFromContext(r)
        const c = resolveColor(currentRisk.sev, currentRisk.doVal)
        if (c) buckets[c] += 1
        return currentRisk.rpn
      })
      .filter((v): v is number => v != null && Number.isFinite(v))

    if (values.length === 0) {
      return {
        avg: null as number | null,
        color: null as RiskColor | null,
        count: 0,
        buckets,
      }
    }

    const avg = values.reduce((acc, x) => acc + x, 0) / values.length
    let color: RiskColor = 'red'
    if (avg <= rmRpn.greenMax) color = 'green'
    else if (avg <= rmRpn.yellowMax) color = 'yellow'
    else if (avg <= rmRpn.orangeMax) color = 'orange'

    return { avg, color, count: values.length, buckets }
  }, [rowsSorted, tableRows, rmMode, rmCells, rmRpn])

  const exportExcelReport = useCallback(() => {
    try {
      const summaryRows: Array<[string, ExcelScalar]> = [
        ['Organization', organizationName || '-'],
        ['Process', project?.name ?? '-'],
        ['Status', project?.status ?? '-'],
        ['Working revision', workingRevisionLabel ?? '-'],
        ['Operations', ops.length],
        ['PFMEA rows', rowsSorted.length],
        ['Avarage RPN', avgRpnSummary.avg == null ? '-' : Math.round(avgRpnSummary.avg)],
        ['Actions must be defined', avgRpnSummary.buckets.red],
        ['Action plan required', avgRpnSummary.buckets.orange],
        ['Actions recommended', avgRpnSummary.buckets.yellow],
        ['Acceptable risk', avgRpnSummary.buckets.green],
      ]

      const headers = [
        'ID#',
        'STATION',
        'OPERATION',
        'PROCESS STEP',
        'FAILURE MODE',
        'CHARACTERISTIC',
        'CLASS',
        'EFFECT',
        'SEV',
        'CAUSE',
        'OCC',
        'CURRENT CONTROLS (PREV)',
        'CURRENT CONTROLS (DET)',
        'DET',
        'RPN',
        'RECOMMENDED ACTION',
        'RESPONSIBLE',
        'TARGET DATE',
        'ACTION STATUS',
        'OCC (AFTER)',
        'DET (AFTER)',
        'RPN (AFTER)',
      ]

      const dataRows = rowsSorted.map((r) => {
        const { currentRisk, residualRisk } = computePfmeaDerivedFromContext(r)
        return [
          r.operations?.operation_number ?? '',
          r.operations?.machine ?? '',
          r.operations?.operation ?? '',
          r.operations?.name ?? '',
          r.failure_mode ?? '',
          r.characteristic ?? '',
          normalizeClassValue(r.class) ?? '',
          r.effect ?? '',
          asInt1to10(r.severity) ?? '',
          r.cause ?? '',
          asInt1to10(r.occurrence) ?? '',
          r.current_prevention ?? '',
          r.current_detection ?? '',
          asInt1to10(r.detection) ?? '',
          currentRisk.rpn ?? '',
          r.recommended_action ?? '',
          r.responsible ?? '',
          r.target_date ?? '',
          r.action_status ?? '',
          asInt1to10(r.occurrence2) ?? '',
          asInt1to10(r.detection2) ?? '',
          residualRisk.rpn ?? '',
        ] as ExcelScalar[]
      })

      const nowIso = new Date().toISOString()
      const xml = buildExcelReportXml({
        sheetName: 'PFMEA',
        title: `PFMEA report - ${project?.name ?? 'Process'}`,
        generatedAtIso: nowIso,
        summaryRows,
        headers,
        dataRows,
      })

      const stamp = nowIso.slice(0, 19).replace(/[:T]/g, '-')
      const processPart = sanitizeFileNamePart(project?.name ?? 'PFMEA')
      const fileName = `${processPart}_PFMEA_Report_${stamp}.xls`

      const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }, [organizationName, project?.name, project?.status, workingRevisionLabel, ops.length, rowsSorted, tableRows, avgRpnSummary])

  const tableRowsMemo = useRef<PfmeaRow[]>([])
  useEffect(() => {
    tableRowsMemo.current = tableRows
  }, [tableRows])

  const rowHierarchy = useMemo(() => buildPfmeaHierarchy(tableRows), [tableRows])

  const rowHierarchyById = useMemo(() => {
    const out = new Map<string, PfmeaRowHierarchy>()
    tableRows.forEach((row, index) => {
      const item = rowHierarchy[index]
      if (item) out.set(row.id, item)
    })
    return out
  }, [rowHierarchy, tableRows])

  useEffect(() => {
    rowHierarchyByIdRef.current = rowHierarchyById
  }, [rowHierarchyById])

  const colOrder = useMemo<(keyof PfmeaRow)[]>(() => {
    const order: Array<keyof typeof PFMEA_EDITABLE_COLUMN_VISIBILITY> = [
      'failure_mode',
      'characteristic',
      'class',
      'effect',
      'severity',
      'cause',
      'occurrence',
      'current_prevention',
      'current_detection',
      'detection',
      'recommended_action',
      'responsible',
      'target_date',
      'action_status',
      'occurrence2',
      'detection2',
    ]
    return order.filter((key) => isColumnVisible(PFMEA_EDITABLE_COLUMN_VISIBILITY[key])) as (keyof PfmeaRow)[]
  }, [isColumnVisible])

  function nextCell(rowIndex: number, colIdx: number) {
    if (colOrder.length === 0) return { r: rowIndex, c: 0 }
    let c = colIdx + 1
    let r = rowIndex
    if (c >= colOrder.length) {
      c = 0
      r = Math.min(rowIndex + 1, tableRowsMemo.current.length - 1)
    }
    return { r, c }
  }
  function prevCell(rowIndex: number, colIdx: number) {
    if (colOrder.length === 0) return { r: rowIndex, c: 0 }
    let c = colIdx - 1
    let r = rowIndex
    if (c < 0) {
      c = colOrder.length - 1
      r = Math.max(rowIndex - 1, 0)
    }
    return { r, c }
  }

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent<any>, rowIndex: number, colIdx: number, allowEnterNewline: boolean) => {
      if (e.key === 'Enter' && allowEnterNewline) return

      if (e.key === 'Tab') {
        e.preventDefault()
        if (colOrder.length === 0) return
        const pos = e.shiftKey ? prevCell(rowIndex, colIdx) : nextCell(rowIndex, colIdx)
        const nextRow = tableRowsMemo.current[pos.r]
        const nextCol = colOrder[pos.c]
        if (!nextCol) return
        if (!nextRow) return
        void startEditCell(nextRow, nextCol)
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        if (edit) clearPendingCellValue(edit.rowId, edit.col)
        setEdit(null)
        return
      }
    },
    [colOrder, startEditCell, edit, clearPendingCellValue]
  )

  // ROWSPAN MAP: scalanie dla 4 pierwszych kolumn
  const mergeInfo = useMemo(() => {
    const spans = tableRows.map(() => ({ span: 0, end: 0 }))

    const keyOf = (r: PfmeaRow) => {
      const opKey = r.operation_id ?? r.operations?.id ?? ''
      const opNo = r.operations?.operation_number ?? ''
      const station = r.operations?.machine ?? ''
      const operationName = r.operations?.operation ?? ''
      const step = r.operations?.name ?? ''
      return `${opKey}|${opNo}|${station}|${operationName}|${step}`
    }

    let i = 0
    while (i < tableRows.length) {
      const k = keyOf(tableRows[i])
      let j = i + 1
      while (j < tableRows.length && keyOf(tableRows[j]) === k) j++

      const runLen = j - i
      for (let k = i; k < j; k += 1) spans[k] = { span: k === i ? runLen : 0, end: j - 1 }
      i = j
    }

    return spans
  }, [tableRows])

  const failureModeMergeInfo = useMemo(() => {
    return buildPfmeaBlockMergeInfoByHierarchy(tableRows, rowHierarchy, (item) => item.failureModeKey)
  }, [rowHierarchy, tableRows])

  const failureBlockMergeInfo = useMemo(() => {
    return buildPfmeaBlockMergeInfoByHierarchy(tableRows, rowHierarchy, (item) => item.failureBlockKey)
  }, [rowHierarchy, tableRows])

  const actionPlanBlockMergeInfo = useMemo(() => {
    return buildPfmeaBlockMergeInfoByHierarchy(tableRows, rowHierarchy, (item) => item.causeBlockKey)
  }, [rowHierarchy, tableRows])

  function resolveBlockEndAnchorRow(rowIndex: number, mergeInfo: Array<{ span: number; end: number }>) {
    const endIndex = mergeInfo[rowIndex]?.end ?? rowIndex
    return tableRows[endIndex] ?? tableRows[rowIndex] ?? null
  }

  const visibleColumnDefs = useMemo(() => PFMEA_COLUMNS.filter((col) => isColumnVisible(col.id)), [isColumnVisible])
  const widthOf = useCallback(
    (id: PfmeaColumnId) => `${PFMEA_COLUMNS_BY_ID[id]?.width ?? 120}px`,
    []
  )
  const visibleTableWidth = useMemo(
    () => visibleColumnDefs.reduce((sum, col) => sum + col.width, 0),
    [visibleColumnDefs]
  )

  if (!projectId) {
    return (
      <div style={{ padding: 18 }}>
        <h1 style={{ margin: '10px 0 4px' }}>PFMEA</h1>
        <div style={{ color: 'crimson', marginTop: 10, fontWeight: 800 }}>Missing project id in URL.</div>
      </div>
    )
  }

  const frame: React.CSSProperties = { width: '94%', marginLeft: 'auto', marginRight: 'auto' }
  const card: React.CSSProperties = {
    background: SURFACE_BG,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    borderRadius: SURFACE_RADIUS,
    boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: SURFACE_TEXT,
  }
  const heroCard: React.CSSProperties = {
    ...card,
  }
  const titleStyle: React.CSSProperties = { fontSize: 28, fontWeight: 600, letterSpacing: -0.3, color: SURFACE_TEXT }
  const subtitleStyle: React.CSSProperties = { marginTop: 4, fontSize: 13.5, color: 'rgba(255,255,255,0.78)' }
  const summaryTile: React.CSSProperties = {
    minHeight: 82,
    padding: '10px 12px',
    borderRadius: SURFACE_RADIUS,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    textAlign: 'center',
  }
  const summaryValue: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 800,
    lineHeight: 1,
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 18, position: 'relative', overflow: 'hidden', background: '#171f33' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: "url('/home-hero-bg.svg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(101, 69, 46, 0.58), rgba(23, 31, 51, 0.86))',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
      <style jsx global>{`
        .pfmeaTable ::selection,
        .pfmeaTable .pfmeaEditor::selection {
          background: rgba(148, 163, 184, 0.38);
          color: #f8fafc;
        }

        .pfmeaTable ::-moz-selection,
        .pfmeaTable .pfmeaEditor::-moz-selection {
          background: rgba(148, 163, 184, 0.38);
          color: #f8fafc;
        }

        .pfmeaTd.rpnCell::selection {
          background: #fafafa;
          color: #111827;
        }

        .pfmeaTd.rpnCell::-moz-selection {
          background: #fafafa;
          color: #111827;
        }

        .pfmeaTable .pfmeaEditor,
        .pfmeaTable .pfmeaEditor:focus {
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          width: 100% !important;
          font: inherit !important;
          color: inherit !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        .pfmeaTable textarea.pfmeaEditor {
          white-space: pre-wrap !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          resize: none !important;
          overflow: hidden !important;
          min-height: 18px !important;
        }

        .pfmeaTable input.pfmeaEditor[type='date'] {
          -webkit-appearance: none !important;
          appearance: none !important;
        }

        .pfmeaTable select.pfmeaEditor {
          -webkit-appearance: none !important;
          appearance: none !important;
        }

        .pfmeaTd {
          padding: 10px 10px !important;
          vertical-align: middle;
          background: rgba(255,255,255,0.03);
          color: #e1e5ec;
          text-align: center;
          overflow: hidden;
          position: relative;
          font-weight: 500;
          font-size: 16px;
          line-height: 1.25;
          border: 0 !important;
        }

        .pfmeaRow:not(:last-child) .pfmeaTd {
          border-bottom: 1px solid rgba(255,255,255,0.14) !important;
        }

        .pfmeaTd {
          border-right: 1px solid rgba(255,255,255,0.14) !important;
        }
        .pfmeaRow .pfmeaTd:last-child {
          border-right: 0 !important;
        }

        .pfmeaRow.groupStart .pfmeaTd {
          border-top: 1px solid rgba(255,255,255,0.14) !important;
        }

        .pfmeaTd.editable:hover {
          box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.45);
          border-radius: 0;
        }
        .pfmeaRow.rowHover .pfmeaTd.editable:focus-within {
          box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.45);
          border-radius: 0;
        }
        .pfmeaTd.flashMissing {
          box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.9) !important;
          border-radius: 0;
        }

        .pfmeaTd.gray {
          background: rgba(255,255,255,0.05);
          color: #e1e5ec;
        }

        .pfmeaTd.center {
          text-align: center;
        }

        .pfmeaTd.singleLine {
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .pfmeaTd.multiLine {
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .pfmeaTd.scaleSelectCell {
          overflow: visible !important;
          position: relative;
          white-space: normal !important;
        }
        .pfmeaInlineAddBtn {
          position: static;
          flex: 0 0 auto;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          border: 1px solid rgba(96, 165, 250, 0.75);
          background: rgba(59, 130, 246, 0.3);
          color: #ffffff;
          font-size: 16px;
          font-weight: 700;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          opacity: 1;
          pointer-events: auto;
          z-index: 3;
          transition: background 120ms ease, border-color 120ms ease;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.22);
        }
        .pfmeaInlineAddBtn:hover {
          background: rgba(59, 130, 246, 0.26);
        }
        .pfmeaInlineAddBtn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: rgba(148, 163, 184, 0.22);
          border-color: rgba(148, 163, 184, 0.45);
          color: rgba(255,255,255,0.82);
        }
        .pfmeaTd.scaleValue {
          font-size: 16px !important;
          font-weight: 700 !important;
          color: #d9a86c !important;
          vertical-align: middle !important;
        }

        .trashBtn {
          height: 29px;
          width: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255,255,255,0.08);
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease, transform 0.06s ease;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .trashBtn:hover {
          background: rgba(239, 68, 68, 0.18);
          border-color: rgba(239, 68, 68, 0.4);
        }
        .trashBtn:active {
          transform: translateY(1px);
        }
        .trashIcon {
          width: 16px;
          height: 16px;
          color: rgba(255, 255, 255, 0.72);
        }
        .trashBtn:hover .trashIcon {
          color: rgba(239, 68, 68, 0.95);
        }

        .rf-button {
          background: rgba(255,255,255,0.08);
          color: ${SURFACE_TEXT};
          font-family: inherit;
          font-weight: 650;
          border: 1px solid rgba(255,255,255,0.18);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .rf-button:hover {
          background: rgba(59,130,246,0.18) !important;
          border-color: rgba(96,165,250,0.45) !important;
          box-shadow: 0 10px 24px rgba(37,99,235,0.18) !important;
        }
        .rf-button:disabled {
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.35);
          cursor: not-allowed;
        }
      `}</style>

      {/* Summary */}
      <div style={{ ...frame, marginTop: 20 }}>
        <div style={{ ...heroCard, padding: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 360px', maxWidth: 520 }}>
              <div style={titleStyle}>PFMEA</div>
              <div style={subtitleStyle}>Analyze process risks and manage the PFMEA revision for the selected process.</div>
            </div>
            <div
              style={{
                width: '100%',
                maxWidth: 1180,
                marginLeft: 'auto',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.5fr) repeat(8, minmax(0, 1fr))',
                gap: 10,
                alignSelf: 'flex-start',
              }}
            >
            <div
              style={{
                ...summaryTile,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.22)',
              }}
            >
              <div style={{ fontSize: 12, color: '#f8fafc' }}>Process</div>
              <div
                style={{
                  ...summaryValue,
                  color: '#f8fafc',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {project?.name ?? '-'}
              </div>
            </div>
            <div
              style={{
                ...summaryTile,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.22)',
              }}
            >
              <div style={{ fontSize: 12, color: '#f8fafc' }}>Revision</div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{pfmeaRevisionNumberFromLabel(workingRevisionLabel)}</div>
            </div>
            <div
              style={{
                ...summaryTile,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.22)',
              }}
            >
              <div style={{ fontSize: 12, color: '#f8fafc' }}>Operations</div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{ops.length}</div>
            </div>
            <div
              style={{
                ...summaryTile,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.22)',
              }}
            >
              <div style={{ fontSize: 12, color: '#f8fafc' }}>PFMEA rows</div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{rowsSorted.length}</div>
            </div>
            <div
              style={{
                ...summaryTile,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.22)',
              }}
            >
              <div style={{ fontSize: 12, color: '#f8fafc' }}>Avarage RPN</div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>
                {avgRpnSummary.avg == null ? '-' : Math.round(avgRpnSummary.avg)}
              </div>
            </div>

            <div
              style={{
                ...summaryTile,
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.35)',
              }}
            >
              <div style={{ fontSize: 12, color: '#f8fafc' }}>Actions must be defined</div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{avgRpnSummary.buckets.red}</div>
            </div>

            <div
              style={{
                ...summaryTile,
                background: 'rgba(251,146,60,0.18)',
                border: '1px solid rgba(251,146,60,0.45)',
              }}
            >
              <div style={{ fontSize: 12, color: '#f8fafc' }}>
                Action plan required
              </div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{avgRpnSummary.buckets.orange}</div>
            </div>

            <div
              style={{
                ...summaryTile,
                background: 'rgba(250,204,21,0.22)',
                border: '1px solid rgba(250,204,21,0.55)',
              }}
            >
              <div style={{ fontSize: 12, color: '#f8fafc' }}>
                Actions recommended
              </div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{avgRpnSummary.buckets.yellow}</div>
            </div>

            <div
              style={{
                ...summaryTile,
                background: 'rgba(34,197,94,0.18)',
                border: '1px solid rgba(34,197,94,0.45)',
              }}
            >
              <div style={{ fontSize: 12, color: '#f8fafc' }}>Acceptable risk</div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{avgRpnSummary.buckets.green}</div>
            </div>
            </div>
          </div>
        </div>
      </div>
      {/* Save Revision Modal */}
      {showSave && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 80,
          }}
          onClick={() => (saveBusy ? null : setShowSave(false))}
        >
          <div
            style={{
              width: 560,
              maxWidth: '92vw',
              background: SURFACE_PANEL_BG,
              borderRadius: SURFACE_RADIUS,
              border: `1px solid ${SURFACE_BORDER}`,
              boxShadow: '0 16px 36px rgba(0,0,0,0.2)',
              padding: 20,
              color: SURFACE_TEXT,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>Save PFMEA</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 12 }}>
              Describe what you changed.
            </div>
            <textarea
              autoFocus
              value={changeDesc}
              onChange={(e) => setChangeDesc(e.target.value)}
              placeholder="Describe changes (required)"
              style={{
                width: '100%',
                minHeight: 90,
                borderRadius: SURFACE_RADIUS,
                border: `1px solid ${SURFACE_BORDER}`,
                padding: '10px 12px',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: 14,
                background: SURFACE_BG,
                color: SURFACE_TEXT,
              }}
            />
            <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 6 }}>
              Next revision: <b>{nextPfmeaRevisionLabel(workingRevisionLabel)}</b>
            </div>
            <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 6 }}>
              Author: <b>{currentAuthorName}</b>
            </div>
            <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 14 }}>
              Current PFMEA: <b>{rowsSorted.length}</b> risks
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => (saveBusy ? null : setShowSave(false))}
                disabled={saveBusy}
                style={{ ...actionBtn, height: 28, padding: '0 12px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRevision}
                disabled={saveBusy || !isDirty || !changeDesc.trim() || readOnly}
                style={{ ...actionBtn, height: 28, padding: '0 12px' }}
              >
                {saveBusy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 80,
          }}
          onClick={() => (confirmBusy ? null : setConfirmDialog(null))}
        >
          <div
            style={{
              width: 520,
              maxWidth: '92vw',
              background: SURFACE_PANEL_BG,
              borderRadius: SURFACE_RADIUS,
              border: `1px solid ${SURFACE_BORDER}`,
              boxShadow: '0 16px 36px rgba(0,0,0,0.2)',
              padding: 20,
              color: SURFACE_TEXT,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>{confirmDialog.title}</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 10 }}>{confirmDialog.body}</div>
            {confirmDialog.dangerNote ? (
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: '#ef4444', marginBottom: 16 }}>
                {confirmDialog.dangerNote}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => (confirmBusy ? null : setConfirmDialog(null))}
                disabled={confirmBusy}
                style={{ ...actionBtn, height: 28, padding: '0 12px' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (confirmBusy) return
                  setConfirmBusy(true)
                  try {
                    const shouldClose = await confirmDialog.onConfirm()
                    if (shouldClose !== false) setConfirmDialog(null)
                  } catch (e: any) {
                    setErr(e?.message ?? String(e))
                  } finally {
                    setConfirmBusy(false)
                  }
                }}
                disabled={confirmBusy}
                style={{ ...actionBtn, height: 28, padding: '0 12px' }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 80,
          }}
          onClick={() => setHistoryOpen(false)}
        >
          <div
            style={{
              width: 920,
              maxWidth: '96vw',
              maxHeight: '80vh',
              overflow: 'auto',
              background: SURFACE_PANEL_BG,
              borderRadius: SURFACE_RADIUS,
              border: `1px solid ${SURFACE_BORDER}`,
              boxShadow: '0 16px 36px rgba(0,0,0,0.2)',
              padding: 20,
              color: SURFACE_TEXT,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>PFMEA revision history</div>
            {historyLoading ? (
              <div style={{ fontSize: 14, color: SURFACE_MUTED, padding: '10px 0' }}>Loading history...</div>
            ) : historyEntries.length === 0 ? (
              <div style={{ fontSize: 14, color: SURFACE_MUTED, padding: '10px 0' }}>No saved history yet.</div>
            ) : (
              <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 260 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: SURFACE_RADIUS }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>
                        Revision
                      </th>
                      <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>
                        Date
                      </th>
                      <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>
                        Author
                      </th>
                      <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>
                        Description
                      </th>
                      <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>
                        Risks
                      </th>
                      <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>
                        Average RPN
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyEntries.map((h) => (
                      <tr key={h.id}>
                        <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 15, color: SURFACE_TEXT, borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700 }}>
                          {pfmeaRevisionNumberFromLabel(h.revisionLabel)}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          {new Date(h.at).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          {h.author}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 15, color: SURFACE_TEXT, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          {h.description}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          {h.riskCount == null ? '-' : Math.round(h.riskCount)}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          {h.avgRpn == null ? '-' : Number.isInteger(h.avgRpn) ? String(h.avgRpn) : h.avgRpn.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={() => setHistoryOpen(false)} style={{ ...pillBtn, height: 28 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ ...frame, marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/projects" className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }}>
              Project
            </Link>
            <Link href={`/pfd?project=${projectId}`} className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }}>
              PFD
            </Link>
            <Link href={`/pcp?project=${projectId}`} className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }}>
              PCP
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              className="rf-button"
              onClick={() => {
                if (isEditOwner) {
                  setConfirmDialog({
                    title: 'Discard draft and close session',
                    body: 'Are you sure? All unsaved draft PFMEA changes will be permanently lost.',
                    dangerNote: 'DATA WILL BE PERMANENTLY LOST',
                    onConfirm: async () => {
                      await discardDraftAndCloseSession()
                      return true
                    },
                  })
                  return
                }
                void startEditSession()
              }}
              disabled={sessionBusy || isObsolete || (!isEditOwner && isLockedByOther && !isChampion)}
              style={{ ...actionBtn, padding: '8px 12px', height: 29, cursor: 'pointer' }}
            >
              {sessionBusy
                ? 'Please wait...'
                : isEditOwner
                  ? 'Discard draft'
                  : isLockedByOther
                    ? isChampion
                      ? 'Take over PFMEA'
                      : 'PFMEA locked'
                    : 'Edit PFMEA'}
            </button>
            {isEditOwner ? (
              <button
                className="rf-button"
                onClick={() => setShowSave(true)}
                disabled={!isDirty || readOnly}
                style={{
                  ...actionBtn,
                  padding: '8px 12px',
                  height: 29,
                  cursor: !isDirty || readOnly ? 'not-allowed' : 'pointer',
                  opacity: !isDirty || readOnly ? 0.45 : 1,
                  borderColor: isDirty && !readOnly ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.18)',
                }}
              >
                Save
              </button>
            ) : null}
            <button className="rf-button" onClick={openRevisionHistory} style={{ ...actionBtn, padding: '8px 12px', height: 29, cursor: 'pointer' }}>
              Revision History
            </button>
            <button className="rf-button" onClick={exportExcelReport} style={{ ...actionBtn, padding: '8px 12px', height: 29, cursor: 'pointer' }}>
              Export Excel
            </button>
            <button
              onClick={() => setColumnFiltersOpen((v) => !v)}
              className="rf-button"
              style={{ ...actionBtn, padding: '8px 12px', height: 29 }}
            >
              {columnFiltersOpen ? 'Hide columns' : 'Set columns'}
            </button>
          </div>
        </div>

        {columnFiltersOpen && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {PFMEA_COLUMN_FILTER_GROUPS.map((group) => (
                <div key={group.title} style={{ ...card, padding: '8px 12px', flex: 1, minWidth: 260 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: SURFACE_MUTED }}>{group.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => uncheckColumnGroup(group.ids)}
                        className="rf-button"
                        style={{ padding: '2px 8px', borderRadius: 999, border: `1px solid ${SURFACE_BORDER}`, fontSize: 11 }}
                      >
                        Uncheck all
                      </button>
                      <button
                        onClick={() => clearColumnGroup(group.ids)}
                        className="rf-button"
                        style={{ padding: '2px 8px', borderRadius: 999, border: `1px solid ${SURFACE_BORDER}`, fontSize: 11 }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {group.ids.map((id) => {
                      const col = PFMEA_COLUMNS_BY_ID[id]
                      const checked = isColumnVisible(id)
                      return (
                        <label
                          key={id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            padding: '4px 8px',
                            borderRadius: 999,
                            border: `1px solid ${SURFACE_BORDER}`,
                            background: checked ? SURFACE_BG_STRONG : SURFACE_BG,
                            color: SURFACE_TEXT,
                          }}
                        >
                          <input type="checkbox" checked={checked} onChange={(e) => toggleColumnVisibility(id, e.target.checked)} />
                          {col.label}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={tableWrapRef} style={{ ...card, padding: 0, borderRadius: SURFACE_RADIUS, overflow: 'visible' }}>
          <div className="pfmeaTable" style={{ maxHeight: 'calc(100vh - 280px)', overflowX: 'auto', overflowY: 'visible' }}>
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
              <colgroup>
                {visibleColumnDefs.map((col) => (
                  <col key={col.id} style={{ width: widthOf(col.id) }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {isColumnVisible('id') ? <Th w={widthOf('id')}>ID#</Th> : null}
                  {isColumnVisible('station') ? <Th w={widthOf('station')}>STATION</Th> : null}
                  {isColumnVisible('operation') ? <Th w={widthOf('operation')}>OPERATION</Th> : null}
                  {isColumnVisible('process_step') ? <Th w={widthOf('process_step')}>PROCESS STEP</Th> : null}
                  {isColumnVisible('row_no') ? <Th w={widthOf('row_no')}>ROW#</Th> : null}

                  {isColumnVisible('failure_mode') ? <Th w={widthOf('failure_mode')}>FAILURE MODE</Th> : null}
                  {isColumnVisible('characteristic') ? <Th w={widthOf('characteristic')}>CHARACTERISTIC</Th> : null}
                  {isColumnVisible('class') ? <Th w={widthOf('class')}>CLASS</Th> : null}
                  {isColumnVisible('effect') ? <Th w={widthOf('effect')}>EFFECT</Th> : null}
                  {isColumnVisible('sev') ? <Th w={widthOf('sev')}>SEV</Th> : null}
                  {isColumnVisible('cause') ? <Th w={widthOf('cause')}>CAUSE</Th> : null}
                  {isColumnVisible('occ') ? <Th w={widthOf('occ')}>OCC</Th> : null}

                  {isColumnVisible('current_prev') ? <Th w={widthOf('current_prev')}>CURRENT CONTROLS (PREV)</Th> : null}
                  {isColumnVisible('current_det') ? <Th w={widthOf('current_det')}>CURRENT CONTROLS (DET)</Th> : null}
                  {isColumnVisible('det') ? <Th w={widthOf('det')}>DET</Th> : null}

                  {isColumnVisible('rpn') ? <Th w={widthOf('rpn')}>RPN</Th> : null}

                  {isColumnVisible('recommended_action') ? <Th w={widthOf('recommended_action')}>RECOMMENDED ACTION</Th> : null}
                  {isColumnVisible('responsible') ? <Th w={widthOf('responsible')}>RESPONSIBLE</Th> : null}
                  {isColumnVisible('target_date') ? <Th w={widthOf('target_date')}>TARGET DATE</Th> : null}
                  {isColumnVisible('action_status') ? <Th w={widthOf('action_status')}>ACTION STATUS</Th> : null}

                  {isColumnVisible('o2') ? <Th w={widthOf('o2')}><AfterHeader prefix="OCC" /></Th> : null}
                  {isColumnVisible('d2') ? <Th w={widthOf('d2')}><AfterHeader prefix="DET" /></Th> : null}
                  {isColumnVisible('rpn2') ? <Th w={widthOf('rpn2')}><AfterHeader prefix="RPN" /></Th> : null}

                  {isColumnVisible('delete') ? <Th w={widthOf('delete')}></Th> : null}
                </tr>
              </thead>

              <tbody>
                {tableRows.map((r, rowIndex) => {
                  const opNo = r.operations?.operation_number ?? null
                  const station = r.operations?.machine ?? ''
                  const operationName = r.operations?.operation ?? ''
                  const step = r.operations?.name ?? ''
                  const isPlaceholder = isPlaceholderRowId(r.id)

                  const { currentRisk: a1, residualRisk: a2 } = computePfmeaDerivedFromContext(r)

                  const risk1 = getRiskColorFor(a1.sev, a1.doVal)
                  const risk2 = getRiskColorFor(a2.sev, a2.doVal)
                  const findMergeOwnerRow = (mergeInfo: Array<{ span: number; end: number }>) => {
                    for (let i = rowIndex; i >= 0; i -= 1) {
                      const item = mergeInfo[i]
                      if ((item?.span ?? 0) > 0 && (item?.end ?? -1) >= rowIndex) return tableRows[i] ?? r
                    }
                    return r
                  }
                  const failureModeOwnerRow = findMergeOwnerRow(failureModeMergeInfo)
                  const failureBlockOwnerRow = findMergeOwnerRow(failureBlockMergeInfo)
                  const actionPlanOwnerRow = findMergeOwnerRow(actionPlanBlockMergeInfo)
                  const effectiveCurrentRow = applyPendingCellValues(r)
                  const canAddFailureModeRow = hasPfmeaTextValue(applyPendingCellValues(failureModeOwnerRow).failure_mode)
                  const canAddEffectRow = hasPfmeaTextValue(applyPendingCellValues(failureBlockOwnerRow).effect)
                  const canAddCauseRow = hasPfmeaTextValue(applyPendingCellValues(actionPlanOwnerRow).cause)
                  const canAddRecommendedActionRow = hasPfmeaTextValue(effectiveCurrentRow.recommended_action)
                  const highlightKey = (rowId: string, col: keyof PfmeaRow) => `${rowId}::${String(col)}`
                  const ownerRowForColumn = (col: keyof PfmeaRow) => {
                    switch (col) {
                      case 'failure_mode':
                      case 'characteristic':
                      case 'class':
                        return failureModeOwnerRow
                      case 'effect':
                      case 'severity':
                        return failureBlockOwnerRow
                      case 'cause':
                      case 'occurrence':
                      case 'current_prevention':
                      case 'current_detection':
                      case 'detection':
                        return actionPlanOwnerRow
                      default:
                        return latestRowForHighlights
                    }
                  }
                      const latestRowForHighlights = applyPendingCellValues(rowsRef.current.find((rowItem) => rowItem.id === r.id) ?? r)
                      const effectiveFailureModeOwnerRow = applyPendingCellValues(failureModeOwnerRow)
                      const effectiveFailureBlockOwnerRow = applyPendingCellValues(failureBlockOwnerRow)
                      const effectiveActionPlanOwnerRow = applyPendingCellValues(actionPlanOwnerRow)
                      const isMissingHighlighted = (col: keyof PfmeaRow) => highlightedMissingCells?.includes(highlightKey(r.id, col)) ?? false
                  const runActionPlanStart = (targetCol: keyof PfmeaRow) => {
                    window.setTimeout(() => {
                      const latestRow = latestRowForHighlights
                      const contextualActionRow = getRecommendedActionContinuationSourceRow(latestRow)
                      const missingFields = getPreviousRequiredFieldForActionPlan(targetCol, contextualActionRow)
                      if (readOnly) return
                      if (missingFields.length === 0) {
                        void startEditCell(latestRow, targetCol)
                        return
                      }
                      const highlightKeys = missingFields.map((col) => {
                        const ownerRow = ownerRowForColumn(col)
                        return highlightKey(ownerRow.id, col)
                      })
                      setHighlightedMissingCells(highlightKeys)
                    }, 0)
                  }

                  const riskRpnStyle: React.CSSProperties = {
                    ...(risk1 ? { background: colorFill(risk1) } : {}),
                    color: '#e1e5ec',
                    fontSize: 16,
                    fontWeight: 700,
                  }
                  const riskRpn2Style: React.CSSProperties = {
                    ...(risk2 ? { background: colorFill(risk2) } : {}),
                    color: '#e1e5ec',
                    fontSize: 16,
                    fontWeight: 700,
                  }

                  const prevOpNo = rowIndex > 0 ? tableRows[rowIndex - 1]?.operations?.operation_number ?? null : null
                  const isFirstOfMergedRun = mergeInfo[rowIndex]?.span > 0
                  const groupStart = isFirstOfMergedRun && rowIndex > 0 && opNo != null && prevOpNo != null && opNo !== prevOpNo

                  const span = mergeInfo[rowIndex]?.span ?? 0
                  const failureModeSpan = failureModeMergeInfo[rowIndex]?.span ?? 0
                  const failureBlockSpan = failureBlockMergeInfo[rowIndex]?.span ?? 0
                  const actionPlanBlockSpan = actionPlanBlockMergeInfo[rowIndex]?.span ?? 0
                  const rowNumber = rowHierarchyById.get(r.id)?.rowLabel

                  return (
                    <tr
                      key={r.id}
                      data-pfmea-row-id={r.id}
                      data-pfmea-row-no={rowNumber ?? undefined}
                      className={`pfmeaRow ${groupStart ? 'groupStart' : ''} ${hoveredRowId === r.id ? 'rowHover' : ''}`}
                      onMouseEnter={() => setHoveredRowId(r.id)}
                      onMouseLeave={() => setHoveredRowId((current) => (current === r.id ? null : current))}
                    >
                      {span > 0 ? (
                        <>
                          {isColumnVisible('id') ? (
                            <TdRead value={opNo == null ? '' : String(opNo)} className="pfmeaTd gray center multiLine" rowSpan={span} onClick={() => setExpandedOperationId(r.operation_id || r.operations?.id || null)} />
                          ) : null}
                          {isColumnVisible('station') ? (
                            <TdRead value={station} className="pfmeaTd gray center multiLine" rowSpan={span} onClick={() => setExpandedOperationId(r.operation_id || r.operations?.id || null)} />
                          ) : null}
                          {isColumnVisible('operation') ? (
                            <TdRead value={operationName} className="pfmeaTd gray center multiLine" rowSpan={span} onClick={() => setExpandedOperationId(r.operation_id || r.operations?.id || null)} />
                          ) : null}
                          {isColumnVisible('process_step') ? (
                            <TdRead value={step} className="pfmeaTd gray multiLine" rowSpan={span} onClick={() => setExpandedOperationId(r.operation_id || r.operations?.id || null)} />
                          ) : null}
                        </>
                      ) : null}

                      {isColumnVisible('row_no') ? (
                        <TdRead
                          value={rowNumber == null ? '' : String(rowNumber)}
                          className="pfmeaTd gray center singleLine"
                          style={{ fontWeight: 800, color: '#d9a86c', letterSpacing: 0.2 }}
                          onClick={() => setExpandedOperationId(r.operation_id || r.operations?.id || null)}
                        />
                      ) : null}

                      {isColumnVisible('failure_mode') && failureModeSpan > 0 ? (
                        <TdText
                          value={r.failure_mode}
                          editing={edit?.rowId === r.id && edit?.col === 'failure_mode'}
                          onStart={() => void startEditCell(r, 'failure_mode')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'failure_mode', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'failure_mode', v)
                            updateCellWithDerived(r, { failure_mode: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('failure_mode'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          rowSpan={failureModeSpan}
                          sideAction={
                            canAddFailureModeRow
                              ? {
                                  title: 'Add failure mode row',
                                  label: '+',
                                  onClick: () => {
                                    if (isPlaceholder) {
                                      void (async () => {
                                        try {
                                          const materializedRow = await materializePlaceholderRowForAdd(r)
                                          await addFailureModeContinuationRow(materializedRow, materializedRow)
                                        } catch (e: any) {
                                          setErr(e?.message ?? String(e))
                                        }
                                      })()
                                      return
                                    }
                                    const anchorRow = resolveBlockEndAnchorRow(rowIndex, failureModeMergeInfo) ?? r
                                    void addFailureModeContinuationRow(r, anchorRow)
                                  },
                                }
                              : undefined
                          }
                          disabled={readOnly}
                          flash={isMissingHighlighted('failure_mode')}
                          cellKey="failure_mode"
                          style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 16, fontWeight: 400, lineHeight: 1.45, textAlign: 'center', paddingTop: 14, paddingBottom: 14, color: '#d7dbe3' }}
                        />
                      ) : null}

                      {isColumnVisible('characteristic') && failureModeSpan > 0 ? (
                        <TdText
                          value={r.characteristic}
                          editing={edit?.rowId === r.id && edit?.col === 'characteristic'}
                          onStart={() => void startEditCell(r, 'characteristic')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'characteristic', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'characteristic', v)
                            updateCellWithDerived(r, { characteristic: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('characteristic'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          rowSpan={failureModeSpan}
                          disabled={readOnly}
                          cellKey="characteristic"
                          style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 16, color: '#d7dbe3' }}
                        />
                      ) : null}

                      {isColumnVisible('class') && failureModeSpan > 0 ? (
                        <TdClassSelect
                          value={normalizeClassValue(effectiveFailureModeOwnerRow.class)}
                          editing={edit?.rowId === r.id && edit?.col === 'class'}
                          onStart={() => void startEditCell(r, 'class')}
                          onCommit={(v) => updateCellWithDerived(r, { class: v || null })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('class'), false)}
                          stopEdit={() => setEdit(null)}
                          options={CLASS_OPTIONS}
                          rowSpan={failureModeSpan}
                          disabled={readOnly}
                          cellKey="class"
                        />
                      ) : null}

                      {isColumnVisible('effect') && failureBlockSpan > 0 ? (
                        <TdText
                          value={r.effect}
                          editing={edit?.rowId === r.id && edit?.col === 'effect'}
                          onStart={() => void startEditCell(r, 'effect')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'effect', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'effect', v)
                            updateCellWithDerived(r, { effect: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('effect'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          rowSpan={failureBlockSpan}
                          sideAction={
                            canAddEffectRow
                              ? {
                                  title: 'Add effect row',
                                  label: '+',
                                  onClick: () => {
                                    if (isPlaceholder) {
                                      void (async () => {
                                        try {
                                          const materializedRow = await materializePlaceholderRowForAdd(r)
                                          await addEffectContinuationRow(materializedRow, materializedRow)
                                        } catch (e: any) {
                                          setErr(e?.message ?? String(e))
                                        }
                                      })()
                                      return
                                    }
                                    const anchorRow = resolveBlockEndAnchorRow(rowIndex, failureBlockMergeInfo) ?? r
                                    void addEffectContinuationRow(failureModeOwnerRow, anchorRow)
                                  },
                                }
                              : undefined
                          }
                          disabled={readOnly}
                          flash={isMissingHighlighted('effect')}
                          cellKey="effect"
                          style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 16, color: '#d7dbe3' }}
                        />
                      ) : null}

                      {isColumnVisible('sev') && failureBlockSpan > 0 ? (
                        <TdScaleSelect
                          value={asInt1to10(effectiveFailureBlockOwnerRow.severity)}
                          editing={edit?.rowId === r.id && edit?.col === 'severity'}
                          onStart={() => void startEditCell(r, 'severity')}
                          onLiveChange={(n) => setPendingCellValue(r.id, 'severity', n)}
                          onCommit={(n) => {
                            setPendingCellValue(r.id, 'severity', n)
                            updateCellWithDerived(r, { severity: n })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('severity'), false)}
                          stopEdit={() => setEdit(null)}
                          options={severityOptions}
                          rowSpan={failureBlockSpan}
                          disabled={readOnly}
                          flash={isMissingHighlighted('severity')}
                          cellKey="severity"
                        />
                      ) : null}

                      {isColumnVisible('cause') && actionPlanBlockSpan > 0 ? (
                        <TdText
                          value={r.cause}
                          editing={edit?.rowId === r.id && edit?.col === 'cause'}
                          onStart={() => void startEditCell(r, 'cause')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'cause', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'cause', v)
                            updateCellWithDerived(r, { cause: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('cause'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          sideAction={
                            canAddCauseRow
                              ? {
                                  title: 'Add cause row',
                                  label: '+',
                                  onClick: () => {
                                    if (isPlaceholder) {
                                      void (async () => {
                                        try {
                                          const materializedRow = await materializePlaceholderRowForAdd(r)
                                          await addCauseContinuationRow(materializedRow, materializedRow)
                                        } catch (e: any) {
                                          setErr(e?.message ?? String(e))
                                        }
                                      })()
                                      return
                                    }
                                    const anchorRow = resolveBlockEndAnchorRow(rowIndex, actionPlanBlockMergeInfo) ?? r
                                    const sourceRow = getFailureBlockSourceRowAtIndex(rowIndex) ?? failureBlockOwnerRow
                                    void addCauseContinuationRow(sourceRow, anchorRow)
                                  },
                                }
                              : undefined
                          }
                          disabled={readOnly}
                          flash={isMissingHighlighted('cause')}
                          rowSpan={actionPlanBlockSpan}
                          cellKey="cause"
                        />
                      ) : null}

                      {isColumnVisible('occ') && actionPlanBlockSpan > 0 ? (
                        <TdScaleSelect
                          value={asInt1to10(effectiveActionPlanOwnerRow.occurrence)}
                          editing={edit?.rowId === r.id && edit?.col === 'occurrence'}
                          onStart={() => void startEditCell(r, 'occurrence')}
                          onLiveChange={(n) => setPendingCellValue(r.id, 'occurrence', n)}
                          onCommit={(n) => {
                            setPendingCellValue(r.id, 'occurrence', n)
                            updateCellWithDerived(r, { occurrence: n })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('occurrence'), false)}
                          stopEdit={() => setEdit(null)}
                          options={occurrenceOptions}
                          rowSpan={actionPlanBlockSpan}
                          disabled={readOnly}
                          flash={isMissingHighlighted('occurrence')}
                          cellKey="occurrence"
                        />
                      ) : null}

                      {isColumnVisible('current_prev') && actionPlanBlockSpan > 0 ? (
                        <TdText
                          value={r.current_prevention}
                          editing={edit?.rowId === r.id && edit?.col === 'current_prevention'}
                          onStart={() => void startEditCell(r, 'current_prevention')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'current_prevention', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'current_prevention', v)
                            updateCellWithDerived(r, { current_prevention: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('current_prevention'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          rowSpan={actionPlanBlockSpan}
                          disabled={readOnly}
                          flash={isMissingHighlighted('current_prevention')}
                          cellKey="current_prevention"
                        />
                      ) : null}

                      {isColumnVisible('current_det') && actionPlanBlockSpan > 0 ? (
                        <TdText
                          value={r.current_detection}
                          editing={edit?.rowId === r.id && edit?.col === 'current_detection'}
                          onStart={() => void startEditCell(r, 'current_detection')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'current_detection', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'current_detection', v)
                            updateCellWithDerived(r, { current_detection: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('current_detection'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          rowSpan={actionPlanBlockSpan}
                          disabled={readOnly}
                          flash={isMissingHighlighted('current_detection')}
                          cellKey="current_detection"
                        />
                      ) : null}

                      {isColumnVisible('det') && actionPlanBlockSpan > 0 ? (
                        <TdScaleSelect
                          value={asInt1to10(effectiveActionPlanOwnerRow.detection)}
                          editing={edit?.rowId === r.id && edit?.col === 'detection'}
                          onStart={() => void startEditCell(r, 'detection')}
                          onLiveChange={(n) => setPendingCellValue(r.id, 'detection', n)}
                          onCommit={(n) => {
                            setPendingCellValue(r.id, 'detection', n)
                            updateCellWithDerived(r, { detection: n })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('detection'), false)}
                          stopEdit={() => setEdit(null)}
                          options={detectionOptions}
                          rowSpan={actionPlanBlockSpan}
                          disabled={readOnly}
                          flash={isMissingHighlighted('detection')}
                          cellKey="detection"
                        />
                      ) : null}

                      {isColumnVisible('rpn') && actionPlanBlockSpan > 0 ? (
                        <TdRead
                          value={a1.rpn == null ? '' : String(a1.rpn)}
                          className="pfmeaTd rpnCell center gray singleLine"
                          style={riskRpnStyle}
                          rowSpan={actionPlanBlockSpan}
                          onClick={() => setExpandedOperationId(r.operation_id || r.operations?.id || null)}
                        />
                      ) : null}

                      {isColumnVisible('recommended_action') ? (
                        <TdText
                          value={r.recommended_action}
                          editing={edit?.rowId === r.id && edit?.col === 'recommended_action'}
                          onStart={() => runActionPlanStart('recommended_action')}
                          onLiveChange={(v) => {
                            setPendingCellValue(r.id, 'recommended_action', v)
                            clearRecommendedActionTransientIfFilled(r.id, v)
                          }}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'recommended_action', v)
                            clearRecommendedActionTransientIfFilled(r.id, v)
                            updateCellWithDerived(r, { recommended_action: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('recommended_action'), true)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          sideAction={
                            canAddRecommendedActionRow
                              ? {
                                  title: 'Add recommended action row',
                                  label: '+',
                                  onClick: () => {
                                    if (isPlaceholder) {
                                      void (async () => {
                                        try {
                                          const materializedRow = await materializePlaceholderRowForAdd(r)
                                          await addRecommendedActionContinuationRow(materializedRow, materializedRow)
                                        } catch (e: any) {
                                          setErr(e?.message ?? String(e))
                                        }
                                      })()
                                      return
                                    }
                                    void addRecommendedActionContinuationRow(r, r)
                                  },
                                }
                              : undefined
                          }
                          disabled={readOnly}
                          flash={isMissingHighlighted('recommended_action')}
                          cellKey="recommended_action"
                        />
                      ) : null}

                      {isColumnVisible('responsible') ? (
                        <TdText
                          value={r.responsible}
                          editing={edit?.rowId === r.id && edit?.col === 'responsible'}
                          onStart={() => runActionPlanStart('responsible')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'responsible', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'responsible', v)
                            updateCellWithDerived(r, { responsible: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('responsible'), false)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          singleLine
                          disabled={readOnly}
                          flash={isMissingHighlighted('responsible')}
                          cellKey="responsible"
                        />
                      ) : null}

                      {isColumnVisible('target_date') ? (
                        <TdDate
                          value={r.target_date}
                          editing={edit?.rowId === r.id && edit?.col === 'target_date'}
                          onStart={() => runActionPlanStart('target_date')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'target_date', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'target_date', v)
                            updateCellWithDerived(r, { target_date: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('target_date'), false)}
                          editorRef={editorRef}
                          stopEdit={() => setEdit(null)}
                          disabled={readOnly}
                          flash={isMissingHighlighted('target_date')}
                          cellKey="target_date"
                        />
                      ) : null}

                      {isColumnVisible('action_status') ? (
                        <TdSelect
                          value={latestRowForHighlights.action_status}
                          editing={edit?.rowId === r.id && edit?.col === 'action_status'}
                          onStart={() => runActionPlanStart('action_status')}
                          onLiveChange={(v) => setPendingCellValue(r.id, 'action_status', v)}
                          onCommit={(v) => {
                            setPendingCellValue(r.id, 'action_status', v)
                            updateCellWithDerived(r, { action_status: v })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('action_status'), false)}
                          stopEdit={() => setEdit(null)}
                          options={['', 'OPEN', 'CLOSED', 'CANCELED']}
                          disabled={readOnly}
                          flash={isMissingHighlighted('action_status')}
                          cellKey="action_status"
                        />
                      ) : null}

                      {isColumnVisible('o2') ? (
                        <TdScaleSelect
                          value={asInt1to10(latestRowForHighlights.occurrence2)}
                          editing={edit?.rowId === r.id && edit?.col === 'occurrence2'}
                          onStart={() => runActionPlanStart('occurrence2')}
                          onLiveChange={(n) => setPendingCellValue(r.id, 'occurrence2', n)}
                          onCommit={(n) => {
                            setPendingCellValue(r.id, 'occurrence2', n)
                            updateCellWithDerived(r, { occurrence2: n })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('occurrence2'), false)}
                          stopEdit={() => setEdit(null)}
                          options={occurrenceOptions}
                          disabled={readOnly}
                          flash={isMissingHighlighted('occurrence2')}
                          cellKey="occurrence2"
                        />
                      ) : null}

                      {isColumnVisible('d2') ? (
                        <TdScaleSelect
                          value={asInt1to10(latestRowForHighlights.detection2)}
                          editing={edit?.rowId === r.id && edit?.col === 'detection2'}
                          onStart={() => runActionPlanStart('detection2')}
                          onLiveChange={(n) => setPendingCellValue(r.id, 'detection2', n)}
                          onCommit={(n) => {
                            setPendingCellValue(r.id, 'detection2', n)
                            updateCellWithDerived(r, { detection2: n })
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('detection2'), false)}
                          stopEdit={() => setEdit(null)}
                          options={detectionOptions}
                          disabled={readOnly}
                          flash={isMissingHighlighted('detection2')}
                          cellKey="detection2"
                        />
                      ) : null}

                      {isColumnVisible('rpn2') ? (
                        <TdRead
                          value={a2.rpn == null ? '' : String(a2.rpn)}
                          className="pfmeaTd rpnCell center gray singleLine"
                          style={riskRpn2Style}
                          onClick={() => setExpandedOperationId(r.operation_id || r.operations?.id || null)}
                        />
                      ) : null}

                      {isColumnVisible('delete') ? (
                        <td className="pfmeaTd center" style={{ padding: '10px 8px !important' }}>
                          {!isPlaceholder && isEditOwner ? (
                            <button
                              className="trashBtn"
                              onClick={() => deleteRow(r.id)}
                              aria-label="Delete row"
                              title={readOnly ? 'Read-only' : 'Delete'}
                              disabled={readOnly}
                              style={{ opacity: readOnly ? 0.4 : 1, cursor: readOnly ? 'not-allowed' : 'pointer' }}
                            >
                              <svg className="trashIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                  d="M9 3h6m-8 4h10m-9 0 1 15h6l1-15M10 7v13m4-13v13"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          ) : (
                            <span aria-hidden="true" style={{ display: 'inline-block', width: 36, height: 29, opacity: 0 }} />
                          )}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      </div>
    </div>
  )
}

/* ===================== TH / TD COMPONENTS ===================== */

function Th(props: { w?: number | string; children?: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'center',
        padding: '10px 12px',
        fontSize: 13,
        color: 'rgba(255,255,255,0.78)',
        width: props.w,
        maxWidth: props.w,
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        borderRight: '1px solid rgba(255,255,255,0.14)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgb(40, 39, 47)',
        boxShadow: 'none',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        lineHeight: 1.2,
        fontWeight: 650,
      }}
    >
      {props.children}
    </th>
  )
}

function AfterHeader(props: { prefix: string }) {
  return (
    <>
      {props.prefix}{' '}
      <span style={{ fontSize: '0.78em', letterSpacing: 0.1 }}>(AFTER)</span>
    </>
  )
}

function TdRead(props: { value: string; className: string; style?: React.CSSProperties; rowSpan?: number; onClick?: () => void }) {
  return (
    <td rowSpan={props.rowSpan} className={props.className} style={{ ...(props.style ?? {}), cursor: props.onClick ? 'pointer' : undefined }} onClick={props.onClick}>
      {props.value || ''}
    </td>
  )
}

function anchoredPopupStyle(
  anchorEl: HTMLElement | null,
  width: number,
  topGap = 0,
  maxHeight = 280,
  openAboveAnchorEl?: HTMLElement | null
): React.CSSProperties {
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
  const openAboveRect = (openAboveAnchorEl ?? anchorEl).getBoundingClientRect()
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
  const desiredHeight = Math.min(maxHeight, Math.max(160, window.innerHeight - 24))
  const spaceBelow = window.innerHeight - rect.bottom - 12
  const spaceAbove = openAboveRect.top - 12
  const openAbove = spaceBelow < Math.min(desiredHeight, 220) && spaceAbove > spaceBelow
  const top = openAbove
    ? Math.max(12, openAboveRect.top - desiredHeight - topGap)
    : rect.bottom + topGap

  return {
    position: 'fixed',
    top,
    left,
    width,
    maxHeight,
  }
}

function adjacentPopupStyle(
  anchorEl: HTMLElement | null,
  width: number,
  anchorWidth: number,
  gap = 8,
  maxHeight = 280
): React.CSSProperties {
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
  const anchorLeft = Math.max(12, Math.min(rect.left, window.innerWidth - anchorWidth - 12))
  const rightLeft = anchorLeft + anchorWidth + gap
  const hasRoomOnRight = rightLeft + width <= window.innerWidth - 12
  const left = hasRoomOnRight
    ? rightLeft
    : Math.max(12, anchorLeft - gap - width)

  return {
    position: 'fixed',
    top: rect.bottom,
    left,
    width,
    maxHeight,
  }
}

const CALENDAR_WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const CALENDAR_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getCalendarCells(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const leading = (firstWeekday + 6) % 7
  const totalDays = getDaysInMonth(year, month)
  const cells: Array<{ key: string; day: number | null }> = []

  for (let i = 0; i < leading; i += 1) {
    cells.push({ key: `empty-start-${i}`, day: null })
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({ key: `day-${year}-${month}-${day}`, day })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `empty-end-${cells.length}`, day: null })
  }
  return cells
}

function todayIsoDate() {
  const now = new Date()
  return formatIsoDate(now.getFullYear(), now.getMonth(), now.getDate())
}

function TdText(props: {
  value: string
  editing: boolean
  onStart: () => void
  onCommit: (v: string) => void
  onLiveChange?: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void
  editorRef: PfmeaEditorRef
  stopEdit: () => void
  rowSpan?: number
  sideAction?: {
    title: string
    label: string
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  }
  singleLine?: boolean
  disabled?: boolean
  style?: React.CSSProperties
  flash?: boolean
  cellKey?: string
}) {
  const [val, setVal] = useState(props.value ?? '')
  const localRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const { editorRef } = props

  useEffect(() => setVal(props.value ?? ''), [props.value])

  useEffect(() => {
    if (!props.editing) return
    if (props.singleLine) return
    const t = localRef.current as HTMLTextAreaElement | null
    if (!t) return
    t.style.height = '0px'
    t.style.height = Math.max(18, t.scrollHeight) + 'px'
  }, [props.editing, props.singleLine, val])

  const sideActionButton = props.sideAction ? (
    <button
      type="button"
      className="pfmeaInlineAddBtn"
      title={props.sideAction.title}
      aria-label={props.sideAction.title}
      disabled={props.disabled}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onClick={(e) => {
        if (props.disabled) return
        e.preventDefault()
        e.stopPropagation()
        props.sideAction?.onClick(e)
      }}
    >
      {props.sideAction.label}
    </button>
  ) : null

  const setEditorRefs = useCallback((el: HTMLTextAreaElement | HTMLInputElement | null) => {
    localRef.current = el
    editorRef.current = el
  }, [editorRef])

  if (props.disabled) {
    return (
      <td data-pfmea-col={props.cellKey} rowSpan={props.rowSpan} className={`pfmeaTd ${props.singleLine ? 'singleLine' : 'multiLine'} ${props.flash ? 'flashMissing' : ''}`} style={props.style}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
          <span style={{ flex: 1 }}>{val || ''}</span>
          {sideActionButton}
        </div>
      </td>
    )
  }

  if (!props.editing) {
    return (
      <td
        data-pfmea-col={props.cellKey}
        rowSpan={props.rowSpan}
        className={`pfmeaTd editable ${props.singleLine ? 'singleLine' : 'multiLine'} ${props.flash ? 'flashMissing' : ''}`}
        onClick={props.onStart}
        title={props.singleLine ? val : undefined}
        style={props.style}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
          <span style={{ flex: 1 }}>{val || ''}</span>
          {sideActionButton}
        </div>
      </td>
    )
  }

  return (
    <td
      data-pfmea-col={props.cellKey}
      rowSpan={props.rowSpan}
      className={`pfmeaTd editable ${props.singleLine ? 'singleLine' : 'multiLine'} ${props.flash ? 'flashMissing' : ''}`}
      style={props.style}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
        <div style={{ flex: 1 }}>
          {props.singleLine ? (
            <input
              className="pfmeaEditor"
              ref={setEditorRefs}
              value={val}
              onChange={(e) => {
                setVal(e.target.value)
                props.onLiveChange?.(e.target.value)
              }}
              onKeyDown={props.onKeyDown}
              onBlur={(e) => {
                const nextVal = e.currentTarget.value
                props.onLiveChange?.(nextVal)
                if (nextVal !== (props.value ?? '')) props.onCommit(nextVal)
                props.stopEdit()
              }}
              style={editorBase}
            />
          ) : (
            <textarea
              className="pfmeaEditor"
              ref={setEditorRefs}
              value={val}
              onChange={(e) => {
                setVal(e.target.value)
                props.onLiveChange?.(e.target.value)
              }}
              onKeyDown={props.onKeyDown}
              onBlur={(e) => {
                const nextVal = e.currentTarget.value
                props.onLiveChange?.(nextVal)
                if (nextVal !== (props.value ?? '')) props.onCommit(nextVal)
                props.stopEdit()
              }}
              style={editorBase}
            />
          )}
        </div>
        {sideActionButton}
      </div>
    </td>
  )
}

function TdScaleSelect(props: {
  value: number | null
  editing: boolean
  onStart: () => void
  onCommit: (n: number | null) => void
  onLiveChange?: (n: number | null) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void
  stopEdit: () => void
  options: SeverityOption[]
  rowSpan?: number
  disabled?: boolean
  flash?: boolean
  cellKey?: string
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const optionHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cellAnchorEl, setCellAnchorEl] = useState<HTMLTableCellElement | null>(null)
  const [hoverOpen, setHoverOpen] = useState(false)
  const [optionHoverOpen, setOptionHoverOpen] = useState(false)
  const [hoveredOption, setHoveredOption] = useState<SeverityOption | null>(null)

  const selected = useMemo(() => props.options.find((x) => x.level === props.value) ?? null, [props.options, props.value])
  const hoverExamples = selected?.examples ?? []
  const hoveredOptionExamples = hoveredOption?.examples ?? []

  const clearHoverTimer = useCallback(() => {
    if (!hoverTimerRef.current) return
    clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }, [])

  const clearOptionHoverTimer = useCallback(() => {
    if (!optionHoverTimerRef.current) return
    clearTimeout(optionHoverTimerRef.current)
    optionHoverTimerRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      clearHoverTimer()
      clearOptionHoverTimer()
    }
  }, [clearHoverTimer, clearOptionHoverTimer])

  useEffect(() => {
    if (!props.editing) return
    clearHoverTimer()
    setTimeout(() => triggerRef.current?.focus(), 0)
  }, [props.editing, clearHoverTimer])

  const startHoverDelay = useCallback(() => {
    if (props.value == null || hoverExamples.length === 0) return
    clearHoverTimer()
    hoverTimerRef.current = setTimeout(() => setHoverOpen(true), 700)
  }, [props.value, hoverExamples.length, clearHoverTimer])

  const stopHover = useCallback(() => {
    clearHoverTimer()
    setHoverOpen(false)
  }, [clearHoverTimer])

  const startOptionHoverDelay = useCallback(
    (opt: SeverityOption) => {
      if (opt.examples.length === 0) return
      clearOptionHoverTimer()
      setHoveredOption(opt)
      optionHoverTimerRef.current = setTimeout(() => setOptionHoverOpen(true), 700)
    },
    [clearOptionHoverTimer]
  )

  const stopOptionHover = useCallback(() => {
    clearOptionHoverTimer()
    setOptionHoverOpen(false)
    setHoveredOption(null)
  }, [clearOptionHoverTimer])

  const closeScaleMenu = useCallback(() => {
    stopOptionHover()
    props.stopEdit()
  }, [props, stopOptionHover])

  if (props.disabled) {
    return <td data-pfmea-col={props.cellKey} rowSpan={props.rowSpan} className={`pfmeaTd center gray singleLine scaleValue ${props.flash ? 'flashMissing' : ''}`}>{props.value == null ? '' : String(props.value)}</td>
  }

  if (!props.editing) {
    return (
      <td
        data-pfmea-col={props.cellKey}
        rowSpan={props.rowSpan}
        ref={setCellAnchorEl}
        className={`pfmeaTd editable center gray singleLine scaleValue scaleSelectCell ${props.flash ? 'flashMissing' : ''}`}
        onClick={() => {
          stopHover()
          props.onStart()
        }}
        onMouseEnter={startHoverDelay}
        onMouseLeave={stopHover}
      >
        {props.value == null ? '' : String(props.value)}
        {hoverOpen && cellAnchorEl && typeof document !== 'undefined'
          ? createPortal(
            <div
              data-pfmea-popup="true"
              style={{
                ...anchoredPopupStyle(cellAnchorEl, 360, 0, 280),
                  zIndex: 130,
                  overflowY: 'auto',
                  borderRadius: 10,
                  border: `1px solid ${SURFACE_BORDER}`,
                  background: 'rgb(52, 57, 69)',
                  boxShadow: '0 14px 30px rgba(0,0,0,0.18)',
                  padding: 10,
                  textAlign: 'left',
                  position: 'fixed',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#d9a86c', marginBottom: 6 }}>
                  {selected ? `${selected.level} - ${selected.label}` : 'Examples'}
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {hoverExamples.map((ex, idx) => (
                    <div key={`${selected?.level ?? 'x'}-ex-${idx}`} style={{ fontSize: 12, color: '#d9a86c', lineHeight: 1.3, fontWeight: 400 }}>
                      - {ex}
                    </div>
                  ))}
                </div>
              </div>,
              document.body
            )
          : null}
      </td>
    )
  }

  return (
    <td data-pfmea-col={props.cellKey} rowSpan={props.rowSpan} ref={setCellAnchorEl} className={`pfmeaTd editable center singleLine scaleValue scaleSelectCell ${props.flash ? 'flashMissing' : ''}`}>
      <button
        type="button"
        ref={triggerRef}
        onKeyDown={props.onKeyDown}
        style={{
          width: '100%',
          minHeight: 18,
          border: 0,
          outline: 'none',
          background: 'transparent',
          font: 'inherit',
          color: 'inherit',
          padding: 0,
          margin: 0,
          textAlign: 'center',
          cursor: 'pointer',
          fontWeight: 400,
          fontSize: 16,
        }}
      >
        {props.value == null ? '-' : String(props.value)}
      </button>

      {cellAnchorEl && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-pfmea-popup="true"
              onMouseLeave={closeScaleMenu}
              style={{
                ...anchoredPopupStyle(cellAnchorEl, 300, 0, 280),
                zIndex: 120,
                overflowY: 'auto',
                borderRadius: 10,
                border: `1px solid ${SURFACE_BORDER}`,
                background: 'rgb(52, 57, 69)',
                boxShadow: '0 14px 32px rgba(0,0,0,0.16)',
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                position: 'fixed',
              }}
            >
                  {props.options.length === 0 ? (
                <div style={{ fontSize: 12, color: '#d9a86c', padding: 8, textAlign: 'left', fontWeight: 400 }}>No active values.</div>
              ) : (
                <>
                  {props.options.map((opt) => {
                    const isSelected = opt.level === props.value
                    return (
                      <button
                        key={opt.level}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => startOptionHoverDelay(opt)}
                        onMouseLeave={stopOptionHover}
                        onClick={() => {
                          stopOptionHover()
                          props.onLiveChange?.(opt.level)
                          props.stopEdit()
                          props.onCommit(opt.level)
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          border: '1px solid transparent',
                          borderRadius: 8,
                          background: isSelected ? 'rgba(255,255,255,0.12)' : 'transparent',
                          color: '#d9a86c',
                          padding: '7px 8px',
                          cursor: 'pointer',
                          fontSize: 12,
                          lineHeight: 1.25,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {opt.level} - {opt.label}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={stopOptionHover}
                    onClick={() => {
                      stopOptionHover()
                      props.onLiveChange?.(null)
                      props.stopEdit()
                      props.onCommit(null)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: '1px solid transparent',
                      borderRadius: 8,
                      background: props.value == null ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: '#d9a86c',
                      padding: '7px 8px',
                      cursor: 'pointer',
                      fontSize: 12,
                      lineHeight: 1.25,
                      marginTop: 4,
                    }}
                  >
                    (clear)
                  </button>
                </>
              )}
            </div>,
            document.body
          )
        : null}

      {optionHoverOpen && cellAnchorEl && hoveredOption && hoveredOptionExamples.length > 0 && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-pfmea-popup="true"
              style={{
                ...adjacentPopupStyle(cellAnchorEl, 360, 300, 8, 280),
                zIndex: 130,
                overflowY: 'auto',
                borderRadius: 10,
                border: `1px solid ${SURFACE_BORDER}`,
                background: 'rgb(52, 57, 69)',
                boxShadow: '0 14px 30px rgba(0,0,0,0.18)',
                padding: 10,
                textAlign: 'left',
                position: 'fixed',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#d9a86c', marginBottom: 6 }}>
                {hoveredOption.level} - {hoveredOption.label}
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {hoveredOptionExamples.map((ex, idx) => (
                  <div key={`${hoveredOption.level}-hover-ex-${idx}`} style={{ fontSize: 12, color: '#d9a86c', lineHeight: 1.3, fontWeight: 400 }}>
                    - {ex}
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </td>
  )
}

function TdClassSelect(props: {
  value: string | null
  editing: boolean
  onStart: () => void
  onCommit: (v: string | null) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void
  stopEdit: () => void
  options: SelectOption[]
  rowSpan?: number
  disabled?: boolean
  cellKey?: string
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [cellAnchorEl, setCellAnchorEl] = useState<HTMLTableCellElement | null>(null)
  const [popupAnchorEl, setPopupAnchorEl] = useState<HTMLButtonElement | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hoveredOption, setHoveredOption] = useState<SelectOption | null>(null)
  const [optionHoverOpen, setOptionHoverOpen] = useState(false)
  useEffect(() => {
    if (!props.editing) return
    setTimeout(() => triggerRef.current?.focus(), 0)
  }, [props.editing])

  const clearHoverTimer = useCallback(() => {
    if (!hoverTimerRef.current) return
    clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }, [])

  const stopOptionHover = useCallback(() => {
    clearHoverTimer()
    setOptionHoverOpen(false)
    setHoveredOption(null)
  }, [clearHoverTimer])

  const startOptionHoverDelay = useCallback(
    (opt: SelectOption) => {
      clearHoverTimer()
      setHoveredOption(opt)
      hoverTimerRef.current = setTimeout(() => {
        setOptionHoverOpen(true)
      }, 700)
    },
    [clearHoverTimer]
  )

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer])
  const hoveredOptionDetails = hoveredOption ? CLASS_OPTION_DETAILS[hoveredOption.value] : null
  const popupAnchorWidth = popupAnchorEl?.getBoundingClientRect().width ?? 300
  const setTriggerRefs = useCallback((node: HTMLButtonElement | null) => {
    triggerRef.current = node
    setPopupAnchorEl((current) => (current === node ? current : node))
  }, [])

  if (props.disabled) {
    return <td data-pfmea-col={props.cellKey} rowSpan={props.rowSpan} className="pfmeaTd center singleLine scaleValue">{props.value ?? ''}</td>
  }

  if (!props.editing) {
    return (
      <td
        data-pfmea-col={props.cellKey}
        rowSpan={props.rowSpan}
        className="pfmeaTd editable center singleLine scaleValue scaleSelectCell"
        onClick={props.onStart}
      >
        {props.value ?? ''}
      </td>
    )
  }

  return (
    <td data-pfmea-col={props.cellKey} rowSpan={props.rowSpan} ref={setCellAnchorEl} className="pfmeaTd editable center gray singleLine scaleValue scaleSelectCell">
      <button
        type="button"
        ref={setTriggerRefs}
        onKeyDown={props.onKeyDown}
        style={{
          width: '100%',
          minHeight: 18,
          border: 0,
          outline: 'none',
          background: 'transparent',
          font: 'inherit',
          color: 'inherit',
          padding: 0,
          margin: 0,
          textAlign: 'center',
          cursor: 'pointer',
          fontWeight: 400,
          fontSize: 16,
        }}
      >
        {props.value ?? '-'}
      </button>

      {popupAnchorEl && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-pfmea-popup="true"
              onMouseLeave={() => {
                stopOptionHover()
                props.stopEdit()
              }}
              style={{
                ...anchoredPopupStyle(popupAnchorEl, 300, 0, 280, cellAnchorEl ?? popupAnchorEl),
                zIndex: 120,
                overflowY: 'auto',
                borderRadius: 10,
                border: `1px solid ${SURFACE_BORDER}`,
                background: 'rgb(52, 57, 69)',
                boxShadow: '0 14px 32px rgba(0,0,0,0.16)',
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                position: 'fixed',
              }}
            >
              {props.options.map((opt) => {
                const isSelected = opt.value === props.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => startOptionHoverDelay(opt)}
                    onMouseLeave={stopOptionHover}
                    onClick={() => {
                      stopOptionHover()
                      props.stopEdit()
                      props.onCommit(opt.value)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: '1px solid transparent',
                      borderRadius: 8,
                      background: isSelected ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: '#d9a86c',
                      padding: '7px 8px',
                      cursor: 'pointer',
                      fontSize: 12,
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>,
            document.body
          )
        : null}

      {optionHoverOpen && popupAnchorEl && hoveredOptionDetails && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-pfmea-popup="true"
              style={{
                ...adjacentPopupStyle(popupAnchorEl, 360, popupAnchorWidth, 8, 280),
                zIndex: 130,
                overflowY: 'auto',
                borderRadius: 10,
                border: `1px solid ${SURFACE_BORDER}`,
                background: 'rgb(52, 57, 69)',
                boxShadow: '0 14px 30px rgba(0,0,0,0.18)',
                padding: 10,
                textAlign: 'left',
                position: 'fixed',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#d9a86c', marginBottom: 6 }}>
                {hoveredOptionDetails.title}
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {hoveredOptionDetails.description.map((line, idx) => (
                  <div key={`${hoveredOption?.value ?? 'option'}-detail-${idx}`} style={{ fontSize: 12, color: '#d9a86c', lineHeight: 1.35, fontWeight: 400 }}>
                    - {line}
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </td>
  )
}

function TdNum(props: {
  value: number | null
  editing: boolean
  onStart: () => void
  onCommit: (n: number | null) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  editorRef: PfmeaEditorRef
  stopEdit: () => void
  disabled?: boolean
}) {
  const [val, setVal] = useState(props.value == null ? '' : String(props.value))
  const { editorRef } = props
  const setInputRef = useCallback((el: HTMLInputElement | null) => {
    editorRef.current = el
  }, [editorRef])
  useEffect(() => setVal(props.value == null ? '' : String(props.value)), [props.value])

  const onChangeStrict = (s: string) => {
    if (s === '') {
      setVal('')
      return
    }
    if (!/^\d{1,2}$/.test(s)) return
    const n = Number(s)
    if (!Number.isFinite(n)) return
    if (n < 1 || n > 10) return
    setVal(String(n))
  }

  const onKeyDownStrict = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'Enter']
    if (allowed.includes(e.key)) return
    if (/^\d$/.test(e.key)) return
    e.preventDefault()
  }

  if (props.disabled) {
    return <td className="pfmeaTd center singleLine">{val || ''}</td>
  }

  if (!props.editing) {
    return (
      <td className="pfmeaTd editable center singleLine" onClick={props.onStart}>
        {val || ''}
      </td>
    )
  }

  return (
    <td className="pfmeaTd editable center singleLine">
      <input
        className="pfmeaEditor"
        ref={setInputRef}
        value={val}
        inputMode="numeric"
        onKeyDown={(e) => {
          onKeyDownStrict(e)
          props.onKeyDown(e)
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text')
          const t = text.trim()
          const n = asInt1to10(t)
          if (!(t === '' || n != null)) e.preventDefault()
        }}
        onChange={(e) => onChangeStrict(e.target.value)}
        onBlur={() => {
          props.stopEdit()
          props.onCommit(asInt1to10(val))
        }}
        style={{ ...editorBase, textAlign: 'center' as const }}
      />
    </td>
  )
}

function TdDate(props: {
  value: string | null
  editing: boolean
  onStart: () => void
  onCommit: (v: string | null) => void
  onLiveChange?: (v: string | null) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>) => void
  editorRef: PfmeaEditorRef
  stopEdit: () => void
  disabled?: boolean
  flash?: boolean
  cellKey?: string
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const cellRef = useRef<HTMLTableCellElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)
  const { editorRef } = props
  const [cellAnchorEl, setCellAnchorEl] = useState<HTMLTableCellElement | null>(null)
  const [val, setVal] = useState(props.value ?? '')
  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = parseIsoDateParts(props.value)
    if (parsed) return { year: parsed.year, month: parsed.month }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  useEffect(() => setVal(props.value ?? ''), [props.value])

  useEffect(() => {
    const parsed = parseIsoDateParts(props.value)
    if (parsed) {
      setViewMonth({ year: parsed.year, month: parsed.month })
      return
    }
    const now = new Date()
    setViewMonth({ year: now.getFullYear(), month: now.getMonth() })
  }, [props.value, props.editing])

  useEffect(() => {
    if (!props.editing) return
    setTimeout(() => triggerRef.current?.focus(), 0)
  }, [props.editing])

  useEffect(() => {
    if (!props.editing) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (cellRef.current?.contains(target) || popupRef.current?.contains(target)) return
      props.stopEdit()
      props.onLiveChange?.(val ? val : null)
      props.onCommit(val ? val : null)
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [props, val])

  const setCellRefs = useCallback((el: HTMLTableCellElement | null) => {
    cellRef.current = el
    setCellAnchorEl((current) => current === el ? current : el)
  }, [])

  const setTriggerRefs = useCallback((el: HTMLButtonElement | null) => {
    triggerRef.current = el
    editorRef.current = el
  }, [editorRef])

  if (props.disabled) {
    return <td data-pfmea-col={props.cellKey} className={`pfmeaTd singleLine ${props.flash ? 'flashMissing' : ''}`}>{val || ''}</td>
  }

  if (!props.editing) {
    return (
      <td data-pfmea-col={props.cellKey} className={`pfmeaTd editable singleLine ${props.flash ? 'flashMissing' : ''}`} onClick={props.onStart}>
        {val || ''}
      </td>
    )
  }

  const selectedParts = parseIsoDateParts(val)
  const selectedIso = selectedParts ? formatIsoDate(selectedParts.year, selectedParts.month, selectedParts.day) : ''
  const todayIso = todayIsoDate()
  const calendarCells = getCalendarCells(viewMonth.year, viewMonth.month)

  const changeMonth = (delta: number) => {
    setViewMonth((current) => {
      const nextDate = new Date(current.year, current.month + delta, 1)
      return { year: nextDate.getFullYear(), month: nextDate.getMonth() }
    })
  }

  const pickDate = (day: number) => {
    const nextVal = formatIsoDate(viewMonth.year, viewMonth.month, day)
    setVal(nextVal)
    props.stopEdit()
    props.onLiveChange?.(nextVal)
    props.onCommit(nextVal)
  }

  return (
    <td data-pfmea-col={props.cellKey} ref={setCellRefs} className={`pfmeaTd editable singleLine ${props.flash ? 'flashMissing' : ''}`}>
      <button
        type="button"
        className="pfmeaEditor"
        ref={setTriggerRefs}
        onKeyDown={props.onKeyDown}
        style={{
          ...editorBase,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'rgba(255,255,255,0.08)',
          color: '#d9a86c',
          border: `1px solid ${SURFACE_BORDER}`,
          borderRadius: 8,
          height: 38,
          padding: '0 10px',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span>{val || 'Select date'}</span>
        <span style={{ color: '#d9a86c', fontSize: 14, lineHeight: 1 }}>▾</span>
      </button>

      {cellAnchorEl && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-pfmea-popup="true"
              ref={popupRef}
              style={{
                ...anchoredPopupStyle(cellAnchorEl, 252, 0, 320),
                zIndex: 120,
                borderRadius: 10,
                border: `1px solid ${SURFACE_BORDER}`,
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
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => changeMonth(-1)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: `1px solid ${SURFACE_BORDER}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#d9a86c',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ‹
                </button>
                <div style={{ fontSize: 13, color: '#d9a86c', fontWeight: 700 }}>
                  {CALENDAR_MONTHS[viewMonth.month]} {viewMonth.year}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => changeMonth(1)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: `1px solid ${SURFACE_BORDER}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#d9a86c',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ›
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {CALENDAR_WEEKDAYS.map((label) => (
                  <div key={label} style={{ textAlign: 'center', fontSize: 11, color: SURFACE_MUTED, fontWeight: 700, paddingBottom: 2 }}>
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
                      onMouseDown={(e) => e.preventDefault()}
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
                        color: '#d9a86c',
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
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    props.stopEdit()
                    props.onLiveChange?.(null)
                    props.onCommit(null)
                  }}
                  style={{
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: `1px solid ${SURFACE_BORDER}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#d9a86c',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const nextVal = todayIsoDate()
                    props.stopEdit()
                    props.onLiveChange?.(nextVal)
                    props.onCommit(nextVal)
                  }}
                  style={{
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: `1px solid ${SURFACE_BORDER}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#d9a86c',
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
    </td>
  )
}

function TdSelect(props: {
  value: string | null
  editing: boolean
  onStart: () => void
  onCommit: (v: string | null) => void
  onLiveChange?: (v: string | null) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void
  stopEdit: () => void
  options: string[]
  disabled?: boolean
  flash?: boolean
  cellKey?: string
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [cellAnchorEl, setCellAnchorEl] = useState<HTMLTableCellElement | null>(null)
  const [popupAnchorEl, setPopupAnchorEl] = useState<HTMLButtonElement | null>(null)
  const popupWidth = useMemo(() => {
    const longest = Math.max(
      props.value?.length ?? 0,
      ...props.options.map((opt) => opt.length)
    )
    return Math.min(220, Math.max(120, longest * 8 + 28))
  }, [props.options, props.value])
  useEffect(() => {
    if (!props.editing) return
    setTimeout(() => triggerRef.current?.focus(), 0)
  }, [props.editing])

  if (props.disabled) {
    return (
      <td
        data-pfmea-col={props.cellKey}
        className={`pfmeaTd center singleLine scaleValue ${props.flash ? 'flashMissing' : ''}`}
        style={{ color: '#d9a86c' }}
      >
        {props.value ?? ''}
      </td>
    )
  }

  if (!props.editing) {
    return (
      <td
        data-pfmea-col={props.cellKey}
        className={`pfmeaTd editable center singleLine scaleValue scaleSelectCell ${props.flash ? 'flashMissing' : ''}`}
        style={{ color: '#d9a86c' }}
        onClick={props.onStart}
      >
        {props.value ?? ''}
      </td>
    )
  }

  return (
    <td
      data-pfmea-col={props.cellKey}
      ref={setCellAnchorEl}
      className={`pfmeaTd editable center singleLine scaleValue scaleSelectCell ${props.flash ? 'flashMissing' : ''}`}
      style={{ color: '#d9a86c' }}
    >
      <button
        type="button"
        ref={(node) => {
          triggerRef.current = node
          setPopupAnchorEl((current) => (current === node ? current : node))
        }}
        onKeyDown={props.onKeyDown}
        style={{
          width: '100%',
          minHeight: 18,
          border: 0,
          outline: 'none',
          background: 'transparent',
          font: 'inherit',
          color: '#d9a86c',
          padding: 0,
          margin: 0,
          textAlign: 'center',
          cursor: 'pointer',
          fontWeight: 400,
          fontSize: 16,
        }}
      >
        {props.value ?? '-'}
      </button>

      {popupAnchorEl && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-pfmea-popup="true"
              onMouseLeave={props.stopEdit}
              style={{
                ...anchoredPopupStyle(popupAnchorEl, popupWidth, 0, 280, cellAnchorEl ?? popupAnchorEl),
                zIndex: 120,
                overflowY: 'auto',
                borderRadius: 10,
                border: `1px solid ${SURFACE_BORDER}`,
                background: 'rgb(52, 57, 69)',
                boxShadow: '0 14px 32px rgba(0,0,0,0.16)',
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                position: 'fixed',
              }}
            >
              {props.options.map((opt) => {
                const isSelected = opt === props.value
                const optionLabel = opt === '' ? '(clear)' : opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      props.onLiveChange?.(opt || null)
                      props.stopEdit()
                      props.onCommit(opt)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: '1px solid transparent',
                      borderRadius: 8,
                      background: isSelected ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: '#d9a86c',
                      padding: '7px 8px',
                      cursor: 'pointer',
                      fontSize: 12,
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {optionLabel}
                  </button>
                )
              })}
            </div>,
            document.body
          )
        : null}
    </td>
  )
}

/* ===================== STYLES ===================== */

const lbl: React.CSSProperties = { fontSize: 11, color: SURFACE_MUTED, marginBottom: 6, fontWeight: 700 }

const input: React.CSSProperties = {
  width: '100%',
  height: 40,
  padding: '8px 10px',
  borderRadius: SURFACE_RADIUS,
  border: `1px solid ${SURFACE_BORDER}`,
  outline: 'none',
  fontWeight: 700,
  background: SURFACE_BG,
  color: SURFACE_TEXT,
  fontSize: 12,
}

const actionBtn: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: SURFACE_RADIUS,
  border: `1px solid ${SURFACE_BORDER}`,
  fontWeight: 650,
  fontSize: 12,
  color: SURFACE_TEXT,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit',
  background: SURFACE_BG,
}

const pillBtn: React.CSSProperties = {
  height: 28,
  padding: '0 12px',
  borderRadius: SURFACE_RADIUS,
  border: `1px solid ${SURFACE_BORDER}`,
  background: SURFACE_BG,
  cursor: 'pointer',
  fontWeight: 800,
  boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
  fontSize: 12,
  whiteSpace: 'nowrap',
  color: SURFACE_TEXT,
}

const pillLink: React.CSSProperties = {
  ...pillBtn,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const editorBase: React.CSSProperties = {
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  lineHeight: 1.25,
  fontWeight: 500,
  fontSize: 13,
  fontFamily: 'inherit',
  minHeight: 18,
  textAlign: 'center',
}

function PfmeaPageFallback() {
  return (
    <div style={{ padding: 24, color: '#666', fontSize: 14, fontWeight: 700 }}>
      Loading PFMEA...
    </div>
  )
}


