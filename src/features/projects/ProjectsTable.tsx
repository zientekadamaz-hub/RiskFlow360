'use client'

import Link from 'next/link'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { hasCustomerModuleAccess, type CustomerProjectAccessMap } from '@/lib/customer-access'
import {
  settingsCompactActionButtonStyle,
  SettingsTrashButton,
  settingsTableWrapStyle,
} from '@/features/settings/invitation-shell'
import { StandardSelect } from '@/features/settings/StandardSelect'
import { ProjectsEmptyState } from './ProjectsEmptyState'
import { ProjectsTableHeader } from './ProjectsTableHeader'
import { RevisionDetailsPopover } from './RevisionDetailsPopover'
import type { RevisionPopupData, RpnThresholds, UiProjectRow, UserCtx } from './types'
import type { ProjectsColumnKey, ProjectsSortState } from './use-projects-table-state'
import type { ProjectsTableLayoutColumnKey } from './table-layout'
import {
  formatAvgRpn,
  formatDatePL,
  normalizeProductInputs,
  normalizeProjectText as normalizeStr,
} from './utils'
import {
  projectsActionsStyle,
  projectsAvgRpnStyle,
  projectsCompactInputStyle,
  projectsProcessCellStyle,
  projectsSkeletonBarStyle,
  projectsStatusStyle,
  projectsTableCellStyle,
  projectsTableShellStyle,
  projectsTableStyle,
  projectsTableViewportScrollerStyle,
} from './view-styles'

type ColumnVisibility = Record<ProjectsColumnKey, boolean>
type StringSetter = Dispatch<SetStateAction<string>>
type StringListSetter = Dispatch<SetStateAction<string[]>>
type HiddenColumnsSetter = Dispatch<SetStateAction<ColumnVisibility>>
type SortSetter = Dispatch<SetStateAction<ProjectsSortState>>

type ProjectsTableProps = {
  canCreate: boolean
  canEdit: boolean
  creating: boolean
  createProject: () => void
  createRowOpen: boolean
  customerAccessMap: CustomerProjectAccessMap
  deptOptionsForEditSite: string[]
  deptOptionsForSite: string[]
  deptOptionsMerged: string[]
  editDept: string
  editProducts: string[]
  editProcess: string
  editSaving: boolean
  editSite: string
  editStatus: string
  editStatusOptions: string[]
  editingId: string | null
  filtered: UiProjectRow[]
  getColumnWidth: (key: ProjectsTableLayoutColumnKey) => string
  hiddenColumnCellStyle: CSSProperties
  hiddenColumnHeaderStyle: CSSProperties
  hiddenColumns: ColumnVisibility
  newDept: string
  newProcess: string
  newProducts: string[]
  newSite: string
  processOptionsMerged: string[]
  productCellOptionsMerged: string[]
  rawProjectCount: number
  requestDeleteProject: (projectId: string, processName: string) => void
  resetCreateRow: () => void
  resetEditRow: () => void
  revisionDataFor: (projectId: string) => RevisionPopupData
  revisionOptionsMerged: string[]
  rmRpn: RpnThresholds
  saveEdit: () => void
  selectedDepts: string[]
  selectedProcessNames: string[]
  selectedProductCells: string[]
  selectedRevisions: string[]
  selectedSites: string[]
  selectedStatuses: string[]
  setEditDept: StringSetter
  setEditProducts: StringListSetter
  setEditProcess: StringSetter
  setEditSite: StringSetter
  setEditStatus: StringSetter
  setHiddenColumns: HiddenColumnsSetter
  setNewDept: StringSetter
  setNewProcess: StringSetter
  setNewProducts: StringListSetter
  setNewSite: StringSetter
  setSelectedDepts: (values: string[]) => void
  setSelectedProcessNames: (values: string[]) => void
  setSelectedProductCells: (values: string[]) => void
  setSelectedRevisions: (values: string[]) => void
  setSelectedSites: (values: string[]) => void
  setSelectedStatuses: (values: string[]) => void
  setSortState: SortSetter
  siteOptionsMerged: string[]
  startEditRow: (row: UiProjectRow) => void
  statusOptionsMerged: string[]
  uiLoading: boolean
  userCtx: UserCtx
}

