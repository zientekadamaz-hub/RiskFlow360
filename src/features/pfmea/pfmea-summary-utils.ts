import type { RiskColor } from './pfmea-risk-matrix-config'

export type PfmeaCurrentRiskMetrics = {
  sev: number | null
  doVal: number | null
  rpn: number | null
}

export type PfmeaAverageRpnSummary = {
  avg: number | null
  color: RiskColor | null
  count: number
  buckets: Record<RiskColor, number>
}

export function computePfmeaAverageRpnSummary<T>(
  rows: T[],
  getCurrentRisk: (row: T) => PfmeaCurrentRiskMetrics,
  getRiskColorFor: (severity: number | null, occurrenceDetection: number | null) => RiskColor | null,
  getRiskColorForAverageRpn: (averageRpn: number) => RiskColor | null
): PfmeaAverageRpnSummary {
  const buckets: Record<RiskColor, number> = { green: 0, yellow: 0, orange: 0, red: 0 }
  const values: number[] = []

  for (const row of rows) {
    const currentRisk = getCurrentRisk(row)
    const color = getRiskColorFor(currentRisk.sev, currentRisk.doVal)
    if (color) buckets[color] += 1
    if (currentRisk.rpn != null && Number.isFinite(currentRisk.rpn)) values.push(currentRisk.rpn)
  }

  if (values.length === 0) {
    return {
      avg: null,
      color: null,
      count: 0,
      buckets,
    }
  }

  const avg = values.reduce((acc, value) => acc + value, 0) / values.length
  const color = getRiskColorForAverageRpn(avg) ?? 'red'

  return { avg, color, count: values.length, buckets }
}
