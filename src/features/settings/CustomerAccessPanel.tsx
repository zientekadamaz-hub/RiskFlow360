'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import {
  SettingsBanner,
  SettingsConfirmDialog,
  SettingsSection,
  SettingsTableActions,
  SettingsTrashButton,
  getSettingsTableColumnWidths,
  settingsCompactActionButtonStyle,
  settingsCompactPrimaryButtonStyle,
  settingsFrameStyle,
  settingsHiddenTableColumnWidthPx,
  settingsProcessAccent,
  settingsSectionHeaderStyle,
  settingsSectionSubtitleStyle,
  settingsSectionTitleStyle,
  settingsTableCellStyle,
  settingsTableHeaderStyle,
  settingsTableStyle,
  settingsTableWrapStyle,
  settingsToolbarRowStyle,
} from '@/components/rf-ui'
import {
  SettingsFilterColumnHeader,
  SettingsHiddenColumnHeader,
} from '@/features/settings/column-filter-header'
import { StandardSelect } from '@/features/settings/StandardSelect'
import {
  projectsActionsStyle,
  projectsCompactInputStyle,
  projectsTableCellStyle,
  projectsTableViewportScrollerStyle,
} from '@/features/projects/view-styles'
import {
  fetchCustomerAccessGrants,
  fetchCustomerCandidates,
  fetchOrganizationProjects,
  setCustomerAccessGrant,
  type CustomerAccessGrantRow,
  type CustomerCandidateRow,
  type CustomerAccessProjectRow,
} from '@/features/settings/customer-access-service'

type CustomerModule = 'PFD' | 'PFMEA' | 'PCP'
type SortDirection = 'asc' | 'desc'
type GrantColumnKey = 'created' | 'customer' | 'pcp' | 'pfd' | 'pfmea' | 'project' | 'status'
type GrantLayoutColumnKey = GrantColumnKey | 'actions'
type GrantHiddenColumns = Record<GrantColumnKey, boolean>
type GrantSortState = { column: GrantColumnKey; direction: SortDirection }
export type CustomerAccessSummary = {
  customers: number
  grants: number
  projects: number
}

type CustomerProjectAccessRow = {
  key: string
  customer_user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  project_id: string
  project_name: string | null
  project_status: string | null
  created_at: string | null
  modules: Record<CustomerModule, boolean>
}

const MODULES: CustomerModule[] = ['PFMEA', 'PFD', 'PCP']
const SETTINGS_SECTION_PADDING = 14
const CHECKED_FILTER_VALUE = 'Checked'
const UNCHECKED_FILTER_VALUE = 'Unchecked'
const DEFAULT_GRANT_HIDDEN_COLUMNS: GrantHiddenColumns = {
  customer: false,
  created: false,
  pcp: false,
  pfd: false,
  pfmea: false,
  project: false,
  status: false,
}
const BASE_GRANT_COLUMN_WIDTHS: Record<GrantLayoutColumnKey, number> = {
  customer: 280,
  project: 280,
  status: 130,
  created: 170,
  pfmea: 92,
  pfd: 92,
  pcp: 92,
  actions: 150,
}

const customerMetaStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  color: 'rgba(255,255,255,0.68)',
}

const tableEmptyCellStyle: React.CSSProperties = {
  ...settingsTableCellStyle,
  color: 'rgba(255,255,255,0.68)',
}

const centeredHeaderStyle: React.CSSProperties = {
  ...settingsTableHeaderStyle,
  textAlign: 'center',
}

const accentValueStyle: React.CSSProperties = {
  color: settingsProcessAccent,
  fontWeight: 700,
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' })
  )
}

function customerLabel(row: CustomerCandidateRow) {
  const full = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()
  return full ? `${full} (${row.email ?? '-'})` : row.email ?? '-'
}

