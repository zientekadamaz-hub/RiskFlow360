import { normalizePfmeaGroupId, normalizePfmeaRowNo } from './pfmea-hierarchy-utils'
import { createPfmeaRiskUid, normalizePfmeaRiskUid } from './pfmea-risk-uid-utils'
import { asInt1to10 } from './pfmea-risk-utils'
import { getPfmeaRowOperationId } from './pfmea-row-order-utils'
import { normalizeClassValue, normalizePfmeaPcpValue } from './pfmea-value-utils'

export const PFMEA_GROUP_ID_FIELDS = [
  'row_no',
  'failure_mode_group_id',
  'failure_block_group_id',
  'action_plan_group_id',
] as const

export const PFMEA_CLONE_FIELDS = [
  'risk_uid',
  'operation_id',
  'row_no',
  'failure_mode_group_id',
  'failure_block_group_id',
  'action_plan_group_id',
  'failure_mode',
  'effect',
  'severity',
  'characteristic',
  'pcp',
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
] as const

export const PFMEA_CLONE_FIELDS_LEGACY = PFMEA_CLONE_FIELDS.filter(
  (field) => !(PFMEA_GROUP_ID_FIELDS as readonly string[]).includes(field)
)

export const PFMEA_SELECT_FIELDS = [
  'id',
  'revision_id',
  ...PFMEA_CLONE_FIELDS,
  'operations!inner(id,operation_number,name,machine,operation,project_id,active)',
].join(',')

export const PFMEA_SELECT_FIELDS_LEGACY = [
  'id',
  'revision_id',
  ...PFMEA_CLONE_FIELDS_LEGACY,
  'operations!inner(id,operation_number,name,machine,operation,project_id,active)',
].join(',')

export type PfmeaPayloadRow = {
  id: string
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
  pcp?: unknown
  class?: string | null
  cause?: string | null
  occurrence?: number | string | null
  current_prevention?: string | null
  current_detection?: string | null
  detection?: number | string | null
  rpn?: number | null
  oxd?: number | null
  recommended_action?: string | null
  responsible?: string | null
  target_date?: string | null
  action_status?: string | null
  occurrence2?: number | string | null
  detection2?: number | string | null
  rpn2?: number | null
  oxd2?: number | null
  rpn_current?: number | null
  oxd_current?: number | null
  created_at: string
  operations?: { id?: string | null } | null
}

export type PfmeaPublishedMetadata = {
  created_at: string
  row_no: string | null
  failure_mode_group_id: string | null
  failure_block_group_id: string | null
  action_plan_group_id: string | null
}

export function buildPfmeaPublishedSyncPatch(row: PfmeaPayloadRow) {
  return {
    risk_uid: normalizePfmeaRiskUid(row.risk_uid) ?? normalizePfmeaRiskUid(row.id) ?? createPfmeaRiskUid(),
    row_no: normalizePfmeaRowNo(row.row_no),
    failure_mode_group_id: normalizePfmeaGroupId(row.failure_mode_group_id),
    failure_block_group_id: normalizePfmeaGroupId(row.failure_block_group_id),
    action_plan_group_id: normalizePfmeaGroupId(row.action_plan_group_id),
    failure_mode: row.failure_mode ?? '',
    effect: row.effect ?? '',
    severity: asInt1to10(row.severity),
    characteristic: row.characteristic ?? '',
    pcp: normalizePfmeaPcpValue(row.pcp),
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

export function buildPfmeaInsertPayloadForRevision(row: PfmeaPayloadRow, revisionId: string) {
  const operationId = getPfmeaRowOperationId(row)
  if (!operationId) throw new Error(`PFMEA row ${row.id} is missing operation_id.`)

  return {
    revision_id: revisionId,
    operation_id: operationId,
    ...buildPfmeaPublishedSyncPatch(row),
  }
}

export function buildPfmeaPublishedMetadataPatch(meta: PfmeaPublishedMetadata) {
  return {
    created_at: meta.created_at,
    row_no: meta.row_no,
    failure_mode_group_id: meta.failure_mode_group_id,
    failure_block_group_id: meta.failure_block_group_id,
    action_plan_group_id: meta.action_plan_group_id,
  }
}

export function summarizePfmeaRowsForError(rows: PfmeaPayloadRow[], limit = 3) {
  return rows
    .slice(0, limit)
    .map((row) => normalizePfmeaRowNo(row.row_no) ?? (row.failure_mode?.trim() || row.id))
    .join(', ')
}

export function isMissingPfmeaGroupIdColumnError(error: unknown) {
  const message = (error as { message?: string } | null)?.message ?? String(error ?? '')
  const normalized = message.toLowerCase()
  return PFMEA_GROUP_ID_FIELDS.some((field) => normalized.includes(field))
}

export function stripPfmeaGroupIdsFromPayload<Payload extends Record<string, unknown>>(payload: Payload) {
  const next = { ...payload }
  for (const field of PFMEA_GROUP_ID_FIELDS) {
    delete next[field]
  }
  return next
}
