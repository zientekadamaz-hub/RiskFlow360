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
import { PFMEA_REPORT_RISK_SELECT_WITH_REVISION } from '@/features/reports/pfmea-report-query'
import { getPfmeaReportRisk, toReportNumber, type PfmeaReportRiskRow } from '@/features/reports/pfmea-report-risk-utils'
import { getReportRevisionId } from '@/features/reports/report-revision-utils'
import type { RpnMatrixCellSummary, RpnMatrixFilters, RpnMatrixProject, RpnMatrixProjectColorCounts, RpnMatrixReportData } from './types'

function normalizeOptionList(values: string[]) {
  return Array.from(new Set(values.map(normalizeProjectText).filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

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

function buildProjectRows(
  projects: Awaited<ReturnType<typeof fetchProjectsWithRevision>>,
  siteDeptMap: Record<string, { department: string; site: string }>,
  filters: RpnMatrixFilters,
  options: { includeProjectFilter?: boolean } = {}
): RpnMatrixProject[] {
  const siteFilter = new Set(filters.sites)
  const departmentFilter = new Set(filters.departments)
  const projectFilter = new Set(filters.projectIds)
  const includeProjectFilter = options.includeProjectFilter ?? true

  return projects
    .filter((project) => normalizeProjectText(project.status).toUpperCase() === 'OPEN')
    .map((project) => {
      const siteDept = project.site_department_id ? siteDeptMap[project.site_department_id] : undefined
      return {
        department: normalizeProjectText(siteDept?.department),
        id: normalizeProjectText(project.id),
        name: normalizeProjectText(project.name),
        openRevisionId: normalizeProjectText(project.current_open_revision_id),
        revisionId: getReportRevisionId(project),
        site: normalizeProjectText(siteDept?.site),
      }
    })
    .filter((project) => project.id && project.revisionId)
    .filter((project) => !siteFilter.size || siteFilter.has(project.site))
    .filter((project) => !departmentFilter.size || departmentFilter.has(project.department))
    .filter((project) => !includeProjectFilter || !projectFilter.size || projectFilter.has(project.id))
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

  const allOpenProjects = buildProjectRows(projects, siteDeptData.siteDeptMap, { departments: [], projectIds: [], sites: [] })
  const projectOptions = buildProjectRows(projects, siteDeptData.siteDeptMap, filters, { includeProjectFilter: false })
  const filteredProjects = buildProjectRows(projects, siteDeptData.siteDeptMap, filters)
  const revisionIds = filteredProjects.map((project) => project.revisionId)
  const projectIdByRevision = new Map(filteredProjects.map((project) => [project.revisionId, project.id]))
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

  const departments = normalizeOptionList(allOpenProjects.map((project) => project.department))
  const sites = normalizeOptionList(allOpenProjects.map((project) => project.site))

  const cells: Record<string, RpnMatrixCellSummary> = {}
  const colorCounts = emptyColorCounts()
  let riskCount = 0
  let rpnSum = 0
  let rpnCount = 0

  if (revisionIds.length) {
    const { data, error } = await supabase
      .from('pfmea_rows')
      .select(PFMEA_REPORT_RISK_SELECT_WITH_REVISION)
      .in('revision_id', revisionIds)

    if (error) throw error

    for (const row of (data ?? []) as Array<PfmeaReportRiskRow & { revision_id?: string | null }>) {
      const projectId = projectIdByRevision.get(normalizeProjectText(row.revision_id))
      if (!projectId) continue

      const currentRisk = getPfmeaReportRisk(row)
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