function compareNullableDate(left: string | null, right: string | null) {
  const leftTime = left ? new Date(left).getTime() : 0
  const rightTime = right ? new Date(right).getTime() : 0
  return (Number.isFinite(leftTime) ? leftTime : 0) - (Number.isFinite(rightTime) ? rightTime : 0)
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function grantCustomerLabel(row: Pick<CustomerAccessGrantRow, 'email' | 'first_name' | 'last_name'>) {
  const full = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()
  return full || row.email || '-'
}

function customerProjectKey(customerUserId: string, projectId: string) {
  return `${customerUserId}::${projectId}`
}

function accessRowModuleValue(row: CustomerProjectAccessRow, moduleName: CustomerModule) {
  return row.modules[moduleName] ? CHECKED_FILTER_VALUE : UNCHECKED_FILTER_VALUE
}

function accessRowLabel(row: CustomerProjectAccessRow) {
  return `${grantCustomerLabel(row)} / ${row.project_name ?? '-'}`
}

export function CustomerAccessPanel({
  organizationId,
  organizationName,
  canManage,
  refreshKey = 0,
  onSummaryChange,
}: {
  organizationId: string | null
  organizationName: string | null
  canManage: boolean
  refreshKey?: number
  onSummaryChange?: (summary: CustomerAccessSummary) => void
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerCandidateRow[]>([])
  const [projects, setProjects] = useState<CustomerAccessProjectRow[]>([])
  const [grants, setGrants] = useState<CustomerAccessGrantRow[]>([])

  const [createRowOpen, setCreateRowOpen] = useState(false)
  const [draftCustomerId, setDraftCustomerId] = useState('')
  const [draftProjectId, setDraftProjectId] = useState('')
  const [draftModules, setDraftModules] = useState<Record<CustomerModule, boolean>>({
    PFD: false,
    PFMEA: false,
    PCP: false,
  })
  const [grantHiddenColumns, setGrantHiddenColumns] = useState<GrantHiddenColumns>(DEFAULT_GRANT_HIDDEN_COLUMNS)
  const [grantSortState, setGrantSortState] = useState<GrantSortState>({ column: 'customer', direction: 'asc' })
  const [selectedGrantCustomers, setSelectedGrantCustomers] = useState<string[] | null>(null)
  const [selectedGrantProjects, setSelectedGrantProjects] = useState<string[] | null>(null)
  const [selectedGrantStatuses, setSelectedGrantStatuses] = useState<string[] | null>(null)
  const [selectedGrantCreatedDates, setSelectedGrantCreatedDates] = useState<string[] | null>(null)
  const [selectedGrantPfmea, setSelectedGrantPfmea] = useState<string[] | null>(null)
  const [selectedGrantPfd, setSelectedGrantPfd] = useState<string[] | null>(null)
  const [selectedGrantPcp, setSelectedGrantPcp] = useState<string[] | null>(null)
  const [rowBusyKey, setRowBusyKey] = useState<string | null>(null)
  const [rowToDelete, setRowToDelete] = useState<CustomerProjectAccessRow | null>(null)

  const activeGrants = useMemo(() => grants.filter((grant) => grant.active), [grants])

  const projectsById = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project]))
  }, [projects])

  const accessRows = useMemo(() => {
    const rows = new Map<string, CustomerProjectAccessRow>()

    for (const grant of activeGrants) {
      const key = customerProjectKey(grant.customer_user_id, grant.project_id)
      const existing = rows.get(key)
      const project = projectsById.get(grant.project_id)
      const row =
        existing ??
        {
          key,
          customer_user_id: grant.customer_user_id,
          email: grant.email,
          first_name: grant.first_name,
          last_name: grant.last_name,
          project_id: grant.project_id,
          project_name: grant.project_name,
          project_status: project?.status ?? null,
          created_at: grant.created_at,
          modules: { PFD: false, PFMEA: false, PCP: false },
        }

      row.project_status = project?.status ?? row.project_status
      row.created_at =
        compareNullableDate(row.created_at, grant.created_at) <= 0
          ? row.created_at
          : grant.created_at
      row.modules[grant.module] = true
      rows.set(key, row)
    }

    return Array.from(rows.values())
  }, [activeGrants, projectsById])

  const grantCustomerOptions = useMemo(() => uniqueSorted(accessRows.map(grantCustomerLabel)), [accessRows])
  const grantProjectOptions = useMemo(() => uniqueSorted(accessRows.map((row) => row.project_name ?? '-')), [accessRows])
  const grantStatusOptions = useMemo(() => uniqueSorted(accessRows.map((row) => (row.project_status ?? '-').toUpperCase())), [accessRows])
  const grantCreatedOptions = useMemo(() => uniqueSorted(accessRows.map((row) => formatDateTime(row.created_at))), [accessRows])
  const moduleFilterOptions = [CHECKED_FILTER_VALUE, UNCHECKED_FILTER_VALUE]

  const grantColumnWidths = useMemo(() => {
    return getSettingsTableColumnWidths<GrantColumnKey>({
      baseWidths: BASE_GRANT_COLUMN_WIDTHS,
      hiddenColumns: grantHiddenColumns,
    })
  }, [grantHiddenColumns])

  const hiddenCellStyle: React.CSSProperties = {
    ...settingsTableCellStyle,
    padding: '0 6px',
    width: settingsHiddenTableColumnWidthPx,
  }

  const hiddenHeaderStyle: React.CSSProperties = {
    ...settingsTableHeaderStyle,
    padding: '0 6px',
    textAlign: 'center',
    width: settingsHiddenTableColumnWidthPx,
  }

  const displayedGrants = useMemo(() => {
    const customerSet = selectedGrantCustomers === null ? null : new Set(selectedGrantCustomers)
    const projectSet = selectedGrantProjects === null ? null : new Set(selectedGrantProjects)
    const statusSet = selectedGrantStatuses === null ? null : new Set(selectedGrantStatuses)
    const createdSet = selectedGrantCreatedDates === null ? null : new Set(selectedGrantCreatedDates)
    const pfmeaSet = selectedGrantPfmea === null ? null : new Set(selectedGrantPfmea)
    const pfdSet = selectedGrantPfd === null ? null : new Set(selectedGrantPfd)
    const pcpSet = selectedGrantPcp === null ? null : new Set(selectedGrantPcp)

    const filtered = accessRows.filter((row) => {
      const customerOk = customerSet === null ? true : customerSet.has(grantCustomerLabel(row))
      const projectOk = projectSet === null ? true : projectSet.has(row.project_name ?? '-')
      const statusOk = statusSet === null ? true : statusSet.has((row.project_status ?? '-').toUpperCase())
      const createdOk = createdSet === null ? true : createdSet.has(formatDateTime(row.created_at))
      const pfmeaOk = pfmeaSet === null ? true : pfmeaSet.has(accessRowModuleValue(row, 'PFMEA'))
      const pfdOk = pfdSet === null ? true : pfdSet.has(accessRowModuleValue(row, 'PFD'))
      const pcpOk = pcpSet === null ? true : pcpSet.has(accessRowModuleValue(row, 'PCP'))
      return customerOk && projectOk && statusOk && createdOk && pfmeaOk && pfdOk && pcpOk
    })

    return [...filtered].sort((left, right) => {
      let comparison = 0
      if (grantSortState.column === 'created') comparison = compareNullableDate(left.created_at, right.created_at)
      else if (grantSortState.column === 'customer') comparison = grantCustomerLabel(left).localeCompare(grantCustomerLabel(right), undefined, { sensitivity: 'base' })
      else if (grantSortState.column === 'project') comparison = (left.project_name ?? '-').localeCompare(right.project_name ?? '-', undefined, { sensitivity: 'base' })
      else if (grantSortState.column === 'status') comparison = (left.project_status ?? '-').localeCompare(right.project_status ?? '-', undefined, { sensitivity: 'base' })
      else if (grantSortState.column === 'pfmea') comparison = Number(left.modules.PFMEA) - Number(right.modules.PFMEA)
      else if (grantSortState.column === 'pfd') comparison = Number(left.modules.PFD) - Number(right.modules.PFD)
      else comparison = Number(left.modules.PCP) - Number(right.modules.PCP)
      return grantSortState.direction === 'asc' ? comparison : -comparison
    })
  }, [accessRows, grantSortState, selectedGrantCreatedDates, selectedGrantCustomers, selectedGrantPcp, selectedGrantPfd, selectedGrantPfmea, selectedGrantProjects, selectedGrantStatuses])

  const summary = useMemo(
    () => ({
      customers: customers.length,
      grants: activeGrants.length,
      projects: projects.length,
    }),
    [activeGrants.length, customers.length, projects.length]
  )

  useEffect(() => {
    onSummaryChange?.(summary)
  }, [onSummaryChange, summary])

  const load = useCallback(async () => {
    if (!organizationId) {
      setCustomers([])
      setProjects([])
      setGrants([])
      setLoading(false)
      return
    }

    setLoading(true)
    setErr(null)

    try {
      const [customerRows, projectRows, grantRows] = await Promise.all([
        fetchCustomerCandidates(supabase, organizationId),
        fetchOrganizationProjects(supabase, organizationId),
        fetchCustomerAccessGrants(supabase, organizationId),
      ])

      setCustomers(customerRows)
      setProjects(projectRows)
      setGrants(grantRows)
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not load customer access data.')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  function cancelCreateRow() {
    setCreateRowOpen(false)
    setDraftCustomerId('')
    setDraftProjectId('')
    setDraftModules({ PFD: false, PFMEA: false, PCP: false })
  }

  async function saveCreateRow() {
    if (!organizationId || !draftCustomerId || !draftProjectId) {
      setErr('Select a customer and a project first.')
      return
    }

    const hasSelectedModule = MODULES.some((moduleName) => draftModules[moduleName])
    if (!hasSelectedModule) {
      setErr('Select at least one module.')
      return
    }

    const rowKey = customerProjectKey(draftCustomerId, draftProjectId)
    if (accessRows.some((row) => row.key === rowKey)) {
      setErr('This customer and project already have an access row. Update the module checkboxes in the existing row.')
      return
    }

    setSaving(true)
    setErr(null)

    try {
      for (const moduleName of MODULES) {
        const enabled = !!draftModules[moduleName]
        if (!enabled) continue

        await setCustomerAccessGrant(supabase, {
          organizationId,
          customerUserId: draftCustomerId,
          projectId: draftProjectId,
          module: moduleName,
          enabled,
        })
      }

      cancelCreateRow()
      await load()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not update customer access.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAccess(row: CustomerProjectAccessRow, moduleName: CustomerModule, enabled: boolean) {
    if (!organizationId) return

    const busyKey = `${row.key}::${moduleName}`
    setRowBusyKey(busyKey)
    setSaving(true)
    setErr(null)

    try {
      await setCustomerAccessGrant(supabase, {
        organizationId,
        customerUserId: row.customer_user_id,
        projectId: row.project_id,
        module: moduleName,
        enabled,
      })
      await load()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not update customer access.')
    } finally {
      setSaving(false)
      setRowBusyKey(null)
    }
  }

  async function deleteAccessRow() {
    if (!organizationId || !rowToDelete) return

    const row = rowToDelete
    setRowBusyKey(`${row.key}::delete`)
    setSaving(true)
    setErr(null)

    try {
      for (const moduleName of MODULES) {
        if (!row.modules[moduleName]) continue
        await setCustomerAccessGrant(supabase, {
          organizationId,
          customerUserId: row.customer_user_id,
          projectId: row.project_id,
          module: moduleName,
          enabled: false,
        })
      }

      setRowToDelete(null)
      await load()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not delete customer access.')
    } finally {
      setSaving(false)
      setRowBusyKey(null)
    }
  }

  if (!canManage) {
    return (
      <>
        <SettingsSection style={{ padding: SETTINGS_SECTION_PADDING }}>
          <div style={settingsSectionHeaderStyle}>
            <div>
              <div style={settingsSectionTitleStyle}>Customer access</div>
              <div style={settingsSectionSubtitleStyle}>
                Grant customers access only to the specific modules they should see in <b>{organizationName ?? 'the active organization'}</b>.
              </div>
            </div>
          </div>
        </SettingsSection>
        <SettingsBanner tone="error">
          <b>Access denied:</b> only the global admin or organization champion can manage customer access.
        </SettingsBanner>
      </>
    )
  }

  return (
    <>
      <div
        style={{
          ...settingsFrameStyle,
          marginTop: 12,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div style={settingsToolbarRowStyle}>
          <button
            type="button"
            onClick={() => {
              setErr(null)
              setGrantHiddenColumns(DEFAULT_GRANT_HIDDEN_COLUMNS)
              setCreateRowOpen(true)
            }}
            disabled={loading || saving || createRowOpen || customers.length === 0 || projects.length === 0}
            className="rf-button"
            style={{
              ...settingsCompactPrimaryButtonStyle,
              opacity: loading || saving || createRowOpen || customers.length === 0 || projects.length === 0 ? 0.6 : 1,
            }}
          >
            Add access
          </button>
        </div>

        <div style={settingsTableWrapStyle}>
          <div style={projectsTableViewportScrollerStyle}>
            <table style={settingsTableStyle}>
              <colgroup>
                <col style={{ width: grantColumnWidths.customer }} />
                <col style={{ width: grantColumnWidths.project }} />
                <col style={{ width: grantColumnWidths.status }} />
                <col style={{ width: grantColumnWidths.created }} />
                <col style={{ width: grantColumnWidths.pfmea }} />
                <col style={{ width: grantColumnWidths.pfd }} />
                <col style={{ width: grantColumnWidths.pcp }} />
                <col style={{ width: grantColumnWidths.actions }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={grantHiddenColumns.customer ? hiddenHeaderStyle : settingsTableHeaderStyle}>
                    {grantHiddenColumns.customer ? (
                      <SettingsHiddenColumnHeader label="Customer" onShow={() => setGrantHiddenColumns((current) => ({ ...current, customer: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="Customer"
                        values={grantCustomerOptions}
                        selectedValues={selectedGrantCustomers ?? grantCustomerOptions}
                        onApplyValues={setSelectedGrantCustomers}
                        onSort={(direction) => setGrantSortState({ column: 'customer', direction })}
                        onHideColumn={() => setGrantHiddenColumns((current) => ({ ...current, customer: true }))}
                      />
                    )}
                  </th>
                  <th style={grantHiddenColumns.project ? hiddenHeaderStyle : settingsTableHeaderStyle}>
                    {grantHiddenColumns.project ? (
                      <SettingsHiddenColumnHeader label="Project" onShow={() => setGrantHiddenColumns((current) => ({ ...current, project: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="Project"
                        values={grantProjectOptions}
                        selectedValues={selectedGrantProjects ?? grantProjectOptions}
                        onApplyValues={setSelectedGrantProjects}
                        onSort={(direction) => setGrantSortState({ column: 'project', direction })}
                        onHideColumn={() => setGrantHiddenColumns((current) => ({ ...current, project: true }))}
                      />
                    )}
                  </th>
                  <th style={grantHiddenColumns.status ? hiddenHeaderStyle : centeredHeaderStyle}>
                    {grantHiddenColumns.status ? (
                      <SettingsHiddenColumnHeader label="Status" onShow={() => setGrantHiddenColumns((current) => ({ ...current, status: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="Status"
                        values={grantStatusOptions}
                        selectedValues={selectedGrantStatuses ?? grantStatusOptions}
                        onApplyValues={setSelectedGrantStatuses}
                        onSort={(direction) => setGrantSortState({ column: 'status', direction })}
                        onHideColumn={() => setGrantHiddenColumns((current) => ({ ...current, status: true }))}
                      />
                    )}
                  </th>
                  <th style={grantHiddenColumns.created ? hiddenHeaderStyle : settingsTableHeaderStyle}>
                    {grantHiddenColumns.created ? (
                      <SettingsHiddenColumnHeader label="Granted at" onShow={() => setGrantHiddenColumns((current) => ({ ...current, created: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="Granted at"
                        values={grantCreatedOptions}
                        selectedValues={selectedGrantCreatedDates ?? grantCreatedOptions}
                        onApplyValues={setSelectedGrantCreatedDates}
                        onSort={(direction) => setGrantSortState({ column: 'created', direction })}
                        onHideColumn={() => setGrantHiddenColumns((current) => ({ ...current, created: true }))}
                      />
                    )}
                  </th>
                  <th style={grantHiddenColumns.pfmea ? hiddenHeaderStyle : centeredHeaderStyle}>
                    {grantHiddenColumns.pfmea ? (
                      <SettingsHiddenColumnHeader label="PFMEA" onShow={() => setGrantHiddenColumns((current) => ({ ...current, pfmea: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="PFMEA"
                        values={moduleFilterOptions}
                        selectedValues={selectedGrantPfmea ?? moduleFilterOptions}
                        onApplyValues={setSelectedGrantPfmea}
                        onSort={(direction) => setGrantSortState({ column: 'pfmea', direction })}
                        onHideColumn={() => setGrantHiddenColumns((current) => ({ ...current, pfmea: true }))}
                      />
                    )}
                  </th>
                  <th style={grantHiddenColumns.pfd ? hiddenHeaderStyle : centeredHeaderStyle}>
                    {grantHiddenColumns.pfd ? (
                      <SettingsHiddenColumnHeader label="PFD" onShow={() => setGrantHiddenColumns((current) => ({ ...current, pfd: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="PFD"
                        values={moduleFilterOptions}
                        selectedValues={selectedGrantPfd ?? moduleFilterOptions}
                        onApplyValues={setSelectedGrantPfd}
                        onSort={(direction) => setGrantSortState({ column: 'pfd', direction })}
                        onHideColumn={() => setGrantHiddenColumns((current) => ({ ...current, pfd: true }))}
                      />
                    )}
                  </th>
                  <th style={grantHiddenColumns.pcp ? hiddenHeaderStyle : centeredHeaderStyle}>
                    {grantHiddenColumns.pcp ? (
                      <SettingsHiddenColumnHeader label="PCP" onShow={() => setGrantHiddenColumns((current) => ({ ...current, pcp: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="PCP"
                        values={moduleFilterOptions}
                        selectedValues={selectedGrantPcp ?? moduleFilterOptions}
                        onApplyValues={setSelectedGrantPcp}
                        onSort={(direction) => setGrantSortState({ column: 'pcp', direction })}
                        onHideColumn={() => setGrantHiddenColumns((current) => ({ ...current, pcp: true }))}
                      />
                    )}
                  </th>
                  <th style={centeredHeaderStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {createRowOpen ? (
                  <tr>
                    <td style={grantHiddenColumns.customer ? hiddenCellStyle : projectsTableCellStyle}>
                      {grantHiddenColumns.customer ? null : (
                        <StandardSelect
                          compact
                          onChange={setDraftCustomerId}
                          options={customers.map((customer) => ({ label: customerLabel(customer), value: customer.customer_user_id }))}
                          placeholder="Select customer..."
                          style={projectsCompactInputStyle}
                          value={draftCustomerId}
                        />
                      )}
                    </td>
                    <td style={grantHiddenColumns.project ? hiddenCellStyle : projectsTableCellStyle}>
                      {grantHiddenColumns.project ? null : (
                        <StandardSelect
                          compact
                          onChange={setDraftProjectId}
                          options={projects.map((project) => ({
                            label: `${project.name ?? '-'}${project.status ? ` (${project.status})` : ''}`,
                            value: project.id,
                          }))}
                          placeholder="Select project..."
                          style={projectsCompactInputStyle}
                          value={draftProjectId}
                        />
                      )}
                    </td>
                    <td style={grantHiddenColumns.status ? hiddenCellStyle : { ...projectsTableCellStyle, textAlign: 'center' }}>
                      {grantHiddenColumns.status ? null : '-'}
                    </td>
                    <td style={grantHiddenColumns.created ? hiddenCellStyle : projectsTableCellStyle}>
                      {grantHiddenColumns.created ? null : '-'}
                    </td>
                    <td style={grantHiddenColumns.pfmea ? hiddenCellStyle : { ...projectsTableCellStyle, textAlign: 'center' }}>
                      {grantHiddenColumns.pfmea ? null : (
                        <input
                          type="checkbox"
                          checked={draftModules.PFMEA}
                          onChange={(event) => setDraftModules((current) => ({ ...current, PFMEA: event.target.checked }))}
                          style={{ accentColor: settingsProcessAccent, width: 16, height: 16 }}
                        />
                      )}
                    </td>
                    <td style={grantHiddenColumns.pfd ? hiddenCellStyle : { ...projectsTableCellStyle, textAlign: 'center' }}>
                      {grantHiddenColumns.pfd ? null : (
                        <input
                          type="checkbox"
                          checked={draftModules.PFD}
                          onChange={(event) => setDraftModules((current) => ({ ...current, PFD: event.target.checked }))}
                          style={{ accentColor: settingsProcessAccent, width: 16, height: 16 }}
                        />
                      )}
                    </td>
                    <td style={grantHiddenColumns.pcp ? hiddenCellStyle : { ...projectsTableCellStyle, textAlign: 'center' }}>
                      {grantHiddenColumns.pcp ? null : (
                        <input
                          type="checkbox"
                          checked={draftModules.PCP}
                          onChange={(event) => setDraftModules((current) => ({ ...current, PCP: event.target.checked }))}
                          style={{ accentColor: settingsProcessAccent, width: 16, height: 16 }}
                        />
                      )}
                    </td>
                    <td style={projectsTableCellStyle}>
                      <div style={projectsActionsStyle}>
                        <button
                          type="button"
                          onClick={() => void saveCreateRow()}
                          disabled={saving}
                          className="rf-button"
                          style={{ ...settingsCompactPrimaryButtonStyle, opacity: saving ? 0.6 : 1 }}
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" onClick={cancelCreateRow} disabled={saving} className="rf-button" style={settingsCompactActionButtonStyle}>
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
                {loading ? (
                  <tr>
                    <td colSpan={8} style={tableEmptyCellStyle}>
                      Loading customer grants...
                    </td>
                  </tr>
                ) : !createRowOpen && displayedGrants.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={tableEmptyCellStyle}>
                      No customer grants yet.
                    </td>
                  </tr>
                ) : (
                  displayedGrants.map((row) => (
                    <tr key={row.key}>
                      <td style={grantHiddenColumns.customer ? hiddenCellStyle : projectsTableCellStyle}>
                        {grantHiddenColumns.customer ? null : (
                          <>
                            <div style={accentValueStyle}>{grantCustomerLabel(row)}</div>
                            <div style={customerMetaStyle}>{row.email ?? '-'}</div>
                          </>
                        )}
                      </td>
                      <td style={grantHiddenColumns.project ? hiddenCellStyle : projectsTableCellStyle}>
                        {grantHiddenColumns.project ? null : <span style={accentValueStyle}>{row.project_name ?? '-'}</span>}
                      </td>
                      <td style={grantHiddenColumns.status ? hiddenCellStyle : { ...projectsTableCellStyle, textAlign: 'center' }}>
                        {grantHiddenColumns.status ? null : row.project_status ? row.project_status.toUpperCase() : '-'}
                      </td>
                      <td style={grantHiddenColumns.created ? hiddenCellStyle : projectsTableCellStyle}>
                        {grantHiddenColumns.created ? null : formatDateTime(row.created_at)}
                      </td>
                      <td style={grantHiddenColumns.pfmea ? hiddenCellStyle : { ...projectsTableCellStyle, textAlign: 'center' }}>
                        {grantHiddenColumns.pfmea ? null : (
                          <input
                            type="checkbox"
                            checked={row.modules.PFMEA}
                            disabled={rowBusyKey !== null}
                            onChange={(event) => void toggleAccess(row, 'PFMEA', event.target.checked)}
                            aria-label={`PFMEA access for ${accessRowLabel(row)}`}
                            style={{ accentColor: settingsProcessAccent, width: 16, height: 16 }}
                          />
                        )}
                      </td>
                      <td style={grantHiddenColumns.pfd ? hiddenCellStyle : { ...projectsTableCellStyle, textAlign: 'center' }}>
                        {grantHiddenColumns.pfd ? null : (
                          <input
                            type="checkbox"
                            checked={row.modules.PFD}
                            disabled={rowBusyKey !== null}
                            onChange={(event) => void toggleAccess(row, 'PFD', event.target.checked)}
                            aria-label={`PFD access for ${accessRowLabel(row)}`}
                            style={{ accentColor: settingsProcessAccent, width: 16, height: 16 }}
                          />
                        )}
                      </td>
                      <td style={grantHiddenColumns.pcp ? hiddenCellStyle : { ...projectsTableCellStyle, textAlign: 'center' }}>
                        {grantHiddenColumns.pcp ? null : (
                          <input
                            type="checkbox"
                            checked={row.modules.PCP}
                            disabled={rowBusyKey !== null}
                            onChange={(event) => void toggleAccess(row, 'PCP', event.target.checked)}
                            aria-label={`PCP access for ${accessRowLabel(row)}`}
                            style={{ accentColor: settingsProcessAccent, width: 16, height: 16 }}
                          />
                        )}
                      </td>
                      <td style={projectsTableCellStyle}>
                        <SettingsTableActions>
                          {rowBusyKey?.startsWith(row.key) ? (
                            <span style={{ color: settingsProcessAccent, fontSize: 12 }}>Saving...</span>
                          ) : (
                            <SettingsTrashButton
                              title="Delete customer access"
                              ariaLabel={`Delete access for ${accessRowLabel(row)}`}
                              onClick={() => setRowToDelete(row)}
                            />
                          )}
                        </SettingsTableActions>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <SettingsConfirmDialog
        open={!!err}
        title="Error"
        body={err ?? ''}
        cancelLabel="Cancel"
        hideConfirm
        onCancel={() => setErr(null)}
        onConfirm={() => undefined}
      />

      <SettingsConfirmDialog
        open={rowToDelete !== null}
        title="Delete customer access"
        body={
          <>
            Delete all module access for <b>{rowToDelete ? grantCustomerLabel(rowToDelete) : 'this customer'}</b>
            {rowToDelete?.project_name ? (
              <>
                {' '}
                in <b>{rowToDelete.project_name}</b>
              </>
            ) : null}
            ?
          </>
        }
        warning="PFMEA, PFD and PCP access for this customer/project row will be removed."
        busy={saving}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => (saving ? null : setRowToDelete(null))}
        onConfirm={deleteAccessRow}
      />

    </>
  )
}
