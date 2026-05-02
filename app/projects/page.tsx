'use client'

import React, { useCallback, useMemo } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import { ProjectsSummaryTiles } from '@/features/projects/ProjectsSummaryTiles'
import { ProjectsTable } from '@/features/projects/ProjectsTable'
import { ProjectsToolbar } from '@/features/projects/ProjectsToolbar'
import { useProjectsData } from '@/features/projects/use-projects-data'
import { useProjectsEditor } from '@/features/projects/use-projects-editor'
import { useProjectsPfmeaStats } from '@/features/projects/use-projects-pfmea-stats'
import { useProjectsRevisionPopups } from '@/features/projects/use-projects-revision-popups'
import { useProjectsRiskSummary } from '@/features/projects/use-projects-risk-summary'
import { useProjectsTableState } from '@/features/projects/use-projects-table-state'
import {
  SettingsConfirmDialog,
  SettingsPageShell,
  settingsFrameStyle,
} from '@/components/rf-ui'
import type { UiProjectRow } from '@/features/projects/types'
import {
  formatAvgRpnInt,
  mapProjectsToUiRows,
  normalizeProjectText as normalizeStr,
} from '@/features/projects/utils'
import {
  projectsErrorBoxStyle,
  PROJECTS_PROCESS_ACCENT,
  projectsSubtitleStyle,
  projectsTableCellStyle,
  projectsTableHeaderStyle,
} from '@/features/projects/view-styles'
import {
  getProjectResponsiveColumnWidth,
  type ProjectsTableLayoutColumnKey,
} from '@/features/projects/table-layout'

type ProjectsLayoutColumnKey = ProjectsTableLayoutColumnKey

