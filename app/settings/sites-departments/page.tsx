'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import type { CSSProperties } from 'react'
import {
  SettingsBanner,
  SettingsConfirmDialog,
  SettingsPageShell,
  SettingsSection,
  SettingsTrashButton,
  SettingsSummaryGrid,
  SettingsSummaryTile,
  getSettingsTableColumnWidths,
  settingsCompactActionButtonStyle,
  settingsCompactPrimaryButtonStyle,
  settingsFrameStyle,
  settingsHiddenTableColumnWidthPx,
  settingsInlineStatusStyle,
  settingsTableCellStyle,
  settingsTableWrapStyle,
} from '@/components/rf-ui'
import {
  projectsActionsStyle,
  projectsCompactInputStyle,
  PROJECTS_PROCESS_ACCENT,
  projectsProcessCellStyle,
  projectsStatusStyle,
  projectsSummaryValueStyle,
  projectsTableCellStyle,
  projectsTableHeaderStyle,
  projectsTableShellStyle,
  projectsTableStyle,
  projectsTableViewportScrollerStyle,
} from '@/features/projects/view-styles'
import {
  deleteSiteDepartmentsForSite,
  fetchSiteDepartmentContext,
  replaceSiteDepartmentsForSite,
  type SiteDeptRow,
  updateSiteDepartmentsActiveState,
} from '@/features/settings/site-departments-service'
import {
  BASE_SITE_DEPARTMENT_COLUMN_WIDTHS,
  DEFAULT_SITE_DEPARTMENT_HIDDEN_COLUMNS,
  departmentNames,
  getActiveSitesCount,
  getDisplayedSiteDepartmentRows,
  getSiteDepartmentFilterOptions,
  normalizeDepartmentInputs,
  normalizeText,
  statusLabel,
  toUiRows,
  uniqueList,
  type BlockedActionState,
  type DeleteConfirmState,
  type DepartmentInputRow,
  type SitesDepartmentsColumnKey,
  type SitesDepartmentsHiddenColumns,
  type SitesDepartmentsSortState,
  type UiSiteRow,
} from '@/features/settings/site-departments-page-model'
import { SitesDepartmentsTableHeader } from '@/features/settings/site-departments-table-header'
import { toUserErrorMessage } from '@/lib/error-utils'

const SESSION_RETRY_COUNT = 8
const SESSION_RETRY_DELAY_MS = 250

