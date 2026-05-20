export type PfmeaReportRiskRow = {
  action_status?: string | null
  action_plan_group_id?: string | null
  created_at?: string | null
  detection?: number | string | null
  detection2?: number | string | null
  failure_block_group_id?: string | null
  failure_mode_group_id?: string | null
  id?: string | null
  operation_id?: string | null
  occurrence?: number | string | null
  occurrence2?: number | string | null
  operations?: { id?: string | null; project_id?: string | null; active?: boolean | null } | Array<{ id?: string | null; project_id?: string | null; active?: boolean | null }> | null
  oxd_current?: number | string | null
  oxd2?: number | string | null
  revision_id?: string | null
  rpn?: number | string | null
  rpn_current?: number | string | null
  rpn2?: number | string | null
  row_no?: string | null
  severity?: number | string | null
}

export function toReportNumber(value: unknown) {
  if (value == null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function getPfmeaReportRisk(row: PfmeaReportRiskRow) {
  const severity = toReportNumber(row.severity)
  const actionStatus = (row.action_status ?? '').trim().toUpperCase()
  const usePostAction = actionStatus === 'CLOSED'
  const occurrence = toReportNumber(usePostAction ? row.occurrence2 : row.occurrence)
  const detection = toReportNumber(usePostAction ? row.detection2 : row.detection)
  const rawDoValue = occurrence != null && detection != null ? occurrence * detection : null
  const persistedCurrentDoValue = toReportNumber(row.oxd_current)
  const persistedResidualDoValue = toReportNumber(row.oxd2)
  const doValue = rawDoValue ?? (usePostAction ? persistedResidualDoValue : null) ?? persistedCurrentDoValue
  const rawRpn = severity != null && rawDoValue != null ? severity * rawDoValue : null
  const persistedCurrentRpn = toReportNumber(row.rpn_current)
  const persistedResidualRpn = toReportNumber(row.rpn2)
  const persistedRpn = toReportNumber(row.rpn)
  const rpn = rawRpn ?? (usePostAction ? persistedResidualRpn : null) ?? persistedCurrentRpn ?? persistedRpn

  return {
    doValue,
    rpn,
    severity,
  }
}

export function getPfmeaCurrentOpenRisk(row: PfmeaReportRiskRow) {
  const actionStatus = (row.action_status ?? '').trim().toUpperCase()
  if (actionStatus === 'CLOSED') {
    return getPfmeaReportRisk(row)
  }

  const severity = toReportNumber(row.severity)
  const occurrence = toReportNumber(row.occurrence)
  const detection = toReportNumber(row.detection)
  const persistedCurrentDoValue = toReportNumber(row.oxd_current)
  const doValue = persistedCurrentDoValue ?? (occurrence != null && detection != null ? occurrence * detection : null)
  const persistedCurrentRpn = toReportNumber(row.rpn_current)
  const persistedRpn = toReportNumber(row.rpn)
  const rpn = persistedCurrentRpn ?? persistedRpn ?? (severity != null && doValue != null ? severity * doValue : null)

  return {
    doValue,
    rpn,
    severity,
  }
}

function normalizeRiskText(value: string | null | undefined) {
  return (value ?? '').trim()
}

function operationIdForRiskKey(row: PfmeaReportRiskRow) {
  const operationRelation = row.operations
  const operation = Array.isArray(operationRelation) ? operationRelation[0] : operationRelation
  return normalizeRiskText(row.operation_id) || normalizeRiskText(operation?.id) || 'operation'
}

function causeBlockKeyFromRowNo(rowNo: string | null | undefined) {
  const normalized = normalizeRiskText(rowNo)
  if (!normalized) return null
  const parts = normalized.split('.').map((part) => part.trim())
  if (parts.length < 4 || parts.slice(0, 4).some((part) => !part)) return null
  return parts.slice(0, 4).join('.')
}

export function getPfmeaCurrentOpenRiskKey(row: PfmeaReportRiskRow, index = 0) {
  const revisionId = normalizeRiskText(row.revision_id) || 'revision'
  const operationId = operationIdForRiskKey(row)
  const groupId = normalizeRiskText(row.action_plan_group_id)
  if (groupId) return `${revisionId}:${operationId}:group:${groupId}`

  const causeBlockKey = causeBlockKeyFromRowNo(row.row_no)
  if (causeBlockKey) return `${revisionId}:${operationId}:row-no:${causeBlockKey}`

  return `${revisionId}:${operationId}:row:${normalizeRiskText(row.id) || index}`
}

export type PfmeaCurrentOpenRiskEntry = {
  doValue: number | null
  key: string
  row: PfmeaReportRiskRow
  rpn: number | null
  severity: number | null
}

export function collectPfmeaCurrentOpenRisks(rows: PfmeaReportRiskRow[]) {
  const risksByKey = new Map<string, PfmeaCurrentOpenRiskEntry>()

  rows.forEach((row, index) => {
    const key = getPfmeaCurrentOpenRiskKey(row, index)
    const previous = risksByKey.get(key)
    const current = getPfmeaCurrentOpenRisk(row)
    const severity = current.severity ?? previous?.severity ?? null
    const doValue = current.doValue ?? previous?.doValue ?? null
    const rpn = current.rpn ?? previous?.rpn ?? (severity != null && doValue != null ? severity * doValue : null)

    if (severity == null && doValue == null && rpn == null) return

    risksByKey.set(key, {
      doValue,
      key,
      row,
      rpn,
      severity,
    })
  })

  return Array.from(risksByKey.values()).filter((risk) => risk.rpn != null || (risk.severity != null && risk.doValue != null))
}
