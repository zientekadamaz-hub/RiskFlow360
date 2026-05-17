export type PfmeaReportRiskRow = {
  action_status?: string | null
  detection?: number | string | null
  detection2?: number | string | null
  occurrence?: number | string | null
  occurrence2?: number | string | null
  oxd_current?: number | string | null
  rpn?: number | string | null
  rpn_current?: number | string | null
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
  const doValue = rawDoValue ?? persistedCurrentDoValue
  const rawRpn = severity != null && rawDoValue != null ? severity * rawDoValue : null
  const persistedCurrentRpn = toReportNumber(row.rpn_current)
  const persistedRpn = toReportNumber(row.rpn)
  const rpn = rawRpn ?? persistedCurrentRpn ?? persistedRpn

  return {
    doValue,
    rpn,
    severity,
  }
}

export function getPfmeaCurrentOpenRisk(row: PfmeaReportRiskRow) {
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
