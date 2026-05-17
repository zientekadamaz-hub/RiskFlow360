import type { CSSProperties } from 'react'

import { getPfmeaPcpAutoReasons, isPfmeaSelectedForPcp, type PfmeaPcpRiskColor } from './pfmea-pcp-utils'
import { asInt1to10 } from './pfmea-risk-utils'
import { colorFill, type RiskColor } from './pfmea-risk-matrix-config'
import { hasFailureModeContext, hasPfmeaTextValue } from './pfmea-continuation-utils'
import { isPlaceholderRowId } from './pfmea-hierarchy-utils'
import { isPfmeaCellHighlighted } from './pfmea-action-validation-utils'
import { findPfmeaMergeOwnerRow, type PfmeaMergeInfo } from './pfmea-table-merge-utils'
import { normalizeClassValue } from './pfmea-value-utils'
import type { PfmeaRow } from './pfmea-types'

type PfmeaRiskValues = {
  sev: number | null
  doVal: number | null
  rpn: number | null
}

type PfmeaRowHierarchyLabel = {
  rowLabel?: string | null
}

export type PfmeaTableRowModel = {
  actionPlanBlockSpan: number
  actionPlanOwnerRow: PfmeaRow
  canAddCauseRow: boolean
  canAddEffectRow: boolean
  canAddFailureModeRow: boolean
  canAddRecommendedActionRow: boolean
  currentRisk: PfmeaRiskValues
  effectiveActionPlanOwnerRow: PfmeaRow
  effectiveCurrentRow: PfmeaRow
  effectiveFailureBlockOwnerRow: PfmeaRow
  effectiveFailureModeOwnerRow: PfmeaRow
  failureBlockOwnerRow: PfmeaRow
  failureBlockSpan: number
  failureModeOwnerRow: PfmeaRow
  failureModeSpan: number
  groupStart: boolean
  isMissingHighlighted: (col: keyof PfmeaRow) => boolean
  isPlaceholder: boolean
  latestRowForHighlights: PfmeaRow
  operationName: string
  opNo: number | null
  pcpAutoReasons: string[]
  pcpChecked: boolean
  pcpDisabled: boolean
  pcpSourceRow: PfmeaRow
  residualRisk: PfmeaRiskValues
  risk1: RiskColor | null
  risk2: RiskColor | null
  riskRpn2Style: CSSProperties
  riskRpnStyle: CSSProperties
  rowNumber: string | null | undefined
  span: number
  station: string
  step: string
}

