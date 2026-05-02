export type ProjectsTableColumnKey =
  | 'process'
  | 'site'
  | 'department'
  | 'products'
  | 'avgRpn'
  | 'risks'
  | 'updated'
  | 'revision'
  | 'status'

export type ProjectsTableLayoutColumnKey = ProjectsTableColumnKey | 'actions'

export const PROJECT_COLUMN_BASE_WIDTHS: Record<ProjectsTableLayoutColumnKey, number> = {
  process: 160,
  site: 100,
  department: 100,
  products: 100,
  avgRpn: 65.6757,
  risks: 65.6757,
  updated: 80.2793,
  revision: 58.3784,
  status: 65.6757,
  actions: 204.3152,
}

export const HIDDEN_COLUMN_WIDTH_PX = 34
export const PROJECT_TOTAL_BASE_WIDTH = Object.values(PROJECT_COLUMN_BASE_WIDTHS).reduce((sum, value) => sum + value, 0)

export function getProjectBaseColumnWidthPercent(key: ProjectsTableLayoutColumnKey) {
  return `${((PROJECT_COLUMN_BASE_WIDTHS[key] / PROJECT_TOTAL_BASE_WIDTH) * 100).toFixed(4)}%`
}

export function getProjectResponsiveColumnWidth(
  hiddenColumns: Partial<Record<ProjectsTableColumnKey, boolean>>,
  key: ProjectsTableLayoutColumnKey
) {
  if (key !== 'actions' && hiddenColumns[key]) {
    return `${((HIDDEN_COLUMN_WIDTH_PX / PROJECT_TOTAL_BASE_WIDTH) * 100).toFixed(4)}%`
  }

  let hiddenBaseWidthTotal = 0
  let hiddenColumnCount = 0

  for (const columnKey of Object.keys(hiddenColumns) as ProjectsTableColumnKey[]) {
    if (!hiddenColumns[columnKey]) continue
    hiddenColumnCount += 1
    hiddenBaseWidthTotal += PROJECT_COLUMN_BASE_WIDTHS[columnKey]
  }

  const visibleColumnWidthTotal = PROJECT_TOTAL_BASE_WIDTH - hiddenBaseWidthTotal
  const hiddenSlotTotal = hiddenColumnCount * HIDDEN_COLUMN_WIDTH_PX
  const freedWidth = Math.max(0, hiddenBaseWidthTotal - hiddenSlotTotal)
  const adjustedWidth =
    PROJECT_COLUMN_BASE_WIDTHS[key] +
    (visibleColumnWidthTotal > 0 ? (PROJECT_COLUMN_BASE_WIDTHS[key] / visibleColumnWidthTotal) * freedWidth : 0)

  return `${((adjustedWidth / PROJECT_TOTAL_BASE_WIDTH) * 100).toFixed(4)}%`
}
