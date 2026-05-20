import type { SupabaseClient } from '@supabase/supabase-js'
import { cellKey, defaultColor } from '@/features/settings/risk-matrix/matrix-config'
import type { RiskColor } from '@/features/settings/risk-matrix/matrix-colors'
import { riskColorForMatrixCell } from '@/lib/risk-engine'
import {
  fetchProjectSiteDepartments,
  fetchProjectsUserContext,
  fetchProjectsWithRevision,
  fetchRiskMatrixCells,
  fetchRiskMatrixConfig,
} from '@/features/projects/projects-service'
import { clampInt, normalizeProjectText } from '@/features/projects/utils'
import { collectPfmeaCurrentOpenRisks, toReportNumber } from '@/features/reports/pfmea-report-risk-utils'
import { fetchCurrentPfmeaRowsForReportProjects } from '@/features/reports/report-current-pfmea-rows'
import { buildOpenReportProjectScope, normalizeReportOptionList } from '@/features/reports/report-project-scope'
import type { RpnMatrixCellSummary, RpnMatrixFilters, RpnMatrixProject, RpnMatrixProjectColorCounts, RpnMatrixReportData } from './types'

function emptyColorCounts(): Record<RiskColor, number> {
  return { green: 0, orange: 0, red: 0, yellow: 0 }
}

function colorForCell(
  severity: number,
  doValue: number,
  params: Pick<RpnMatrixReportData, 'matrixMode' | 'riskMatrixCells' | 'thresholds'>
): RiskColor {
  return riskColorForMatrixCell(
    severity,
    doValue,
    params.matrixMode,
    params.thresholds,
    params.riskMatrixCells,
    defaultColor
  ) as RiskColor
}

export async function fetchRpnMatrixReportData(
  supabase: SupabaseClient,
  userId: string,
  filters: RpnMatrixFilters
): Promise<RpnMatrixReportData> {
  const userCtx = await fetchProjectsUserContext(supabase, userId)
  const [projects, siteDeptData, matrixConfig, riskMatrixCells] = await Promise.all([
    fetchProjectsWithRevision(supabase, userCtx.orgId),
    fetchProjectSiteDepartments(supabase, userCtx.orgId),
    fetchRiskMatrixConfig(supabase, userCtx.orgId),
    fetchRiskMatrixCells(supabase, { orgId: userCtx.orgId }),
  ])

  const allOpenProjects = buildOpenReportProjectScope(projects, siteDeptData.siteDeptMap, { departments: [], projectIds: [], sites: [] }) as RpnMatrixProject[]
  const projectOptions = buildOpenReportProjectScope(projects, siteDeptData.siteDeptMap, filters, { includeProjectFilter: false }) as RpnMatrixProject[]
  const filteredProjects = buildOpenReportProjectScope(projects, siteDeptData.siteDeptMap, filters) as RpnMatrixProject[]
  const projectColorCounts = new Map<string, RpnMatrixProjectColorCounts>(
    filteredProjects.map((project) => [
      project.id,
      {
        colorCounts: emptyColorCounts(),
        projectId: project.id,
        projectName: project.name,
        riskCount: 0,
      },
    ])
  )

  const departments = normalizeReportOptionList(allOpenProjects.map((project) => project.department))
  const sites = normalizeReportOptionList(allOpenProjects.map((project) => project.site))

  const cells: Record<string, RpnMatrixCellSummary> = {}
  const colorCounts = emptyColorCounts()
  let riskCount = 0
  let rpnSum = 0
  let rpnCount = 0

  if (filteredProjects.length) {
    const rows = await fetchCurrentPfmeaRowsForReportProjects(supabase, filteredProjects)
    for (const currentRisk of collectPfmeaCurrentOpenRisks(rows)) {
      const row = currentRisk.row
      const operationRelation = row.operations
      const operation = Array.isArray(operationRelation) ? operationRelation[0] : operationRelation
      const projectId = normalizeProjectText(operation?.project_id)
      if (!projectId) continue

      const severity = currentRisk.severity
      const doValue = currentRisk.doValue
      if (severity == null || doValue == null) continue

      const normalizedSeverity = clampInt(severity, 1, 10)
      const normalizedDoValue = clampInt(doValue, 1, 100)
      const key = cellKey(normalizedSeverity, normalizedDoValue)
      const rowRpn = toReportNumber(currentRisk.rpn) ?? normalizedSeverity * normalizedDoValue
      const color = colorForCell(normalizedSeverity, normalizedDoValue, {
        matrixMode: matrixConfig.mode,
        riskMatrixCells,
        thresholds: matrixConfig.thresholds,
      })

      const current = cells[key] ?? {
        averageRpn: null,
        color,
        count: 0,
        rpnMax: null,
        rpnMin: null,
      }

      current.count += 1
      current.color = color
      current.rpnMin = current.rpnMin == null ? rowRpn : Math.min(current.rpnMin, rowRpn)
      current.rpnMax = current.rpnMax == null ? rowRpn : Math.max(current.rpnMax, rowRpn)
      const previousSum = (current.averageRpn ?? 0) * (current.count - 1)
      current.averageRpn = Number(((previousSum + rowRpn) / current.count).toFixed(1))
      cells[key] = current

      colorCounts[color] += 1
      const projectBucket = projectColorCounts.get(projectId)
      if (projectBucket) {
        projectBucket.colorCounts[color] += 1
        projectBucket.riskCount += 1
      }
      riskCount += 1
      rpnSum += rowRpn
      rpnCount += 1
    }
  }

  return {
    cells,
    departments,
    filters,
    matrixMode: matrixConfig.mode,
    projectColorCounts: Array.from(projectColorCounts.values()).sort((left, right) => left.projectName.localeCompare(right.projectName, undefined, { sensitivity: 'base' })),
    projectOptions,
    projects: filteredProjects,
    riskMatrixCells,
    sites,
    summary: {
      averageRpn: rpnCount ? Number((rpnSum / rpnCount).toFixed(1)) : null,
      colorCounts,
      openProjectCount: filteredProjects.length,
      riskCount,
    },
    thresholds: matrixConfig.thresholds,
  }
}
