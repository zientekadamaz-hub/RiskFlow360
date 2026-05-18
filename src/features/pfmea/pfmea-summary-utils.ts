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

export type PfmeaSummaryRiskKeyRow = {
  id: string
  action_plan_group_id?: string | null
  operation_id?: string | null
  operations?: {
    id?: string | null
  } | null
}

export type PfmeaSummaryRiskKeyHierarchy = {
  causeBlockKey?: string | null
}

type PfmeaSummaryRisk = {
  color: RiskColor | null
  rpn: number | null
}

type PfmeaSummaryRiskBucket = {
  currentRisk: PfmeaSummaryRisk | null
  bestClosedResidualRisk: PfmeaSummaryRisk | null
}

type PfmeaSummaryCurrentEntry = {
  key: string
  risk: PfmeaSummaryRisk
}

function hasFiniteRpn(value: number | null) {
  return value != null && Number.isFinite(value)
}

export function getPfmeaSummaryRiskKey(
  row: PfmeaSummaryRiskKeyRow,
  index: number,
  hierarchy?: PfmeaSummaryRiskKeyHierarchy | null
) {
  const operationId = row.operation_id || row.operations?.id || 'operation'
  const causeBlockKey = (hierarchy?.causeBlockKey ?? '').trim()
  if (causeBlockKey) return `${operationId}:cause:${causeBlockKey}`

  const groupId = (row.action_plan_group_id ?? '').trim()
  if (groupId) return `${operationId}:group:${groupId}`

  return row.id || `__row:${index}`
}

function buildSummaryRisk<T>(
  row: T,
  getRisk: (row: T) => PfmeaCurrentRiskMetrics,
  getRiskColorFor: (severity: number | null, occurrenceDetection: number | null) => RiskColor | null,
  getRiskColorForRpn?: (rpn: number | null) => RiskColor | null
): PfmeaSummaryRisk | null {
  const risk = getRisk(row)
  const rpn = hasFiniteRpn(risk.rpn) ? risk.rpn : null
  const color = getRiskColorForRpn?.(rpn) ?? getRiskColorFor(risk.sev, risk.doVal)
  if (!color && rpn == null) return null
  return { color, rpn }
}

export function computePfmeaAverageRpnSummary<T>(
  rows: T[],
  getCurrentRisk: (row: T) => PfmeaCurrentRiskMetrics,
  getRiskColorFor: (severity: number | null, occurrenceDetection: number | null) => RiskColor | null,
  getRiskColorForAverageRpn: (averageRpn: number) => RiskColor | null,
  options: {
    countCurrentRowsIndividually?: boolean
    getRiskKey?: (row: T, index: number) => string | null
    getResidualRisk?: (row: T) => PfmeaCurrentRiskMetrics
    getRiskColorForRpn?: (rpn: number | null) => RiskColor | null
    isClosedAction?: (row: T) => boolean
  } = {}
): PfmeaAverageRpnSummary {
  const buckets: Record<RiskColor, number> = { green: 0, yellow: 0, orange: 0, red: 0 }
  const currentRisksByKey = new Map<string, PfmeaSummaryRiskBucket>()
  const currentRiskEntries: PfmeaSummaryCurrentEntry[] = []
  const bestClosedResidualRiskByKey = new Map<string, PfmeaSummaryRisk>()

  rows.forEach((row, index) => {
    const currentRisk = buildSummaryRisk(row, getCurrentRisk, getRiskColorFor, options.getRiskColorForRpn)
    const isClosedAction = options.isClosedAction?.(row) ?? false
    const residualRisk = isClosedAction && options.getResidualRisk
      ? buildSummaryRisk(row, options.getResidualRisk, getRiskColorFor, options.getRiskColorForRpn)
      : null

    if (!currentRisk && !residualRisk) return

    const riskKey = options.getRiskKey?.(row, index) ?? `__row:${index}`
    if (options.countCurrentRowsIndividually) {
      if (currentRisk) {
        currentRiskEntries.push({ key: riskKey, risk: currentRisk })
      }

      if (residualRisk && residualRisk.rpn != null) {
        const currentBest = bestClosedResidualRiskByKey.get(riskKey)
        if (!currentBest || currentBest.rpn == null || residualRisk.rpn < currentBest.rpn) {
          bestClosedResidualRiskByKey.set(riskKey, residualRisk)
        }
      }
      return
    }

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
  if (options.countCurrentRowsIndividually) {
    for (const selectedRisk of bestClosedResidualRiskByKey.values()) {
      const { color, rpn } = selectedRisk
      if (color) buckets[color] += 1
      if (rpn != null) values.push(rpn)
    }

    for (const entry of currentRiskEntries) {
      if (bestClosedResidualRiskByKey.has(entry.key)) continue
      const { color, rpn } = entry.risk
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
