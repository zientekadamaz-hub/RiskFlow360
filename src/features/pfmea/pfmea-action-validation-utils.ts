import { asInt1to10 } from './pfmea-risk-utils'

export type PfmeaActionPlanField =
  | 'recommended_action'
  | 'responsible'
  | 'target_date'
  | 'action_status'
  | 'occurrence2'
  | 'detection2'

export type PfmeaActionPlanDependencyField =
  | 'failure_mode'
  | 'effect'
  | 'severity'
  | 'cause'
  | 'occurrence'
  | 'current_prevention'
  | 'current_detection'
  | 'detection'
  | PfmeaActionPlanField

export type PfmeaActionPlanRow = {
  failure_mode: string
  effect: string
  severity: number | string | null
  cause: string
  occurrence: number | string | null
  current_prevention: string
  current_detection: string
  detection: number | string | null
  recommended_action: string
  responsible: string
  target_date: string | null
  action_status: string | null
  occurrence2: number | string | null
}

export function buildPfmeaActionPlanValidationRow(params: {
  currentRow: PfmeaActionPlanRow
  failureModeOwnerRow: Pick<PfmeaActionPlanRow, 'failure_mode'>
  failureBlockOwnerRow: Pick<PfmeaActionPlanRow, 'effect' | 'severity'>
  actionPlanOwnerRow: Pick<
    PfmeaActionPlanRow,
    'cause' | 'occurrence' | 'current_prevention' | 'current_detection' | 'detection'
  >
}): PfmeaActionPlanRow {
  return {
    ...params.currentRow,
    failure_mode: params.failureModeOwnerRow.failure_mode,
    effect: params.failureBlockOwnerRow.effect,
    severity: params.failureBlockOwnerRow.severity,
    cause: params.actionPlanOwnerRow.cause,
    occurrence: params.actionPlanOwnerRow.occurrence,
    current_prevention: params.actionPlanOwnerRow.current_prevention,
    current_detection: params.actionPlanOwnerRow.current_detection,
    detection: params.actionPlanOwnerRow.detection,
  }
}

export function getMissingRequiredForRecommendedAction(row: PfmeaActionPlanRow): PfmeaActionPlanDependencyField[] {
  const missing: PfmeaActionPlanDependencyField[] = []
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

export function getPreviousRequiredFieldForActionPlan(
  target: PropertyKey,
  row: PfmeaActionPlanRow
): PfmeaActionPlanDependencyField[] {
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