export function buildPfmeaTableRowModel(params: {
  actionPlanBlockMergeInfo: PfmeaMergeInfo[]
  applyPendingCellValues: (row: PfmeaRow) => PfmeaRow
  computeDerivedFromContext: (row: PfmeaRow) => {
    currentRisk: PfmeaRiskValues
    residualRisk: PfmeaRiskValues
  }
  failureBlockMergeInfo: PfmeaMergeInfo[]
  failureModeMergeInfo: PfmeaMergeInfo[]
  getRiskColorFor: (severity: number | null, doValue: number | null) => RiskColor | null
  highlightedMissingCells: string[] | null
  mergeInfo: PfmeaMergeInfo[]
  readOnly: boolean
  row: PfmeaRow
  rowHierarchyById: Map<string, PfmeaRowHierarchyLabel>
  rowIndex: number
  sourceRows: PfmeaRow[]
  tableRows: PfmeaRow[]
}): PfmeaTableRowModel {
  const { row, rowIndex, tableRows } = params
  const opNo = row.operations?.operation_number ?? null
  const station = row.operations?.machine ?? ''
  const operationName = row.operations?.operation ?? ''
  const step = row.operations?.name ?? ''
  const isPlaceholder = isPlaceholderRowId(row.id)

  const { currentRisk, residualRisk } = params.computeDerivedFromContext(row)
  const risk1 = params.getRiskColorFor(currentRisk.sev, currentRisk.doVal)
  const risk2 = params.getRiskColorFor(residualRisk.sev, residualRisk.doVal)

  const failureModeOwnerRow = findPfmeaMergeOwnerRow(tableRows, rowIndex, params.failureModeMergeInfo) ?? row
  const failureBlockOwnerRow = findPfmeaMergeOwnerRow(tableRows, rowIndex, params.failureBlockMergeInfo) ?? row
  const actionPlanOwnerRow = findPfmeaMergeOwnerRow(tableRows, rowIndex, params.actionPlanBlockMergeInfo) ?? row

  const effectiveCurrentRow = params.applyPendingCellValues(row)
  const effectiveFailureModeOwnerRow = params.applyPendingCellValues(failureModeOwnerRow)
  const effectiveFailureBlockOwnerRow = params.applyPendingCellValues(failureBlockOwnerRow)
  const effectiveActionPlanOwnerRow = params.applyPendingCellValues(actionPlanOwnerRow)

  const latestRowForHighlights = params.applyPendingCellValues(
    params.sourceRows.find((rowItem) => rowItem.id === row.id) ?? row
  )
  const effectivePcpSourceRow = {
    ...effectiveActionPlanOwnerRow,
    class: normalizeClassValue(effectiveFailureModeOwnerRow.class),
    severity: asInt1to10(effectiveFailureBlockOwnerRow.severity),
  } as PfmeaRow
  const pcpRisk = risk1 as PfmeaPcpRiskColor | null
  const pcpAutoReasons = getPfmeaPcpAutoReasons(effectivePcpSourceRow, pcpRisk)
  const pcpChecked = isPfmeaSelectedForPcp(effectivePcpSourceRow, pcpRisk)
  const pcpDisabled = params.readOnly || isPlaceholder || !hasFailureModeContext(effectiveFailureModeOwnerRow)

  const prevOpNo = rowIndex > 0 ? tableRows[rowIndex - 1]?.operations?.operation_number ?? null : null
  const span = params.mergeInfo[rowIndex]?.span ?? 0
  const isFirstOfMergedRun = span > 0
  const groupStart = isFirstOfMergedRun && rowIndex > 0 && opNo != null && prevOpNo != null && opNo !== prevOpNo

  const riskRpnStyle: CSSProperties = {
    ...(risk1 ? { background: colorFill(risk1) } : {}),
    color: '#e1e5ec',
    fontSize: 16,
    fontWeight: 700,
  }
  const riskRpn2Style: CSSProperties = {
    ...(risk2 ? { background: colorFill(risk2) } : {}),
    color: '#e1e5ec',
    fontSize: 16,
    fontWeight: 700,
  }

  return {
    actionPlanBlockSpan: params.actionPlanBlockMergeInfo[rowIndex]?.span ?? 0,
    actionPlanOwnerRow,
    canAddCauseRow: hasPfmeaTextValue(effectiveActionPlanOwnerRow.cause),
    canAddEffectRow: hasPfmeaTextValue(effectiveFailureBlockOwnerRow.effect),
    canAddFailureModeRow: hasPfmeaTextValue(effectiveFailureModeOwnerRow.failure_mode),
    canAddRecommendedActionRow: hasPfmeaTextValue(effectiveCurrentRow.recommended_action),
    currentRisk,
    effectiveActionPlanOwnerRow,
    effectiveCurrentRow,
    effectiveFailureBlockOwnerRow,
    effectiveFailureModeOwnerRow,
    failureBlockOwnerRow,
    failureBlockSpan: params.failureBlockMergeInfo[rowIndex]?.span ?? 0,
    failureModeOwnerRow,
    failureModeSpan: params.failureModeMergeInfo[rowIndex]?.span ?? 0,
    groupStart,
    isMissingHighlighted: (col) => isPfmeaCellHighlighted(params.highlightedMissingCells, row.id, col),
    isPlaceholder,
    latestRowForHighlights,
    operationName,
    opNo,
    pcpAutoReasons,
    pcpChecked,
    pcpDisabled,
    pcpSourceRow: actionPlanOwnerRow,
    residualRisk,
    risk1,
    risk2,
    riskRpn2Style,
    riskRpnStyle,
    rowNumber: params.rowHierarchyById.get(row.id)?.rowLabel,
    span,
    station,
    step,
  }
}
