import { normalizePfmeaGroupId, normalizePfmeaRowNo } from './pfmea-hierarchy-utils'
import { normalizePfmeaRiskUid } from './pfmea-risk-uid-utils'
import { asInt1to10 } from './pfmea-risk-utils'
import { normalizeClassValue } from './pfmea-value-utils'

export type PfmeaMatchRow = {
  id?: string
  risk_uid?: string | null
  operation_id?: string | null
  row_no?: string | null
  failure_mode_group_id?: string | null
  failure_block_group_id?: string | null
  action_plan_group_id?: string | null
  failure_mode?: string | null
  effect?: string | null
  severity?: number | string | null
  characteristic?: string | null
  class?: string | null
  cause?: string | null
  occurrence?: number | string | null
  current_prevention?: string | null
  current_detection?: string | null
  detection?: number | string | null
  recommended_action?: string | null
  responsible?: string | null
  target_date?: string | null
  action_status?: string | null
  occurrence2?: number | string | null
  detection2?: number | string | null
  created_at?: string | null
  operations?: { id?: string | null } | null
}

function pfmeaRowOperationId(row: PfmeaMatchRow) {
  return row.operation_id || row.operations?.id || ''
}

function buildPfmeaGroupKey(row: PfmeaMatchRow) {
  return JSON.stringify([
    normalizePfmeaGroupId(row.failure_mode_group_id) ?? '',
    normalizePfmeaGroupId(row.failure_block_group_id) ?? '',
    normalizePfmeaGroupId(row.action_plan_group_id) ?? '',
  ])
}

function findByPfmeaGroupIds<Row extends PfmeaMatchRow>(rows: Row[], sourceRow: PfmeaMatchRow) {
  const sourceGroupKey = buildPfmeaGroupKey(sourceRow)
  if (sourceGroupKey === JSON.stringify(['', '', ''])) return null

  const byGroupIds = rows.filter((row) => buildPfmeaGroupKey(row) === sourceGroupKey)
  return byGroupIds.length === 1 ? byGroupIds[0] : null
}

function findByRiskUid<Row extends PfmeaMatchRow>(rows: Row[], sourceRow: PfmeaMatchRow) {
  const riskUid = normalizePfmeaRiskUid(sourceRow.risk_uid)
  if (!riskUid) return null
  const matches = rows.filter((row) => normalizePfmeaRiskUid(row.risk_uid) === riskUid)
  return matches.length === 1 ? matches[0] : null
}

export function buildPfmeaRowMatchKey(row: PfmeaMatchRow) {
  return JSON.stringify([
    pfmeaRowOperationId(row),
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

export function buildPfmeaRowContentKey(row: PfmeaMatchRow) {
  return JSON.stringify([
    pfmeaRowOperationId(row),
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

export function findEquivalentPublishedPfmeaRow<Row extends PfmeaMatchRow>(rows: Row[], sourceRow: PfmeaMatchRow): Row | null {
  const operationId = pfmeaRowOperationId(sourceRow) || null
  const sameOperationRows = rows.filter((row) => (pfmeaRowOperationId(row) || null) === operationId)
  if (sameOperationRows.length === 0) return null

  const byRiskUid = findByRiskUid(sameOperationRows, sourceRow)
  if (byRiskUid) return byRiskUid

  const byGroupIds = findByPfmeaGroupIds(sameOperationRows, sourceRow)
  if (byGroupIds) return byGroupIds

  const sourceRowNo = normalizePfmeaRowNo(sourceRow.row_no)
  if (sourceRowNo) {
    const byRowNo = sameOperationRows.filter((row) => normalizePfmeaRowNo(row.row_no) === sourceRowNo)
    if (byRowNo.length === 1) return byRowNo[0]
  }

  const sourceContentKey = buildPfmeaRowContentKey(sourceRow)
  const byContent = sameOperationRows.filter((row) => buildPfmeaRowContentKey(row) === sourceContentKey)
  if (byContent.length === 1) return byContent[0]

  const sourceCreatedAt = (sourceRow.created_at ?? '').trim()
  if (sourceCreatedAt) {
    const byCreatedAt = sameOperationRows.filter((row) => (row.created_at ?? '').trim() === sourceCreatedAt)
    if (byCreatedAt.length === 1) return byCreatedAt[0]
  }

  const sourceKey = buildPfmeaRowMatchKey(sourceRow)
  const byFullSignature = sameOperationRows.filter((row) => buildPfmeaRowMatchKey(row) === sourceKey)
  if (byFullSignature.length === 1) return byFullSignature[0]

  return null
}

export function findEquivalentPfmeaRow<Row extends PfmeaMatchRow>(
  rows: Row[],
  sourceRow: PfmeaMatchRow,
  options: { allowContentFallback?: boolean } = {}
): Row | null {
  const operationId = pfmeaRowOperationId(sourceRow) || null
  const sameOperationRows = rows.filter((row) => (pfmeaRowOperationId(row) || null) === operationId)
  if (sameOperationRows.length === 0) return null

  const byRiskUid = findByRiskUid(sameOperationRows, sourceRow)
  if (byRiskUid) return byRiskUid

  const byGroupIds = findByPfmeaGroupIds(sameOperationRows, sourceRow)
  if (byGroupIds) return byGroupIds

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

  if (options.allowContentFallback) {
    const sourceContentKey = buildPfmeaRowContentKey(sourceRow)
    const byContent = sameOperationRows.filter((row) => buildPfmeaRowContentKey(row) === sourceContentKey)
    if (byContent.length === 1) return byContent[0]
  }

  const sourceKey = buildPfmeaRowMatchKey(sourceRow)
  const bySignature = sameOperationRows.filter((row) => buildPfmeaRowMatchKey(row) === sourceKey)
  if (bySignature.length === 1) return bySignature[0]

  return null
}
