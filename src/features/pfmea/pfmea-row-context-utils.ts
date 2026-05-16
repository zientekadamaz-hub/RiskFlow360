import type { PfmeaRow } from './pfmea-types'
import {
  isPlaceholderRowId,
  normalizePfmeaGroupId,
  parsePfmeaRowNo,
  samePfmeaGroupValue,
} from './pfmea-hierarchy-utils'
import { asInt1to10, calcRpn } from './pfmea-risk-utils'

type ApplyPendingCellValues = (row: PfmeaRow) => PfmeaRow

function pfmeaOperationId(row: Pick<PfmeaRow, 'operation_id' | 'operations'>) {
  return row.operation_id || row.operations?.id || null
}

function isCompleteEffectBlock(row: PfmeaRow) {
  return !!(row.effect ?? '').trim() && asInt1to10(row.severity) != null
}

function isCompleteCurrentRiskBlock(row: PfmeaRow) {
  return (
    isCompleteEffectBlock(row) &&
    !!(row.cause ?? '').trim() &&
    asInt1to10(row.occurrence) != null &&
    !!(row.current_prevention ?? '').trim() &&
    !!(row.current_detection ?? '').trim() &&
    asInt1to10(row.detection) != null
  )
}

function operationRowsFor(tableRows: PfmeaRow[], operationId: string | null) {
  return tableRows.filter((item) => {
    if (isPlaceholderRowId(item.id)) return false
    return pfmeaOperationId(item) === operationId
  })
}

function shouldContinueWithinFailureBlock(candidate: PfmeaRow, effectiveRow: PfmeaRow) {
  const failureMode = (effectiveRow.failure_mode ?? '').trim()
  const failureModeGroupId = normalizePfmeaGroupId(effectiveRow.failure_mode_group_id)
  const failureBlockGroupId = normalizePfmeaGroupId(effectiveRow.failure_block_group_id)
  const failureBlockKey = parsePfmeaRowNo(effectiveRow.row_no)?.failureBlockKey ?? null

  if (failureModeGroupId) {
    if (!samePfmeaGroupValue(candidate.failure_mode_group_id, failureModeGroupId)) return false
  } else if ((candidate.failure_mode ?? '').trim() !== failureMode) {
    return false
  }

  if (failureBlockGroupId) {
    if (!samePfmeaGroupValue(candidate.failure_block_group_id, failureBlockGroupId)) return false
  } else if (failureBlockKey && parsePfmeaRowNo(candidate.row_no)?.failureBlockKey !== failureBlockKey) {
    return false
  }

  return true
}

function shouldContinueWithinActionPlan(candidate: PfmeaRow, effectiveRow: PfmeaRow) {
  if (!shouldContinueWithinFailureBlock(candidate, effectiveRow)) return false

  const actionPlanGroupId = normalizePfmeaGroupId(effectiveRow.action_plan_group_id)
  if (actionPlanGroupId && !samePfmeaGroupValue(candidate.action_plan_group_id, actionPlanGroupId)) return false

  return true
}

export function getPfmeaCauseContinuationSourceRow(
  row: PfmeaRow,
  tableRows: PfmeaRow[],
  applyPendingCellValues: ApplyPendingCellValues
) {
  const effectiveRow = applyPendingCellValues(row)
  if (isCompleteEffectBlock(effectiveRow)) return effectiveRow

  const visibleRows = operationRowsFor(tableRows, pfmeaOperationId(effectiveRow))
  const rowIndex = visibleRows.findIndex((item) => item.id === row.id)
  if (rowIndex < 0) return effectiveRow

  for (let i = rowIndex - 1; i >= 0; i -= 1) {
    const candidate = applyPendingCellValues(visibleRows[i])
    if (!shouldContinueWithinFailureBlock(candidate, effectiveRow)) break
    if (isCompleteEffectBlock(candidate)) {
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

export function getPfmeaRecommendedActionContinuationSourceRow(
  row: PfmeaRow,
  tableRows: PfmeaRow[],
  applyPendingCellValues: ApplyPendingCellValues
) {
  const effectiveRow = applyPendingCellValues(row)
  if (isCompleteCurrentRiskBlock(effectiveRow)) return effectiveRow

  const visibleRows = operationRowsFor(tableRows, pfmeaOperationId(effectiveRow))
  const rowIndex = visibleRows.findIndex((item) => item.id === row.id)
  if (rowIndex < 0) return effectiveRow

  for (let i = rowIndex - 1; i >= 0; i -= 1) {
    const candidate = applyPendingCellValues(visibleRows[i])
    if (!shouldContinueWithinActionPlan(candidate, effectiveRow)) break

    if (isCompleteCurrentRiskBlock(candidate)) {
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

export function computePfmeaDerivedFromContext(
  row: PfmeaRow,
  tableRows: PfmeaRow[],
  applyPendingCellValues: ApplyPendingCellValues
) {
  const effectiveRow = applyPendingCellValues(row)
  const currentRiskRow = getPfmeaCauseContinuationSourceRow(effectiveRow, tableRows, applyPendingCellValues)
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

export function getPfmeaFailureBlockSourceRowAtIndex(
  rowIndex: number,
  tableRows: PfmeaRow[],
  applyPendingCellValues: ApplyPendingCellValues
) {
  const effectiveRow = applyPendingCellValues(tableRows[rowIndex] ?? ({} as PfmeaRow))
  if (isCompleteEffectBlock(effectiveRow)) return effectiveRow

  const operationId = pfmeaOperationId(effectiveRow)
  for (let i = rowIndex - 1; i >= 0; i -= 1) {
    const candidate = applyPendingCellValues(tableRows[i] ?? ({} as PfmeaRow))
    if (pfmeaOperationId(candidate) !== operationId) break
    if (!shouldContinueWithinFailureBlock(candidate, effectiveRow)) break
    if (isCompleteEffectBlock(candidate)) return candidate
  }

  return effectiveRow
}
