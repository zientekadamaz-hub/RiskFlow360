export type PfmeaContinuationRow = {
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
}

export function hasPfmeaTextValue(value: string | null | undefined) {
  return !!(value ?? '').trim()
}

export function hasFailureModeContext(row: Pick<PfmeaContinuationRow, 'failure_mode'>) {
  return hasPfmeaTextValue(row.failure_mode)
}

export function patchHasAnyValue(patch: Record<string, unknown>) {
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

export function isCauseContinuationEmpty(row: PfmeaContinuationRow) {
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

export function isRecommendedActionContinuationEmpty(row: PfmeaContinuationRow) {
  return !patchHasAnyValue({
    recommended_action: row.recommended_action,
    responsible: row.responsible,
    target_date: row.target_date,
    action_status: row.action_status,
    occurrence2: row.occurrence2,
    detection2: row.detection2,
  })
}

export function isFailureModeContinuationEmpty(row: PfmeaContinuationRow) {
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

export function isEffectContinuationEmpty(row: PfmeaContinuationRow) {
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
