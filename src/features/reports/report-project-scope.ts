import type { ProjectRowDb } from '@/features/projects/types'
import { normalizeProjectText } from '@/features/projects/utils'
import { getReportRevisionId } from '@/features/reports/report-revision-utils'

export type ReportProjectFilters = {
  departments: string[]
  projectIds: string[]
  sites: string[]
}

export type ReportProjectScope = {
  department: string
  id: string
  name: string
  openRevisionId: string
  revisionId: string
  site: string
}

export function normalizeReportOptionList(values: string[]) {
  return Array.from(new Set(values.map(normalizeProjectText).filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

export function buildOpenReportProjectScope(
  projects: ProjectRowDb[],
  siteDeptMap: Record<string, { department: string; site: string }>,
  filters: ReportProjectFilters = { departments: [], projectIds: [], sites: [] },
  options: { includeProjectFilter?: boolean; requireRevision?: boolean } = {}
): ReportProjectScope[] {
  const siteFilter = new Set(filters.sites)
  const departmentFilter = new Set(filters.departments)
  const projectFilter = new Set(filters.projectIds)
  const includeProjectFilter = options.includeProjectFilter ?? true
  const requireRevision = options.requireRevision ?? false

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
    .filter((project) => project.id && project.name)
    .filter((project) => !requireRevision || !!project.revisionId)
    .filter((project) => !siteFilter.size || siteFilter.has(project.site))
    .filter((project) => !departmentFilter.size || departmentFilter.has(project.department))
    .filter((project) => !includeProjectFilter || !projectFilter.size || projectFilter.has(project.id))
}
