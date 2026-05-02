import { createPfmeaGroupIds, PLACEHOLDER_ROW_PREFIX, type PfmeaGroupIds } from './pfmea-hierarchy-utils'

export type PfmeaRowFactoryOperation = {
  id: string
  project_id: string
  operation_number: number | null
  name: string
  machine?: string | null
  operation?: string | null
  active?: boolean
}

export type PfmeaEmptyPayload = PfmeaGroupIds & {
  revision_id: string
  operation_id: string
  row_no: string | null
  failure_mode: string
  effect: string
  severity: number | string | null
  characteristic: string
  pcp: boolean | null
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
}

export function makeEmptyPfmeaPayload(operationId: string, revisionId: string, groups?: Partial<PfmeaGroupIds>): PfmeaEmptyPayload {
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
    pcp: null,
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

export function makePlaceholderRow(op: PfmeaRowFactoryOperation, workingRevisionId: string | null, token: string, sortIndex: number) {
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
  }
}