const halfColumnInputStyle: CSSProperties = {
  ...projectsCompactInputStyle,
  width: '50%',
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function hasAuthCookie() {
  if (typeof document === 'undefined') return false
  return document.cookie
    .split(';')
    .map((cookie) => cookie.trim().split('=')[0])
    .some((name) => name.startsWith('sb-') && name.includes('auth-token'))
}

async function getSessionUser() {
  for (let attempt = 0; attempt < SESSION_RETRY_COUNT; attempt += 1) {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user ?? null
    if (user) return user
    if (!hasAuthCookie()) return null

    if (attempt === 2 || attempt === 5) {
      try {
        await supabase.auth.refreshSession()
      } catch {}
    }

    await delay(SESSION_RETRY_DELAY_MS)
  }

  return null
}

export default function SettingsSitesDepartmentsPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [rows, setRows] = useState<SiteDeptRow[]>([])
  const [uiRows, setUiRows] = useState<UiSiteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<DeleteConfirmState>(null)
  const [confirmDeleteError, setConfirmDeleteError] = useState<string | null>(null)
  const [blockedAction, setBlockedAction] = useState<BlockedActionState>(null)
  const [hiddenColumns, setHiddenColumns] = useState<SitesDepartmentsHiddenColumns>(DEFAULT_SITE_DEPARTMENT_HIDDEN_COLUMNS)
  const [selectedDepartments, setSelectedDepartments] = useState<string[] | null>(null)
  const [selectedSites, setSelectedSites] = useState<string[] | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<string[] | null>(null)
  const [selectedUsage, setSelectedUsage] = useState<string[] | null>(null)
  const [sortState, setSortState] = useState<SitesDepartmentsSortState>({ column: 'site', direction: 'asc' })

  const hasOrg = useMemo(() => !!orgId, [orgId])
  const activeSitesCount = useMemo(() => getActiveSitesCount(uiRows), [uiRows])
  const { departmentOptions, siteOptions, statusOptions, usageOptions } = useMemo(() => getSiteDepartmentFilterOptions(uiRows), [uiRows])
  const displayedRows = useMemo(
    () =>
      getDisplayedSiteDepartmentRows(
        uiRows,
        {
          selectedDepartments,
          selectedSites,
          selectedStatuses,
          selectedUsage,
        },
        sortState
      ),
    [selectedDepartments, selectedSites, selectedStatuses, selectedUsage, sortState, uiRows]
  )
  const columnWidths = useMemo(() => {
    return getSettingsTableColumnWidths<SitesDepartmentsColumnKey>({
      baseWidths: BASE_SITE_DEPARTMENT_COLUMN_WIDTHS,
      hiddenColumns,
    })
  }, [hiddenColumns])
  const hiddenCellStyle: CSSProperties = {
    ...projectsTableCellStyle,
    padding: '0 6px',
    width: settingsHiddenTableColumnWidthPx,
  }
  const hiddenHeaderStyle: CSSProperties = {
    ...projectsTableHeaderStyle,
    padding: '0 6px',
    textAlign: 'center',
    width: settingsHiddenTableColumnWidthPx,
  }

  async function load(foreground = true) {
    if (foreground) setLoading(true)
    setErr(null)

    const user = await getSessionUser()
    if (!user) {
      setErr('No signed-in user.')
      setLoading(false)
      return
    }

    try {
      const context = await fetchSiteDepartmentContext(supabase, user.id)
      setOrgId(context.organizationId)
      setRows(context.rows)
      setUiRows(toUiRows(context.rows))
    } catch (error) {
      setErr(toUserErrorMessage(error, 'Could not load sites and departments.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(true)
  }, [])

  function addUiRow() {
    const next: UiSiteRow = { key: `new-${Date.now()}`, site: '', departments: [], active: true, projectCount: 0, used: false }
    setUiRows((prev) => [next, ...prev])
  }

  function removeUiRow(key: string) {
    setUiRows((prev) => prev.filter((row) => row.key !== key))
  }

  async function saveSiteRow(originalSite: string | null, site: string, departments: string[]) {
    if (!orgId) return

    const siteName = normalizeText(site)
    const departmentList = uniqueList(departments)

    if (!siteName) {
      setErr('Site name is required.')
      return
    }

    if (!departmentList.length) {
      setErr('Add at least one department for the site.')
      return
    }

    setSaving(true)
    setErr(null)

    try {
      await replaceSiteDepartmentsForSite(supabase, orgId, originalSite, siteName, departmentList)
      await load(false)
    } catch (error) {
      setErr(toUserErrorMessage(error, 'Could not save sites and departments.'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteSite(site: string) {
    if (!orgId) return

    setSaving(true)
    setErr(null)
    setConfirmDeleteError(null)

    try {
      await deleteSiteDepartmentsForSite(supabase, orgId, site)
      setConfirmDelete(null)
      await load(false)
    } catch (error) {
      setConfirmDeleteError(toUserErrorMessage(error, 'Could not delete site.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleSiteActive(site: string, active: boolean) {
    if (!orgId) return

    setSaving(true)
    setErr(null)

    try {
      await updateSiteDepartmentsActiveState(supabase, orgId, site, active)
      setRows((prev) => prev.map((row) => (row.site === site ? { ...row, active } : row)))
      setUiRows((prev) => prev.map((row) => (row.site === site ? { ...row, active } : row)))
    } catch (error) {
      setErr(toUserErrorMessage(error, 'Could not update site status.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SettingsPageShell title="Sites & Departments" subtitle="Loading organization sites and departments.">
        <SettingsSection style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>Loading sites and departments...</div>
        </SettingsSection>
      </SettingsPageShell>
    )
  }

  return (
    <>
      <SettingsPageShell
        title="Sites & Departments"
        titleStyle={{ color: PROJECTS_PROCESS_ACCENT }}
        subtitle="Define and maintain the sites and departments available for project assignment."
        summary={
          <div style={{ width: '100%', maxWidth: 390, marginLeft: 'auto' }}>
            <SettingsSummaryGrid columns={3}>
              <SettingsSummaryTile label="Sites" value={uiRows.length} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
              <SettingsSummaryTile label="Active sites" value={activeSitesCount} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
              <SettingsSummaryTile label="Departments" value={rows.length} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
            </SettingsSummaryGrid>
          </div>
        }
      >
        {err ? (
          <SettingsBanner tone="error">
            <b>Error:</b> {err}
          </SettingsBanner>
        ) : null}

        <div style={{ ...settingsFrameStyle, marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={addUiRow}
            disabled={!hasOrg || saving}
            className="rf-button"
            style={{ ...settingsCompactPrimaryButtonStyle, opacity: hasOrg && !saving ? 1 : 0.6 }}
          >
            Add site
          </button>
        </div>

        <div style={{ ...settingsFrameStyle, marginTop: 12, minHeight: 0 }}>
          <div
            style={{
              ...projectsTableShellStyle,
              ...settingsTableWrapStyle,
              padding: 0,
              background: 'rgba(255,255,255,0.08)',
            }}
          >
            <div style={projectsTableViewportScrollerStyle}>
              <table style={projectsTableStyle}>
                <colgroup>
                  <col style={{ width: columnWidths.site }} />
                  <col style={{ width: columnWidths.departments }} />
                  <col style={{ width: columnWidths.status }} />
                  <col style={{ width: columnWidths.usage }} />
                  <col style={{ width: columnWidths.actions }} />
                </colgroup>
                <SitesDepartmentsTableHeader
                  departmentOptions={departmentOptions}
                  hiddenColumns={hiddenColumns}
                  hiddenHeaderStyle={hiddenHeaderStyle}
                  selectedDepartments={selectedDepartments ?? departmentOptions}
                  selectedSites={selectedSites ?? siteOptions}
                  selectedStatuses={selectedStatuses ?? statusOptions}
                  selectedUsage={selectedUsage ?? usageOptions}
                  setHiddenColumns={setHiddenColumns}
                  setSelectedDepartments={setSelectedDepartments}
                  setSelectedSites={setSelectedSites}
                  setSelectedStatuses={setSelectedStatuses}
                  setSelectedUsage={setSelectedUsage}
                  setSortState={setSortState}
                  siteOptions={siteOptions}
                  statusOptions={statusOptions}
                  usageOptions={usageOptions}
                />
                <tbody>
                  {uiRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={settingsTableCellStyle}>
                        No sites defined.
                      </td>
                    </tr>
                  ) : displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={settingsTableCellStyle}>
                        No sites match the current filters.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row) => (
                      <SiteDeptRowItem
                        key={`${row.key}:${departmentNames(row).join('|')}:${row.active ? '1' : '0'}:${row.projectCount}`}
                        hiddenCellStyle={hiddenCellStyle}
                        hiddenColumns={hiddenColumns}
                        row={row}
                        onDeleteRequest={(site) => {
                          const target = uiRows.find((entry) => entry.site === site)
                          if (target?.used) {
                            setBlockedAction({ action: 'delete', site })
                            return
                          }
                          setConfirmDeleteError(null)
                          setConfirmDelete({ site, used: false })
                        }}
                        onRemove={removeUiRow}
                        onSave={saveSiteRow}
                        onToggleActive={toggleSiteActive}
                        saving={saving}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SettingsPageShell>

      <SettingsConfirmDialog
        open={!!confirmDelete}
        title="Delete site"
        body={
          <>
            Are you sure you want to delete <b>{confirmDelete?.site ?? '-'}</b> and all assigned departments?
          </>
        }
        warning={confirmDeleteError ?? 'Data will be permanently removed.'}
        busy={saving}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        hideConfirm={!!confirmDeleteError}
        onCancel={() => {
          if (saving) return
          setConfirmDelete(null)
          setConfirmDeleteError(null)
        }}
        onConfirm={() => (confirmDelete ? deleteSite(confirmDelete.site) : undefined)}
      />

      <SettingsConfirmDialog
        open={!!blockedAction}
        title="Site cannot be deleted"
        body={
          <>
            <b>{blockedAction?.site ?? '-'}</b> is assigned to existing projects.
          </>
        }
        warning="This site/department is used by existing projects and cannot be deleted. Reassign projects first."
        cancelLabel="Cancel"
        hideConfirm
        onCancel={() => setBlockedAction(null)}
        onConfirm={() => undefined}
      />
    </>
  )
}

function SiteDeptRowItem({
  hiddenCellStyle,
  hiddenColumns,
  row,
  onDeleteRequest,
  onRemove,
  onSave,
  onToggleActive,
  saving,
}: {
  hiddenCellStyle: CSSProperties
  hiddenColumns: SitesDepartmentsHiddenColumns
  row: UiSiteRow
  onDeleteRequest: (site: string) => void
  onRemove: (key: string) => void
  onSave: (originalSite: string | null, site: string, departments: string[]) => Promise<void>
  onToggleActive: (site: string, active: boolean) => Promise<void>
  saving: boolean
}) {
  const [edit, setEdit] = useState(row.site.trim().length === 0)
  const [site, setSite] = useState(row.site)
  const [departmentInputs, setDepartmentInputs] = useState<DepartmentInputRow[]>(() => {
    const values = row.departments.length
      ? [
          ...row.departments.map((department) => ({
            originalName: department.name,
            projectCount: department.projectCount,
            used: department.used,
            value: department.name,
          })),
          { originalName: null, projectCount: 0, used: false, value: '' },
        ]
      : [{ originalName: null, projectCount: 0, used: false, value: '' }]
    return normalizeDepartmentInputs(values)
  })
  const [busy, setBusy] = useState(false)

  async function save() {
    if (busy || saving) return

    setBusy(true)
    await onSave(row.site || null, site, uniqueList(departmentInputs.map((department) => department.value)))
    setBusy(false)
    setEdit(false)
  }

  return (
    <tr className="rowHover">
      <td style={hiddenColumns.site ? hiddenCellStyle : projectsTableCellStyle}>
        {hiddenColumns.site ? null : edit ? (
          <input
            value={site}
            onChange={(event) => setSite(event.target.value)}
            placeholder="Site name"
            readOnly={row.used}
            style={{
              ...halfColumnInputStyle,
              opacity: row.used ? 0.72 : 1,
              cursor: row.used ? 'not-allowed' : 'text',
            }}
            title={row.used ? 'Site name is locked because this site is assigned to existing projects.' : undefined}
          />
        ) : (
          <div style={projectsProcessCellStyle}>{row.site}</div>
        )}
      </td>
      <td style={hiddenColumns.departments ? hiddenCellStyle : projectsTableCellStyle}>
        {hiddenColumns.departments ? null : edit ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {departmentInputs.map((value, index) => (
              <div key={`${row.key}-department-${index}`} style={{ display: 'grid', gridTemplateColumns: value.used ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)', gap: 8, alignItems: 'center' }}>
                <input
                  value={value.value}
                  onChange={(event) => {
                    if (value.used) return
                    const nextValue = event.target.value
                    setDepartmentInputs((current) => {
                      const next = [...current]
                      next[index] = { ...next[index], value: nextValue }
                      if (index === next.length - 1 && nextValue.trim()) {
                        next.push({ originalName: null, projectCount: 0, used: false, value: '' })
                      }
                      return normalizeDepartmentInputs(next)
                    })
                  }}
                  placeholder="Department name"
                  readOnly={value.used}
                  style={{
                    ...halfColumnInputStyle,
                    opacity: value.used ? 0.72 : 1,
                    cursor: value.used ? 'not-allowed' : 'text',
                  }}
                  title={value.used ? 'This department is assigned to existing projects and cannot be changed or removed.' : undefined}
                />
                {value.used ? (
                  <span style={{ ...settingsInlineStatusStyle('pending'), fontSize: 11 }}>
                    USED ({value.projectCount})
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: 11 }}>
            {departmentNames(row).join(', ') || '-'}
          </div>
        )}
      </td>
      <td style={hiddenColumns.status ? hiddenCellStyle : projectsTableCellStyle}>
        {hiddenColumns.status ? null : edit ? (
          <span style={projectsStatusStyle('DRAFT')}>DRAFT</span>
        ) : (
          <span style={settingsInlineStatusStyle(statusLabel(row))}>{statusLabel(row)}</span>
        )}
      </td>
      <td style={hiddenColumns.usage ? hiddenCellStyle : projectsTableCellStyle}>
        {hiddenColumns.usage ? null : (
          <span style={settingsInlineStatusStyle(row.used ? 'pending' : 'inactive')}>
            {row.used ? `USED (${row.projectCount})` : 'UNUSED'}
          </span>
        )}
      </td>
      <td style={projectsTableCellStyle}>
        <div style={projectsActionsStyle}>
          {edit ? (
            <>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy || saving}
                className="rf-button"
                style={{ ...settingsCompactPrimaryButtonStyle, opacity: busy || saving ? 0.6 : 1 }}
              >
                {busy ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!row.site) onRemove(row.key)
                  else setEdit(false)
                }}
                disabled={busy || saving}
                className="rf-button"
                style={settingsCompactActionButtonStyle}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void onToggleActive(row.site, !row.active)}
                disabled={saving}
                className="rf-button"
                style={{ ...settingsCompactActionButtonStyle, opacity: saving ? 0.6 : 1 }}
              >
                {row.active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={() => setEdit(true)}
                className="rf-button"
                style={settingsCompactActionButtonStyle}
              >
                Edit
              </button>
              <SettingsTrashButton onClick={() => onDeleteRequest(row.site)} title="Delete site" ariaLabel={`Delete ${row.site}`} />
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
