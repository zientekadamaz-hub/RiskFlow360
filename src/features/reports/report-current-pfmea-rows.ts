import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeProjectText } from '@/features/projects/utils'
import { PFMEA_REPORT_RISK_SELECT_WITH_REVISION } from '@/features/reports/pfmea-report-query'
import type { PfmeaReportRiskRow } from '@/features/reports/pfmea-report-risk-utils'
import type { ReportProjectScope } from '@/features/reports/report-project-scope'

export type ReportCurrentPfmeaRow = PfmeaReportRiskRow & {
  revision_id?: string | null
}

function rowProjectId(row: ReportCurrentPfmeaRow) {
  const operationRelation = row.operations
  const operation = Array.isArray(operationRelation) ? operationRelation[0] : operationRelation
  return normalizeProjectText(operation?.project_id)
}

function rowRevisionId(row: ReportCurrentPfmeaRow) {
  return normalizeProjectText(row.revision_id)
}

function latestRevisionRowsByProject(rows: ReportCurrentPfmeaRow[]) {
  const rowsByProjectRevision = new Map<string, ReportCurrentPfmeaRow[]>()
  const latestCreatedAtByKey = new Map<string, number>()

  for (const row of rows) {
    const projectId = rowProjectId(row)
    const revisionId = rowRevisionId(row)
    if (!projectId || !revisionId) continue

    const key = `${projectId}:${revisionId}`
    const group = rowsByProjectRevision.get(key) ?? []
    group.push(row)
    rowsByProjectRevision.set(key, group)

    const createdAtMs = new Date(row.created_at ?? 0).getTime()
    if (Number.isFinite(createdAtMs)) {
      latestCreatedAtByKey.set(key, Math.max(latestCreatedAtByKey.get(key) ?? 0, createdAtMs))
    }
  }

  const selectedKeyByProject = new Map<string, string>()
  for (const key of rowsByProjectRevision.keys()) {
    const projectId = key.split(':', 1)[0]
    const selectedKey = selectedKeyByProject.get(projectId)
    if (!selectedKey || (latestCreatedAtByKey.get(key) ?? 0) > (latestCreatedAtByKey.get(selectedKey) ?? 0)) {
      selectedKeyByProject.set(projectId, key)
    }
  }

  return Array.from(selectedKeyByProject.values()).flatMap((key) => rowsByProjectRevision.get(key) ?? [])
}

export async function fetchCurrentPfmeaRowsForReportProjects(
  supabase: SupabaseClient,
  projects: ReportProjectScope[]
) {
  const projectIds = Array.from(new Set(projects.map((project) => normalizeProjectText(project.id)).filter(Boolean)))
  const revisionIdByProject = new Map(
    projects
      .map((project) => [normalizeProjectText(project.id), normalizeProjectText(project.revisionId)] as const)
      .filter(([projectId, revisionId]) => projectId && revisionId)
  )
  const projectIdByRevision = new Map(Array.from(revisionIdByProject.entries()).map(([projectId, revisionId]) => [revisionId, projectId] as const))
  const revisionIds = Array.from(new Set(Array.from(revisionIdByProject.values()).filter(Boolean)))

  let currentRevisionRows: ReportCurrentPfmeaRow[] = []
  if (revisionIds.length > 0) {
    const { data, error } = await supabase
      .from('pfmea_rows')
      .select(PFMEA_REPORT_RISK_SELECT_WITH_REVISION)
      .in('revision_id', revisionIds)

    if (error) throw error
    currentRevisionRows = (data ?? []) as ReportCurrentPfmeaRow[]
  }

  const hasRowsByProject = new Set<string>()
  for (const row of currentRevisionRows) {
    const revisionId = rowRevisionId(row)
    const projectId = projectIdByRevision.get(revisionId) || rowProjectId(row)
    if (projectId) hasRowsByProject.add(projectId)
  }

  const missingProjectIds = projectIds.filter((projectId) => !hasRowsByProject.has(projectId))
  let fallbackRows: ReportCurrentPfmeaRow[] = []
  if (missingProjectIds.length > 0) {
    const { data, error } = await supabase
      .from('pfmea_rows')
      .select(PFMEA_REPORT_RISK_SELECT_WITH_REVISION)
      .in('operations.project_id', missingProjectIds)
      .order('created_at', { ascending: false })

    if (error) throw error
    fallbackRows = latestRevisionRowsByProject((data ?? []) as ReportCurrentPfmeaRow[])
  }

  return [...currentRevisionRows, ...fallbackRows]
}
