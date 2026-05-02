'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import {
  SettingsActionColumnHeader,
  SettingsFilterColumnHeader,
  SettingsHiddenColumnHeader,
} from '@/features/settings/column-filter-header'
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
} from '@/features/settings/invitation-shell'
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

type UiSiteRow = {
  key: string
  site: string
  departments: UiDepartmentRow[]
  active: boolean
  projectCount: number
  used: boolean
}

type UiDepartmentRow = {
  name: string
  projectCount: number
  used: boolean
}

type DepartmentInputRow = {
  originalName: string | null
  projectCount: number
  used: boolean
  value: string
}

type DeleteConfirmState = {
  site: string
  used: boolean
} | null

type BlockedActionState = {
  action: 'delete'
  site: string
} | null

type SitesDepartmentsColumnKey = 'departments' | 'site' | 'status' | 'usage'
type SitesDepartmentsLayoutColumnKey = SitesDepartmentsColumnKey | 'actions'
type SitesDepartmentsHiddenColumns = Record<SitesDepartmentsColumnKey, boolean>
type SitesDepartmentsSortState = {
  column: SitesDepartmentsColumnKey
  direction: 'asc' | 'desc'
} | null

const DEFAULT_HIDDEN_COLUMNS: SitesDepartmentsHiddenColumns = {
  departments: false,
  site: false,
  status: false,
  usage: false,
}

const BASE_COLUMN_WIDTHS: Record<SitesDepartmentsLayoutColumnKey, number> = {
  site: 200,
  departments: 360,
  status: 120,
  usage: 120,
  actions: 200,
}

const SESSION_RETRY_COUNT = 8
const SESSION_RETRY_DELAY_MS = 250

function normalizeText(value: string) {
  return value.trim()
}

function uniqueList(list: string[]) {
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

function toUiRows(list: SiteDeptRow[]): UiSiteRow[] {
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

function departmentNames(row: UiSiteRow) {
  return row.departments.map((department) => department.name)
}

function normalizeDepartmentInputs(values: DepartmentInputRow[]) {
  const next = values.map((item) => ({ ...item, value: item.value.trimStart() }))
  while (next.length > 1 && !next[next.length - 1]?.value.trim() && !next[next.length - 2]?.value.trim()) {
    next.pop()
  }
  if (next.length === 0) next.push({ originalName: null, projectCount: 0, used: false, value: '' })
  return next
}

function statusLabel(row: UiSiteRow) {
  return row.active ? 'ACTIVE' : 'INACTIVE'
}

function usageLabel(row: UiSiteRow) {
  return row.used ? 'USED' : 'UNUSED'
}

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
  const [hiddenColumns, setHiddenColumns] = useState<SitesDepartmentsHiddenColumns>(DEFAULT_HIDDEN_COLUMNS)
  const [selectedDepartments, setSelectedDepartments] = useState<string[] | null>(null)
  const [selectedSites, setSelectedSites] = useState<string[] | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<string[] | null>(null)
  const [selectedUsage, setSelectedUsage] = useState<string[] | null>(null)
  const [sortState, setSortState] = useState<SitesDepartmentsSortState>({ column: 'site', direction: 'asc' })

  const hasOrg = useMemo(() => !!orgId, [orgId])
  const activeSitesCount = useMemo(() => uiRows.filter((row) => row.active).length, [uiRows])
  const siteOptions = useMemo(() => uniqueList(uiRows.map((row) => row.site)).sort((a, b) => a.localeCompare(b)), [uiRows])
  const departmentOptions = useMemo(
    () => uniqueList(uiRows.flatMap((row) => departmentNames(row))).sort((a, b) => a.localeCompare(b)),
    [uiRows]
  )
  const statusOptions = useMemo(() => ['ACTIVE', 'INACTIVE'], [])
  const usageOptions = useMemo(() => ['USED', 'UNUSED'], [])
  const displayedRows = useMemo(() => {
    const siteSet = selectedSites === null ? null : new Set(selectedSites)
    const departmentSet = selectedDepartments === null ? null : new Set(selectedDepartments)
    const statusSet = selectedStatuses === null ? null : new Set(selectedStatuses)
    const usageSet = selectedUsage === null ? null : new Set(selectedUsage)

    const filtered = uiRows.filter((row) => {
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
  }, [selectedDepartments, selectedSites, selectedStatuses, selectedUsage, sortState, uiRows])
  const columnWidths = useMemo(() => {
    return getSettingsTableColumnWidths<SitesDepartmentsColumnKey>({
      baseWidths: BASE_COLUMN_WIDTHS,
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
      setErr(error instanceof Error ? error.message : 'Could not load sites and departments.')
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
      setErr(error instanceof Error ? error.message : 'Could not save sites and departments.')
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
      setConfirmDeleteError(error instanceof Error ? error.message : 'Could not delete site.')
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
      setErr(error instanceof Error ? error.message : 'Could not update site status.')
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

function SitesDepartmentsTableHeader({
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
}: {
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
}) {
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
          <SettingsActionColumnHeader
            label="Actions"
            onSort={(direction) => setSortState({ column: 'site', direction })}
          />
        </th>
      </tr>
    </thead>
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
