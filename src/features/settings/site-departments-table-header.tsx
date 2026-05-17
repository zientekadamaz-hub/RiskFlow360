import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import {
  SettingsActionColumnHeader,
  SettingsFilterColumnHeader,
  SettingsHiddenColumnHeader,
} from '@/features/settings/column-filter-header'
import { projectsTableHeaderStyle } from '@/features/projects/view-styles'
import type { SitesDepartmentsHiddenColumns, SitesDepartmentsSortState } from './site-departments-page-model'

type SitesDepartmentsTableHeaderProps = {
  departmentOptions: string[]
  hiddenColumns: SitesDepartmentsHiddenColumns
  hiddenHeaderStyle: CSSProperties
  selectedDepartments: string[]
  selectedSites: string[]
  selectedStatuses: string[]
  selectedUsage: string[]
  setHiddenColumns: Dispatch<SetStateAction<SitesDepartmentsHiddenColumns>>
  setSelectedDepartments: (values: string[] | null) => void
  setSelectedSites: (values: string[] | null) => void
  setSelectedStatuses: (values: string[] | null) => void
  setSelectedUsage: (values: string[] | null) => void
  setSortState: Dispatch<SetStateAction<SitesDepartmentsSortState>>
  siteOptions: string[]
  statusOptions: string[]
  usageOptions: string[]
}

export function SitesDepartmentsTableHeader({
  departmentOptions,
  hiddenColumns,
  hiddenHeaderStyle,
  selectedDepartments,
  selectedSites,
  selectedStatuses,
  selectedUsage,
  setHiddenColumns,
  setSelectedDepartments,
  setSelectedSites,
  setSelectedStatuses,
  setSelectedUsage,
  setSortState,
  siteOptions,
  statusOptions,
  usageOptions,
}: SitesDepartmentsTableHeaderProps) {
  return (
    <thead>
      <tr>
        <th style={hiddenColumns.site ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.site ? (
            <SettingsHiddenColumnHeader label="Site" onShow={() => setHiddenColumns((current) => ({ ...current, site: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Site"
              values={siteOptions}
              selectedValues={selectedSites}
              onApplyValues={setSelectedSites}
              onSort={(direction) => setSortState({ column: 'site', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, site: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.departments ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.departments ? (
            <SettingsHiddenColumnHeader label="Departments" onShow={() => setHiddenColumns((current) => ({ ...current, departments: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Departments"
              values={departmentOptions}
              selectedValues={selectedDepartments}
              onApplyValues={setSelectedDepartments}
              onSort={(direction) => setSortState({ column: 'departments', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, departments: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.status ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.status ? (
            <SettingsHiddenColumnHeader label="Status" onShow={() => setHiddenColumns((current) => ({ ...current, status: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Status"
              values={statusOptions}
              selectedValues={selectedStatuses}
              onApplyValues={setSelectedStatuses}
              onSort={(direction) => setSortState({ column: 'status', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, status: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.usage ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.usage ? (
            <SettingsHiddenColumnHeader label="Used" onShow={() => setHiddenColumns((current) => ({ ...current, usage: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Used"
              values={usageOptions}
              selectedValues={selectedUsage}
              onApplyValues={setSelectedUsage}
              onSort={(direction) => setSortState({ column: 'usage', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, usage: true }))}
            />
          )}
        </th>
        <th style={projectsTableHeaderStyle}>
          <SettingsActionColumnHeader label="Actions" onSort={(direction) => setSortState({ column: 'site', direction })} />
        </th>
      </tr>
    </thead>
  )
}
