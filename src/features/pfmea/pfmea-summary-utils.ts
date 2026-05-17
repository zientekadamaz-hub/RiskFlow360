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

type PfmeaSummaryRisk = {
  color: RiskColor | null
  rpn: number | null
}

type PfmeaSummaryRiskBucket = {
  currentRisk: PfmeaSummaryRisk | null
  bestClosedResidualRisk: PfmeaSummaryRisk | null
}

function hasFiniteRpn(value: number | null) {
  return value != null && Number.isFinite(value)
}

function buildSummaryRisk<T>(
  row: T,
  getRisk: (row: T) => PfmeaCurrentRiskMetrics,
  getRiskColorFor: (severity: number | null, occurrenceDetection: number | null) => RiskColor | null
): PfmeaSummaryRisk | null {
  const risk = getRisk(row)
  const color = getRiskColorFor(risk.sev, risk.doVal)
  const rpn = hasFiniteRpn(risk.rpn) ? risk.rpn : null
  if (!color && rpn == null) return null
  return { color, rpn }
}

export function computePfmeaAverageRpnSummary<T>(
  rows: T[],
  getCurrentRisk: (row: T) => PfmeaCurrentRiskMetrics,
  getRiskColorFor: (severity: number | null, occurrenceDetection: number | null) => RiskColor | null,
  getRiskColorForAverageRpn: (averageRpn: number) => RiskColor | null,
  options: {
    getRiskKey?: (row: T, index: number) => string | null
    getResidualRisk?: (row: T) => PfmeaCurrentRiskMetrics
    isClosedAction?: (row: T) => boolean
  } = {}
): PfmeaAverageRpnSummary {
  const buckets: Record<RiskColor, number> = { green: 0, yellow: 0, orange: 0, red: 0 }
  const currentRisksByKey = new Map<string, PfmeaSummaryRiskBucket>()

  rows.forEach((row, index) => {
    const currentRisk = buildSummaryRisk(row, getCurrentRisk, getRiskColorFor)
    const isClosedAction = options.isClosedAction?.(row) ?? false
    const residualRisk = isClosedAction && options.getResidualRisk
      ? buildSummaryRisk(row, options.getResidualRisk, getRiskColorFor)
      : null

    if (!currentRisk && !residualRisk) return

    const riskKey = options.getRiskKey?.(row, index) ?? `__row:${index}`
    const existing = currentRisksByKey.get(riskKey) ?? { currentRisk: null, bestClosedResidualRisk: null }

    if (currentRisk) {
      existing.currentRisk = currentRisk
    }

    if (residualRisk && residualRisk.rpn != null) {
      const currentBest = existing.bestClosedResidualRisk
      if (!currentBest || currentBest.rpn == null || residualRisk.rpn < currentBest.rpn) {
        existing.bestClosedResidualRisk = residualRisk
      }
    }

    currentRisksByKey.set(riskKey, existing)
  })

  const values: number[] = []
  for (const riskBucket of currentRisksByKey.values()) {
    const selectedRisk = riskBucket.bestClosedResidualRisk ?? riskBucket.currentRisk
    if (!selectedRisk) continue

    const { color, rpn } = selectedRisk
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
