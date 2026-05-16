import { createPfmeaGroupIds } from './pfmea-hierarchy-utils'
import { makeEmptyPfmeaPayload } from './pfmea-row-factory-utils'
import { asInt1to10, computeDerived } from './pfmea-risk-utils'
import type { PfmeaRow } from './pfmea-types'
import { normalizeClassValue } from './pfmea-value-utils'

export function buildPfmeaFailureModeContinuationInsertPayload(
  targetRow: PfmeaRow,
  finalRevisionId: string,
  createdAt: string
) {
  return {
    ...makeEmptyPfmeaPayload(targetRow.operation_id, finalRevisionId),
    created_at: createdAt,
  }
}

export function buildPfmeaEffectContinuationInsertPayload(
  targetRow: PfmeaRow,
  targetEffectiveRow: PfmeaRow,
  finalRevisionId: string,
  createdAt: string
) {
  return {
    ...makeEmptyPfmeaPayload(
      targetRow.operation_id,
      finalRevisionId,
      createPfmeaGroupIds({
        failure_mode_group_id: targetEffectiveRow.failure_mode_group_id ?? undefined,
      })
    ),
    failure_mode: targetEffectiveRow.failure_mode,
    characteristic: targetEffectiveRow.characteristic,
    class: normalizeClassValue(targetEffectiveRow.class),
    created_at: createdAt,
  }
}

export function buildPfmeaCauseContinuationInsertPayload(
  targetRow: PfmeaRow,
  targetSourceRow: PfmeaRow,
  finalRevisionId: string,
  createdAt: string
) {
  return {
    ...makeEmptyPfmeaPayload(
      targetRow.operation_id,
      finalRevisionId,
      createPfmeaGroupIds({
        failure_mode_group_id: targetSourceRow.failure_mode_group_id ?? undefined,
        failure_block_group_id: targetSourceRow.failure_block_group_id ?? undefined,
      })
    ),
    failure_mode: targetSourceRow.failure_mode,
    effect: targetSourceRow.effect,
    severity: asInt1to10(targetSourceRow.severity),
    characteristic: targetSourceRow.characteristic,
    class: normalizeClassValue(targetSourceRow.class),
    created_at: createdAt,
  }
}

export function buildPfmeaRecommendedActionContinuationInsertPayload(
  targetRow: PfmeaRow,
  targetSourceRow: PfmeaRow,
  finalRevisionId: string,
  createdAt: string
) {
  return {
    ...makeEmptyPfmeaPayload(
      targetRow.operation_id,
      finalRevisionId,
      createPfmeaGroupIds({
        failure_mode_group_id: targetSourceRow.failure_mode_group_id ?? undefined,
        failure_block_group_id: targetSourceRow.failure_block_group_id ?? undefined,
        action_plan_group_id: targetSourceRow.action_plan_group_id ?? undefined,
      })
    ),
    failure_mode: targetSourceRow.failure_mode,
    effect: targetSourceRow.effect,
    severity: asInt1to10(targetSourceRow.severity),
    characteristic: targetSourceRow.characteristic,
    class: normalizeClassValue(targetSourceRow.class),
    cause: targetSourceRow.cause,
    occurrence: asInt1to10(targetSourceRow.occurrence),
    current_prevention: targetSourceRow.current_prevention,
    current_detection: targetSourceRow.current_detection,
    detection: asInt1to10(targetSourceRow.detection),
    ...computeDerived({
      ...targetSourceRow,
      recommended_action: '',
      responsible: '',
      target_date: null,
      action_status: '',
      occurrence2: null,
      detection2: null,
    } as PfmeaRow),
    created_at: createdAt,
  }
}
