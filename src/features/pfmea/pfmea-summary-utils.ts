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
  getRiskColorForAverageRpn: (averageRpn: number) => RiskColor | null,
  options: {
    getRiskKey?: (row: T, index: number) => string | null
  } = {}
): PfmeaAverageRpnSummary {
  const buckets: Record<RiskColor, number> = { green: 0, yellow: 0, orange: 0, red: 0 }
  const currentRisksByKey = new Map<string, { color: RiskColor | null; rpn: number | null }>()

  rows.forEach((row, index) => {
    const currentRisk = getCurrentRisk(row)
    const color = getRiskColorFor(currentRisk.sev, currentRisk.doVal)
    const hasRpn = currentRisk.rpn != null && Number.isFinite(currentRisk.rpn)
    if (!color && !hasRpn) return

    const riskKey = options.getRiskKey?.(row, index) ?? `__row:${index}`
    currentRisksByKey.set(riskKey, {
      color,
      rpn: hasRpn ? currentRisk.rpn : null,
    })
  })

  const values: number[] = []
  for (const currentRisk of currentRisksByKey.values()) {
    const { color, rpn } = currentRisk
    if (color) buckets[color] += 1
    if (rpn != null) values.push(rpn)
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
