'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { SettingsActionColumnHeader, SettingsFilterColumnHeader, SettingsHiddenColumnHeader } from '@/features/settings/column-filter-header'
import type { ProjectsColumnKey, ProjectsSortState } from './use-projects-table-state'
import { projectsTableHeaderStyle } from './view-styles'

type ColumnVisibility = Record<ProjectsColumnKey, boolean>

type ProjectsTableHeaderProps = {
  deptOptionsMerged: string[]
  hiddenColumnHeaderStyle: CSSProperties
  hiddenColumns: ColumnVisibility
  processOptionsMerged: string[]
  productCellOptionsMerged: string[]
  revisionOptionsMerged: string[]
  selectedDepts: string[]
  selectedProcessNames: string[]
  selectedProductCells: string[]
  selectedRevisions: string[]
  selectedSites: string[]
  selectedStatuses: string[]
  setHiddenColumns: Dispatch<SetStateAction<ColumnVisibility>>
  setSelectedDepts: (values: string[]) => void
  setSelectedProcessNames: (values: string[]) => void
  setSelectedProductCells: (values: string[]) => void
  setSelectedRevisions: (values: string[]) => void
  setSelectedSites: (values: string[]) => void
  setSelectedStatuses: (values: string[]) => void
  setSortState: Dispatch<SetStateAction<ProjectsSortState>>
  siteOptionsMerged: string[]
  statusOptionsMerged: string[]
}

function headerStyle(hidden: boolean, hiddenStyle: CSSProperties, align: 'center' | 'left' = 'center') {
  if (hidden) return hiddenStyle
  return {
    ...projectsTableHeaderStyle,
    textAlign: align,
  }
}

export function ProjectsTableHeader({
  deptOptionsMerged,
  hiddenColumnHeaderStyle,
  hiddenColumns,
  processOptionsMerged,
  productCellOptionsMerged,
  revisionOptionsMerged,
  selectedDepts,
  selectedProcessNames,
  selectedProductCells,
  selectedRevisions,
  selectedSites,
  selectedStatuses,
  setHiddenColumns,
  setSelectedDepts,
  setSelectedProcessNames,
  setSelectedProductCells,
  setSelectedRevisions,
  setSelectedSites,
  setSelectedStatuses,
  setSortState,
  siteOptionsMerged,
  statusOptionsMerged,
}: ProjectsTableHeaderProps) {
  return (
    <thead>
      <tr>
        <th style={headerStyle(hiddenColumns.process, hiddenColumnHeaderStyle, 'left')}>
          {hiddenColumns.process ? (
            <SettingsHiddenColumnHeader label="Process name" onShow={() => setHiddenColumns((current) => ({ ...current, process: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Process name"
              values={processOptionsMerged}
              selectedValues={selectedProcessNames}
              onApplyValues={setSelectedProcessNames}
              onSort={(direction) => setSortState({ column: 'process', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, process: true }))}
            />
          )}
        </th>
        <th style={headerStyle(hiddenColumns.site, hiddenColumnHeaderStyle)}>
          {hiddenColumns.site ? (
            <SettingsHiddenColumnHeader label="Site" onShow={() => setHiddenColumns((current) => ({ ...current, site: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Site"
              values={siteOptionsMerged}
              selectedValues={selectedSites}
              onApplyValues={setSelectedSites}
              onSort={(direction) => setSortState({ column: 'site', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, site: true }))}
            />
          )}
        </th>
        <th style={headerStyle(hiddenColumns.department, hiddenColumnHeaderStyle)}>
          {hiddenColumns.department ? (
            <SettingsHiddenColumnHeader label="Department" onShow={() => setHiddenColumns((current) => ({ ...current, department: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Department"
              values={deptOptionsMerged}
              selectedValues={selectedDepts}
              onApplyValues={setSelectedDepts}
              onSort={(direction) => setSortState({ column: 'department', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, department: true }))}
            />
          )}
        </th>
        <th style={headerStyle(hiddenColumns.products, hiddenColumnHeaderStyle)}>
          {hiddenColumns.products ? (
            <SettingsHiddenColumnHeader label="Products" onShow={() => setHiddenColumns((current) => ({ ...current, products: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Products"
              values={productCellOptionsMerged}
              selectedValues={selectedProductCells}
              onApplyValues={setSelectedProductCells}
              onSort={(direction) => setSortState({ column: 'products', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, products: true }))}
            />
          )}
        </th>
        <th style={headerStyle(hiddenColumns.avgRpn, hiddenColumnHeaderStyle)}>
          {hiddenColumns.avgRpn ? (
            <SettingsHiddenColumnHeader label="Avg RPN" onShow={() => setHiddenColumns((current) => ({ ...current, avgRpn: false }))} />
          ) : (
            <SettingsActionColumnHeader
              label="Avg RPN"
              onSort={(direction) => setSortState({ column: 'avgRpn', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, avgRpn: true }))}
            />
          )}
        </th>
        <th style={headerStyle(hiddenColumns.risks, hiddenColumnHeaderStyle)}>
          {hiddenColumns.risks ? (
            <SettingsHiddenColumnHeader label="Risks" onShow={() => setHiddenColumns((current) => ({ ...current, risks: false }))} />
          ) : (
            <SettingsActionColumnHeader
              label="Risks"
              onSort={(direction) => setSortState({ column: 'risks', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, risks: true }))}
            />
          )}
        </th>
        <th style={headerStyle(hiddenColumns.updated, hiddenColumnHeaderStyle)}>
          {hiddenColumns.updated ? (
            <SettingsHiddenColumnHeader label="Updated" onShow={() => setHiddenColumns((current) => ({ ...current, updated: false }))} />
          ) : (
            <SettingsActionColumnHeader
              label="Updated"
              onSort={(direction) => setSortState({ column: 'updated', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, updated: true }))}
            />
          )}
        </th>
        <th style={headerStyle(hiddenColumns.revision, hiddenColumnHeaderStyle)}>
          {hiddenColumns.revision ? (
            <SettingsHiddenColumnHeader label="Revision" onShow={() => setHiddenColumns((current) => ({ ...current, revision: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Revision"
              values={revisionOptionsMerged}
              selectedValues={selectedRevisions}
              onApplyValues={setSelectedRevisions}
              onSort={(direction) => setSortState({ column: 'revision', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, revision: true }))}
            />
          )}
        </th>
        <th style={headerStyle(hiddenColumns.status, hiddenColumnHeaderStyle)}>
          {hiddenColumns.status ? (
            <SettingsHiddenColumnHeader label="Status" onShow={() => setHiddenColumns((current) => ({ ...current, status: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Status"
              values={statusOptionsMerged}
              selectedValues={selectedStatuses}
              onApplyValues={setSelectedStatuses}
              onSort={(direction) => setSortState({ column: 'status', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, status: true }))}
            />
          )}
        </th>
        <th style={{ ...projectsTableHeaderStyle, textAlign: 'center' }}>Actions</th>
      </tr>
    </thead>
  )
}
