export type PfmeaRiskInput = {
  action_status?: string | null
  detection: number | string | null
  detection2: number | string | null
  occurrence: number | string | null
  occurrence2: number | string | null
  severity: number | string | null
}

export type PfmeaDerivedRisk = {
  oxd: number | null
  oxd2: number | null
  oxd_current: number | null
  rpn: number | null
  rpn2: number | null
  rpn_current: number | null
}

export function asInt1to10(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const numeric = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(numeric)) return null
  const intValue = Math.trunc(numeric)
  if (intValue < 1 || intValue > 10) return null
  return intValue
}

export function calcRpn(severityRaw: unknown, occurrenceRaw: unknown, detectionRaw: unknown) {
  const sev = asInt1to10(severityRaw)
  const occ = asInt1to10(occurrenceRaw)
  const det = asInt1to10(detectionRaw)
  const doVal = occ != null && det != null ? occ * det : null
  const rpn = sev != null && doVal != null ? sev * doVal : null
  return { sev, occ, det, doVal, rpn }
}

export function computeDerived(row: PfmeaRiskInput): PfmeaDerivedRisk {
  const current = calcRpn(row.severity, row.occurrence, row.detection)
  const residual = calcRpn(row.severity, row.occurrence2, row.detection2)

  const isClosed = (row.action_status ?? '').toUpperCase() === 'CLOSED'
  const rpnCurrent = isClosed ? residual.rpn : current.rpn
  const oxdCurrent = isClosed ? residual.doVal : current.doVal

  return {
    rpn: current.rpn ?? null,
    oxd: current.doVal ?? null,
    rpn2: residual.rpn ?? null,
    oxd2: residual.doVal ?? null,
    rpn_current: rpnCurrent ?? null,
    oxd_current: oxdCurrent ?? null,
  }
}