export default function ProjectsPage() {
  const {
    customerAccessMap,
    error,
    loading,
    rawProjects,
    refreshProjects,
    refreshing,
    setError,
    siteDeptMap,
    siteDeptRows,
    siteOptions,
    userCtx,
  } = useProjectsData()

  const editor = useProjectsEditor({
    rawProjects,
    refreshProjects,
    setError,
    siteDeptRows,
    supabase,
    userCtx,
  })

  const projectPfmeaStats = useProjectsPfmeaStats({ projects: rawProjects, supabase })
  const { revisionDataFor } = useProjectsRevisionPopups({ projects: rawProjects, supabase })

  const uiProjects = useMemo<UiProjectRow[]>(() => {
    return mapProjectsToUiRows(rawProjects, siteDeptMap, projectPfmeaStats)
  }, [rawProjects, siteDeptMap, projectPfmeaStats])

  const {
    deptOptionsMerged,
    filtered,
    filtersReady,
    hiddenColumns,
    openProjectsBySiteDept,
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
  } = useProjectsTableState({
    loading,
    siteDeptRows,
    siteOptions,
    uiProjects,
    userId: userCtx.userId,
  })

  const editStatusOptions = useMemo(() => {
    const current = normalizeStr(editor.editStatus).toUpperCase()
    if (current === 'DRAFT') return ['DRAFT']
    if (current === 'OPEN' || current === 'OBSOLETE') return ['OPEN', 'OBSOLETE']

    const base = ['DRAFT', 'OPEN', 'OBSOLETE']
    const options = new Set<string>(base)
    for (const status of statusOptionsMerged) {
      if (status) options.add(status)
    }
    return Array.from(options)
  }, [statusOptionsMerged, editor.editStatus])

  const { openRiskAvgRpn, riskColorCounts, riskCount, rmRpn } = useProjectsRiskSummary({
    filtersReady,
    loading,
    orgId: userCtx.orgId,
    openProjects: openProjectsBySiteDept,
  })

  const uiLoading = loading || !filtersReady
  const frame: React.CSSProperties = settingsFrameStyle

  const hiddenColumnCellStyle: React.CSSProperties = useMemo(
    () => ({
      ...projectsTableCellStyle,
      padding: '0 6px',
    }),
    []
  )

  const hiddenColumnHeaderStyle: React.CSSProperties = useMemo(
    () => ({
      ...projectsTableHeaderStyle,
      padding: '0 6px',
      textAlign: 'center',
    }),
    []
  )

  const getColumnWidth = useCallback(
    (key: ProjectsLayoutColumnKey) => getProjectResponsiveColumnWidth(hiddenColumns, key),
    [hiddenColumns]
  )

  return (
    <SettingsPageShell
      title="Projects List"
      titleStyle={{ color: PROJECTS_PROCESS_ACCENT }}
      subtitle={
        <span style={projectsSubtitleStyle}>
          Manage process records, review current revision status and open PFD / PFMEA / PCP modules for ongoing engineering work.
          {refreshing ? <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.78)' }}>Refreshing...</span> : null}
        </span>
      }
      summary={
        <ProjectsSummaryTiles
          openProjectsCount={openProjectsBySiteDept.length}
          riskCount={riskCount}
          averageRpnValue={openRiskAvgRpn}
          averageRpn={formatAvgRpnInt(openRiskAvgRpn)}
          averageRpnThresholds={rmRpn}
          riskColorCounts={riskColorCounts}
        />
      }
    >
      {error && (
        <div style={{ ...frame, marginTop: 8 }}>
          <div style={projectsErrorBoxStyle}>
            <b>Error:</b> {error}
          </div>
        </div>
      )}

      <div
        style={{
          ...frame,
          display: 'flex',
          flexDirection: 'column',
          marginBottom: 16,
          marginTop: 8,
          height: 'calc(100vh - 250px)',
          maxHeight: 'calc(100vh - 250px)',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <ProjectsToolbar
          canManageProjects={userCtx.canManageProjects}
          createRowOpen={editor.createRowOpen}
          hasOrganization={!!userCtx.orgId}
          onCreate={() => editor.setCreateRowOpen(true)}
        />

        <ProjectsTable
          canCreate={editor.canCreate}
          canEdit={editor.canEdit}
          creating={editor.creating}
          createProject={editor.createProject}
          createRowOpen={editor.createRowOpen}
          customerAccessMap={customerAccessMap}
          deptOptionsForEditSite={editor.deptOptionsForEditSite}
          deptOptionsForSite={editor.deptOptionsForSite}
          deptOptionsMerged={deptOptionsMerged}
          editDept={editor.editDept}
          editProducts={editor.editProducts}
          editProcess={editor.editProcess}
          editSaving={editor.editSaving}
          editSite={editor.editSite}
          editStatus={editor.editStatus}
          editStatusOptions={editStatusOptions}
          editingId={editor.editingId}
          filtered={filtered}
          getColumnWidth={getColumnWidth}
          hiddenColumnCellStyle={hiddenColumnCellStyle}
          hiddenColumnHeaderStyle={hiddenColumnHeaderStyle}
          hiddenColumns={hiddenColumns}
          newDept={editor.newDept}
          newProcess={editor.newProcess}
          newProducts={editor.newProducts}
          newSite={editor.newSite}
          processOptionsMerged={processOptionsMerged}
          productCellOptionsMerged={productCellOptionsMerged}
          rawProjectCount={rawProjects.length}
          requestDeleteProject={editor.requestDeleteProject}
          resetCreateRow={editor.resetCreateRow}
          resetEditRow={editor.resetEditRow}
          revisionDataFor={revisionDataFor}
          revisionOptionsMerged={revisionOptionsMerged}
          rmRpn={rmRpn}
          saveEdit={editor.saveEdit}
          selectedDepts={selectedDepts}
          selectedProcessNames={selectedProcessNames}
          selectedProductCells={selectedProductCells}
          selectedRevisions={selectedRevisions}
          selectedSites={selectedSites}
          selectedStatuses={selectedStatuses}
          setEditDept={editor.setEditDept}
          setEditProducts={editor.setEditProducts}
          setEditProcess={editor.setEditProcess}
          setEditSite={editor.setEditSite}
          setEditStatus={editor.setEditStatus}
          setHiddenColumns={setHiddenColumns}
          setNewDept={editor.setNewDept}
          setNewProcess={editor.setNewProcess}
          setNewProducts={editor.setNewProducts}
          setNewSite={editor.setNewSite}
          setSelectedDepts={setSelectedDepts}
          setSelectedProcessNames={setSelectedProcessNames}
          setSelectedProductCells={setSelectedProductCells}
          setSelectedRevisions={setSelectedRevisions}
          setSelectedSites={setSelectedSites}
          setSelectedStatuses={setSelectedStatuses}
          setSortState={setSortState}
          siteOptionsMerged={siteOptionsMerged}
          startEditRow={editor.startEditRow}
          statusOptionsMerged={statusOptionsMerged}
          uiLoading={uiLoading}
          userCtx={userCtx}
        />
      </div>

      <SettingsConfirmDialog
        open={!!editor.confirm}
        title={editor.confirm?.title ?? ''}
        body={editor.confirm?.body ?? ''}
        warning="Data will be permanently removed."
        busy={editor.confirmBusy}
        onCancel={() => editor.setConfirm(null)}
        onConfirm={editor.handleConfirmDelete}
      />
    </SettingsPageShell>
  )
}
