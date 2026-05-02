import { asInt1to10 } from './pfmea-risk-utils'
import { normalizeClassValue, normalizePfmeaPcpValue } from './pfmea-value-utils'

export type PfmeaPcpDecisionRow = {
  pcp: unknown
  class?: string | null
  severity?: number | string | null
}

export type PfmeaPcpRiskColor = 'green' | 'yellow' | 'orange' | 'red'

export function getPfmeaPcpAutoReasons(row: PfmeaPcpDecisionRow, riskColor: PfmeaPcpRiskColor | null): string[] {
  const reasons: string[] = []
  const normalizedClass = normalizeClassValue(row.class)
  const severity = asInt1to10(row.severity)

  if (normalizedClass === 'SC' || normalizedClass === 'CC') {
    reasons.push(`CLASS = ${normalizedClass}`)
  }
  if (severity != null && severity >= 9) {
    reasons.push(`SEV = ${severity}`)
  }
  if (riskColor === 'orange' || riskColor === 'red') {
    reasons.push(`RPN = ${riskColor.toUpperCase()}`)
  }

  return reasons
}

export function isPfmeaSelectedForPcp(row: PfmeaPcpDecisionRow, riskColor: PfmeaPcpRiskColor | null) {
  const override = normalizePfmeaPcpValue(row.pcp)
  if (override != null) return override
  return getPfmeaPcpAutoReasons(row, riskColor).length > 0
}