function ProductInputs({
  products,
  setProducts,
}: {
  products: string[]
  setProducts: StringListSetter
}) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {products.map((value, index) => (
        <input
          key={index}
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value
            setProducts((current) => {
              const next = [...current]
              next[index] = nextValue
              if (index === next.length - 1 && nextValue.trim()) next.push('')
              return normalizeProductInputs(next)
            })
          }}
          placeholder="Product name"
          style={projectsCompactInputStyle}
        />
      ))}
    </div>
  )
}

function disabledSelectStyle(enabled: boolean): CSSProperties {
  if (enabled) return projectsCompactInputStyle

  return {
    ...projectsCompactInputStyle,
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.45)',
  }
}

function toSelectOptions(values: string[]) {
  return values.map((value) => ({ label: value, value }))
}

function ProjectsTextCell({ value }: { value: string }) {
  return (
    <div
      style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
      title={value}
    >
      {value}
    </div>
  )
}

function projectCellStyle(hidden: boolean, hiddenStyle: CSSProperties, align: 'center' | 'left' = 'center') {
  if (hidden) return hiddenStyle
  return {
    ...projectsTableCellStyle,
    textAlign: align,
  }
}

export function ProjectsTable({
  canCreate,
  canEdit,
  creating,
  createProject,
  createRowOpen,
  customerAccessMap,
  deptOptionsForEditSite,
  deptOptionsForSite,
  deptOptionsMerged,
  editDept,
  editProducts,
  editProcess,
  editSaving,
  editSite,
  editStatus,
  editStatusOptions,
  editingId,
  filtered,
  getColumnWidth,
  hiddenColumnCellStyle,
  hiddenColumnHeaderStyle,
  hiddenColumns,
  newDept,
  newProcess,
  newProducts,
  newSite,
  processOptionsMerged,
  productCellOptionsMerged,
  rawProjectCount,
  requestDeleteProject,
  resetCreateRow,
  resetEditRow,
  revisionDataFor,
  revisionOptionsMerged,
  rmRpn,
  saveEdit,
  selectedDepts,
  selectedProcessNames,
  selectedProductCells,
  selectedRevisions,
  selectedSites,
  selectedStatuses,
  setEditDept,
  setEditProducts,
  setEditProcess,
  setEditSite,
  setEditStatus,
  setHiddenColumns,
  setNewDept,
  setNewProcess,
  setNewProducts,
  setNewSite,
  setSelectedDepts,
  setSelectedProcessNames,
  setSelectedProductCells,
  setSelectedRevisions,
  setSelectedSites,
  setSelectedStatuses,
  setSortState,
  siteOptionsMerged,
  startEditRow,
  statusOptionsMerged,
  uiLoading,
  userCtx,
}: ProjectsTableProps) {
  return (
    <div
      style={{
        ...projectsTableShellStyle,
        ...settingsTableWrapStyle,
        padding: 0,
      }}
    >
      <div style={{ ...projectsTableViewportScrollerStyle, flex: '1 1 auto' }}>
        <table style={projectsTableStyle}>
          <colgroup>
            <col style={{ width: getColumnWidth('process') }} />
            <col style={{ width: getColumnWidth('site') }} />
            <col style={{ width: getColumnWidth('department') }} />
            <col style={{ width: getColumnWidth('products') }} />
            <col style={{ width: getColumnWidth('avgRpn') }} />
            <col style={{ width: getColumnWidth('risks') }} />
            <col style={{ width: getColumnWidth('updated') }} />
            <col style={{ width: getColumnWidth('revision') }} />
            <col style={{ width: getColumnWidth('status') }} />
            <col style={{ width: getColumnWidth('actions') }} />
          </colgroup>
          <ProjectsTableHeader
            deptOptionsMerged={deptOptionsMerged}
            hiddenColumnHeaderStyle={hiddenColumnHeaderStyle}
            hiddenColumns={hiddenColumns}
            processOptionsMerged={processOptionsMerged}
            productCellOptionsMerged={productCellOptionsMerged}
            revisionOptionsMerged={revisionOptionsMerged}
            selectedDepts={selectedDepts}
            selectedProcessNames={selectedProcessNames}
            selectedProductCells={selectedProductCells}
            selectedRevisions={selectedRevisions}
            selectedSites={selectedSites}
            selectedStatuses={selectedStatuses}
            setHiddenColumns={setHiddenColumns}
            setSelectedDepts={setSelectedDepts}
            setSelectedProcessNames={setSelectedProcessNames}
            setSelectedProductCells={setSelectedProductCells}
            setSelectedRevisions={setSelectedRevisions}
            setSelectedSites={setSelectedSites}
            setSelectedStatuses={setSelectedStatuses}
            setSortState={setSortState}
            siteOptionsMerged={siteOptionsMerged}
            statusOptionsMerged={statusOptionsMerged}
          />

          <tbody>
            {uiLoading &&
              !createRowOpen &&
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={`loading-row-${index}`}>
                  <td colSpan={10} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={projectsSkeletonBarStyle} />
                  </td>
                </tr>
              ))}

            {createRowOpen && (
              <tr>
                <td style={hiddenColumns.process ? hiddenColumnCellStyle : projectsTableCellStyle}>
                  {hiddenColumns.process ? '' : (
                    <input
                      value={newProcess}
                      onChange={(event) => setNewProcess(event.target.value)}
                      placeholder="Process name"
                      style={projectsCompactInputStyle}
                    />
                  )}
                </td>
                <td style={projectCellStyle(hiddenColumns.site, hiddenColumnCellStyle)}>
                  {hiddenColumns.site ? '' : (
                    <StandardSelect
                      ariaLabel="Select site"
                      compact
                      onChange={setNewSite}
                      options={toSelectOptions(siteOptionsMerged)}
                      placeholder="Select..."
                      style={projectsCompactInputStyle}
                      value={newSite}
                    />
                  )}
                </td>
                <td style={projectCellStyle(hiddenColumns.department, hiddenColumnCellStyle)}>
                  {hiddenColumns.department ? '' : (
                    <StandardSelect
                      ariaLabel="Select department"
                      compact
                      disabled={!newSite}
                      onChange={setNewDept}
                      options={toSelectOptions(deptOptionsForSite)}
                      placeholder={newSite ? 'Select...' : 'Select site first'}
                      style={disabledSelectStyle(!!newSite)}
                      value={newDept}
                    />
                  )}
                </td>
                <td style={projectCellStyle(hiddenColumns.products, hiddenColumnCellStyle)}>
                  {hiddenColumns.products ? '' : <ProductInputs products={newProducts} setProducts={setNewProducts} />}
                </td>
                <td style={projectCellStyle(hiddenColumns.avgRpn, hiddenColumnCellStyle)}>{hiddenColumns.avgRpn ? '' : '-'}</td>
                <td style={projectCellStyle(hiddenColumns.risks, hiddenColumnCellStyle)}>{hiddenColumns.risks ? '' : 0}</td>
                <td style={projectCellStyle(hiddenColumns.updated, hiddenColumnCellStyle)}>{hiddenColumns.updated ? '' : '-'}</td>
                <td style={projectCellStyle(hiddenColumns.revision, hiddenColumnCellStyle)}>{hiddenColumns.revision ? '' : '-'}</td>
                <td style={projectCellStyle(hiddenColumns.status, hiddenColumnCellStyle)}>
                  {hiddenColumns.status ? '' : <span style={projectsStatusStyle('DRAFT')}>DRAFT</span>}
                </td>
                <td style={{ ...projectsTableCellStyle, textAlign: 'center' }}>
                  <div style={projectsActionsStyle}>
                    <button
                      onClick={createProject}
                      disabled={!canCreate || creating}
                      className="rf-button"
                      style={{ ...settingsCompactActionButtonStyle, opacity: canCreate && !creating ? 1 : 0.6 }}
                    >
                      {creating ? 'Creating...' : 'Create'}
                    </button>
                    <button onClick={resetCreateRow} className="rf-button" style={settingsCompactActionButtonStyle}>
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {!uiLoading && rawProjectCount === 0 && !createRowOpen && (
              <tr>
                <td colSpan={10} style={{ padding: 14 }}>
                  <ProjectsEmptyState isCustomer={userCtx.isCustomer} />
                </td>
              </tr>
            )}

            {filtered.map((project) =>
              editingId === project.id ? (
                <tr key={project.id}>
                  <td style={hiddenColumns.process ? hiddenColumnCellStyle : projectsTableCellStyle}>
                    {hiddenColumns.process ? '' : <input value={editProcess} onChange={(event) => setEditProcess(event.target.value)} style={projectsCompactInputStyle} />}
                  </td>
                  <td style={projectCellStyle(hiddenColumns.site, hiddenColumnCellStyle)}>
                    {hiddenColumns.site ? '' : (
                      <StandardSelect
                        ariaLabel="Select site"
                        compact
                        onChange={setEditSite}
                        options={toSelectOptions(siteOptionsMerged)}
                        placeholder="Select..."
                        style={projectsCompactInputStyle}
                        value={editSite}
                      />
                    )}
                  </td>
                  <td style={projectCellStyle(hiddenColumns.department, hiddenColumnCellStyle)}>
                    {hiddenColumns.department ? '' : (
                      <StandardSelect
                        ariaLabel="Select department"
                        compact
                        disabled={!editSite}
                        onChange={setEditDept}
                        options={toSelectOptions(deptOptionsForEditSite)}
                        placeholder={editSite ? 'Select...' : 'Select site first'}
                        style={disabledSelectStyle(!!editSite)}
                        value={editDept}
                      />
                    )}
                  </td>
                  <td style={projectCellStyle(hiddenColumns.products, hiddenColumnCellStyle)}>
                    {hiddenColumns.products ? '' : <ProductInputs products={editProducts} setProducts={setEditProducts} />}
                  </td>
                  <td style={projectCellStyle(hiddenColumns.avgRpn, hiddenColumnCellStyle)}>
                    {hiddenColumns.avgRpn ? '' : <span style={projectsAvgRpnStyle(project.avgRpn, rmRpn)}>{formatAvgRpn(project.avgRpn)}</span>}
                  </td>
                  <td style={projectCellStyle(hiddenColumns.risks, hiddenColumnCellStyle)}>{hiddenColumns.risks ? '' : project.riskCount}</td>
                  <td style={projectCellStyle(hiddenColumns.updated, hiddenColumnCellStyle)}>{hiddenColumns.updated ? '' : '-'}</td>
                  <td style={hiddenColumns.revision ? hiddenColumnCellStyle : { ...projectsTableCellStyle, overflow: 'visible', textAlign: 'center' }}>
                    {hiddenColumns.revision ? '' : <RevisionDetailsPopover projectId={project.id} revisionLabel={project.revision} popup={revisionDataFor(project.id)} />}
                  </td>
                  <td style={projectCellStyle(hiddenColumns.status, hiddenColumnCellStyle)}>
                    {hiddenColumns.status ? '' : (
                      <StandardSelect
                        ariaLabel="Select project status"
                        compact
                        disabled={normalizeStr(editStatus).toUpperCase() === 'DRAFT'}
                        onChange={setEditStatus}
                        options={toSelectOptions(editStatusOptions)}
                        placeholder="Select..."
                        style={disabledSelectStyle(normalizeStr(editStatus).toUpperCase() !== 'DRAFT')}
                        value={editStatus}
                      />
                    )}
                  </td>
                  <td style={{ ...projectsTableCellStyle, textAlign: 'center' }}>
                    <div style={projectsActionsStyle}>
                      <button
                        onClick={saveEdit}
                        disabled={!canEdit || editSaving}
                        className="rf-button"
                        style={{ ...settingsCompactActionButtonStyle, opacity: canEdit && !editSaving ? 1 : 0.6 }}
                      >
                        {editSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={resetEditRow} className="rf-button" style={settingsCompactActionButtonStyle}>
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr
                  key={project.id}
                  className={normalizeStr(project.status).toUpperCase() === 'OPEN' ? 'rowHover rowOpen' : 'rowHover'}
                  style={undefined}
                >
                  <td style={hiddenColumns.process ? hiddenColumnCellStyle : projectsTableCellStyle}>
                    {hiddenColumns.process ? '' : (
                      <div style={projectsProcessCellStyle} title={project.process}>
                        {project.process}
                      </div>
                    )}
                  </td>
                  <td style={projectCellStyle(hiddenColumns.site, hiddenColumnCellStyle)}>
                    {hiddenColumns.site ? '' : <ProjectsTextCell value={project.site} />}
                  </td>
                  <td style={projectCellStyle(hiddenColumns.department, hiddenColumnCellStyle)}>
                    {hiddenColumns.department ? '' : <ProjectsTextCell value={project.department} />}
                  </td>
                  <td style={hiddenColumns.products ? hiddenColumnCellStyle : { ...projectsTableCellStyle, color: 'rgba(255,255,255,0.68)', fontSize: 11, textAlign: 'center' }}>
                    {hiddenColumns.products ? '' : project.products}
                  </td>
                  <td style={projectCellStyle(hiddenColumns.avgRpn, hiddenColumnCellStyle)}>
                    {hiddenColumns.avgRpn ? '' : <span style={projectsAvgRpnStyle(project.avgRpn, rmRpn)}>{formatAvgRpn(project.avgRpn)}</span>}
                  </td>
                  <td style={projectCellStyle(hiddenColumns.risks, hiddenColumnCellStyle)}>{hiddenColumns.risks ? '' : project.riskCount}</td>
                  <td style={projectCellStyle(hiddenColumns.updated, hiddenColumnCellStyle)}>{hiddenColumns.updated ? '' : formatDatePL(project.updated)}</td>
                  <td style={hiddenColumns.revision ? hiddenColumnCellStyle : { ...projectsTableCellStyle, overflow: 'visible', textAlign: 'center' }}>
                    {hiddenColumns.revision ? '' : <RevisionDetailsPopover projectId={project.id} revisionLabel={project.revision} popup={revisionDataFor(project.id)} />}
                  </td>
                  <td style={projectCellStyle(hiddenColumns.status, hiddenColumnCellStyle)}>
                    {hiddenColumns.status ? '' : <span style={projectsStatusStyle(project.status)}>{project.status}</span>}
                  </td>

                  <td style={{ ...projectsTableCellStyle, textAlign: 'center' }}>
                    <div style={projectsActionsStyle}>
                      {!userCtx.isCustomer || hasCustomerModuleAccess(customerAccessMap, project.id, 'PFD') ? (
                        <Link href={`/pfd?project=${project.id}`} className="rf-button" style={settingsCompactActionButtonStyle} title="Open PFD">
                          PFD
                        </Link>
                      ) : null}
                      {!userCtx.isCustomer || hasCustomerModuleAccess(customerAccessMap, project.id, 'PFMEA') ? (
                        <Link href={`/pfmea?project=${project.id}`} className="rf-button" style={settingsCompactActionButtonStyle} title="Open PFMEA">
                          PFMEA
                        </Link>
                      ) : null}
                      {!userCtx.isCustomer || hasCustomerModuleAccess(customerAccessMap, project.id, 'PCP') ? (
                        <Link href={`/pcp?project=${project.id}`} className="rf-button" style={settingsCompactActionButtonStyle} title="Open PCP">
                          PCP
                        </Link>
                      ) : null}

                      {userCtx.isChampion && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 14 }}>
                          <button onClick={() => startEditRow(project)} className="rf-button" style={settingsCompactActionButtonStyle}>
                            Edit
                          </button>
                          <SettingsTrashButton
                            onClick={() => requestDeleteProject(project.id, project.process)}
                            title="Delete process"
                            ariaLabel="Delete process"
                          />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
