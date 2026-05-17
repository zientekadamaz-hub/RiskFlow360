import type { SiteDeptRow } from './site-departments-service'

export type UiSiteRow = {
  key: string
  site: string
  departments: UiDepartmentRow[]
  active: boolean
  projectCount: number
  used: boolean
}

export type UiDepartmentRow = {
  name: string
  projectCount: number
  used: boolean
}

export type DepartmentInputRow = {
  originalName: string | null
  projectCount: number
  used: boolean
  value: string
}

export type DeleteConfirmState = {
  site: string
  used: boolean
} | null

export type BlockedActionState = {
  action: 'delete'
  site: string
} | null

export type SitesDepartmentsColumnKey = 'departments' | 'site' | 'status' | 'usage'
export type SitesDepartmentsLayoutColumnKey = SitesDepartmentsColumnKey | 'actions'
export type SitesDepartmentsHiddenColumns = Record<SitesDepartmentsColumnKey, boolean>
export type SitesDepartmentsSortState = {
  column: SitesDepartmentsColumnKey
  direction: 'asc' | 'desc'
} | null

export type SitesDepartmentsFilterState = {
  selectedDepartments: string[] | null
  selectedSites: string[] | null
  selectedStatuses: string[] | null
  selectedUsage: string[] | null
}

export type SitesDepartmentsFilterOptions = {
  departmentOptions: string[]
  siteOptions: string[]
  statusOptions: string[]
  usageOptions: string[]
}

export const DEFAULT_SITE_DEPARTMENT_HIDDEN_COLUMNS: SitesDepartmentsHiddenColumns = {
  departments: false,
  site: false,
  status: false,
  usage: false,
}

export const BASE_SITE_DEPARTMENT_COLUMN_WIDTHS: Record<SitesDepartmentsLayoutColumnKey, number> = {
  site: 200,
  departments: 360,
  status: 120,
  usage: 120,
  actions: 200,
}

export const SITE_DEPARTMENT_STATUS_OPTIONS = ['ACTIVE', 'INACTIVE']
export const SITE_DEPARTMENT_USAGE_OPTIONS = ['USED', 'UNUSED']

export function normalizeText(value: string) {
  return value.trim()
}

export function uniqueList(list: string[]) {
  const seen = new Set<string>()
  const out: string[] = []

  list.forEach((value) => {
    const normalized = normalizeText(value)
    if (!normalized) return
    const key = normalized.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(normalized)
  })

  return out
}

export function toUiRows(list: SiteDeptRow[]): UiSiteRow[] {
  const bySite = new Map<string, { departments: Map<string, UiDepartmentRow>; activeAll: boolean; projectCount: number }>()

  list.forEach((row) => {
    const site = normalizeText(row.site)
    if (!site) return

    const department = normalizeText(row.department ?? '')
    const entry = bySite.get(site) ?? { departments: new Map<string, UiDepartmentRow>(), activeAll: true, projectCount: 0 }
    const projectCount = row.project_count ?? 0
    if (department) {
      const key = department.toLowerCase()
      const current = entry.departments.get(key)
      entry.departments.set(key, {
        name: current?.name ?? department,
        projectCount: (current?.projectCount ?? 0) + projectCount,
        used: (current?.projectCount ?? 0) + projectCount > 0,
      })
    }
    if (!row.active) entry.activeAll = false
    entry.projectCount += projectCount
    bySite.set(site, entry)
  })

  return Array.from(bySite.entries())
    .map(([site, data]) => ({
      key: site,
      site,
      departments: Array.from(data.departments.values()).sort((a, b) => a.name.localeCompare(b.name)),
      active: data.activeAll,
      projectCount: data.projectCount,
      used: data.projectCount > 0,
    }))
    .sort((a, b) => a.site.localeCompare(b.site))
}

export function departmentNames(row: UiSiteRow) {
  return row.departments.map((department) => department.name)
}

export function normalizeDepartmentInputs(values: DepartmentInputRow[]) {
  const next = values.map((item) => ({ ...item, value: item.value.trimStart() }))
  while (next.length > 1 && !next[next.length - 1]?.value.trim() && !next[next.length - 2]?.value.trim()) {
    next.pop()
  }
  if (next.length === 0) next.push({ originalName: null, projectCount: 0, used: false, value: '' })
  return next
}

export function statusLabel(row: UiSiteRow) {
  return row.active ? 'ACTIVE' : 'INACTIVE'
}

export function usageLabel(row: UiSiteRow) {
  return row.used ? 'USED' : 'UNUSED'
}

export function getActiveSitesCount(rows: UiSiteRow[]) {
  return rows.filter((row) => row.active).length
}

export function getSiteDepartmentFilterOptions(rows: UiSiteRow[]): SitesDepartmentsFilterOptions {
  return {
    departmentOptions: uniqueList(rows.flatMap((row) => departmentNames(row))).sort((a, b) => a.localeCompare(b)),
    siteOptions: uniqueList(rows.map((row) => row.site)).sort((a, b) => a.localeCompare(b)),
    statusOptions: SITE_DEPARTMENT_STATUS_OPTIONS,
    usageOptions: SITE_DEPARTMENT_USAGE_OPTIONS,
  }
}

export function getDisplayedSiteDepartmentRows(rows: UiSiteRow[], filters: SitesDepartmentsFilterState, sortState: SitesDepartmentsSortState) {
  const siteSet = filters.selectedSites === null ? null : new Set(filters.selectedSites)
  const departmentSet = filters.selectedDepartments === null ? null : new Set(filters.selectedDepartments)
  const statusSet = filters.selectedStatuses === null ? null : new Set(filters.selectedStatuses)
  const usageSet = filters.selectedUsage === null ? null : new Set(filters.selectedUsage)

  const filtered = rows.filter((row) => {
    const siteOk = siteSet === null ? true : siteSet.has(row.site)
    const departmentsOk = departmentSet === null ? true : row.departments.some((department) => departmentSet.has(department.name))
    const statusOk = statusSet === null ? true : statusSet.has(statusLabel(row))
    const usageOk = usageSet === null ? true : usageSet.has(usageLabel(row))
    return siteOk && departmentsOk && statusOk && usageOk
  })

  if (!sortState) return filtered

  return [...filtered].sort((left, right) => {
    let comparison = 0
    if (sortState.column === 'site') comparison = left.site.localeCompare(right.site, undefined, { sensitivity: 'base' })
    if (sortState.column === 'departments') {
      comparison = departmentNames(left).join(', ').localeCompare(departmentNames(right).join(', '), undefined, { sensitivity: 'base' })
    }
    if (sortState.column === 'status') comparison = statusLabel(left).localeCompare(statusLabel(right), undefined, { sensitivity: 'base' })
    if (sortState.column === 'usage') comparison = left.projectCount - right.projectCount
    return sortState.direction === 'asc' ? comparison : -comparison
  })
}
