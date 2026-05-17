'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import {
  SettingsBanner,
  SettingsConfirmDialog,
  SettingsPageShell,
  SettingsSection,
  SettingsSummaryGrid,
  SettingsSummaryTile,
  SettingsTableActions,
  getSettingsSummaryGridMaxWidth,
  getSettingsTableColumnWidths,
  settingsCompactActionButtonStyle,
  settingsCompactPrimaryButtonStyle,
  settingsFrameStyle,
  settingsHiddenTableColumnWidthPx,
  settingsProcessAccent,
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
import {
  projectsActionsStyle,
  projectsCompactInputStyle,
  projectsProcessCellStyle,
  projectsSummaryValueStyle,
  projectsTableViewportScrollerStyle,
} from '@/features/projects/view-styles'
import {
  BASE_ORGANIZATION_COLUMN_WIDTHS,
  DEFAULT_ORGANIZATION_HIDDEN_COLUMNS,
  buildOrganizationTableRows,
  formatDate,
  getDisplayedOrganizations,
  getOrganizationFilterOptions,
  getOrganizationSummary,
  normalizeBasePath,
  type AccessRequestRow,
  type CreateOrganizationResult,
  type HeaderRow,
  type LatestInviteLink,
  type OrganizationColumnKey,
  type OrganizationHiddenColumns,
  type OrganizationRow,
  type OrganizationSortState,
} from '@/features/settings/organizations-page-model'

const tableEmptyCellStyle: React.CSSProperties = {
  ...settingsTableCellStyle,
  color: 'rgba(255,255,255,0.68)',
}

const centeredHeaderStyle: React.CSSProperties = {
  ...settingsTableHeaderStyle,
  textAlign: 'center',
}

const centeredCellStyle: React.CSSProperties = {
  ...settingsTableCellStyle,
  textAlign: 'center',
}

const accentValueStyle: React.CSSProperties = {
  color: settingsProcessAccent,
  fontWeight: 700,
}

const metaTextStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  color: 'rgba(255,255,255,0.68)',
}

const inviteLinkInputStyle: React.CSSProperties = {
  ...projectsCompactInputStyle,
  minWidth: 280,
  width: 360,
  maxWidth: '42vw',
}

export default function SettingsOrganizationsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [rows, setRows] = useState<OrganizationRow[]>([])
  const [accessRequests, setAccessRequests] = useState<AccessRequestRow[]>([])
  const [latestInviteLink, setLatestInviteLink] = useState<LatestInviteLink | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [createRowOpen, setCreateRowOpen] = useState(false)

  const [organizationName, setOrganizationName] = useState('')
  const [championEmail, setChampionEmail] = useState('')
  const [championFirstName, setChampionFirstName] = useState('')
  const [championLastName, setChampionLastName] = useState('')
  const [seatsPurchased, setSeatsPurchased] = useState('10')
  const [invitesAllowedTotal, setInvitesAllowedTotal] = useState('10')
  const [validTo, setValidTo] = useState('')

  const [organizationHiddenColumns, setOrganizationHiddenColumns] = useState<OrganizationHiddenColumns>(DEFAULT_ORGANIZATION_HIDDEN_COLUMNS)
  const [organizationSortState, setOrganizationSortState] = useState<OrganizationSortState>({ column: 'organization', direction: 'asc' })
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[] | null>(null)
  const [selectedChampions, setSelectedChampions] = useState<string[] | null>(null)
  const [selectedChampionStatuses, setSelectedChampionStatuses] = useState<string[] | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<string[] | null>(null)
  const [selectedInvites, setSelectedInvites] = useState<string[] | null>(null)
  const [selectedValidDates, setSelectedValidDates] = useState<string[] | null>(null)
  const [selectedCreatedDates, setSelectedCreatedDates] = useState<string[] | null>(null)

  const basePath = useMemo(() => normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH), [])

  const { assignedChampionCount, pendingAccessRequestCount, pendingChampionCount } = useMemo(
    () => getOrganizationSummary(rows, accessRequests),
    [accessRequests, rows]
  )

  const organizationColumnWidths = useMemo(() => {
    return getSettingsTableColumnWidths<OrganizationColumnKey>({
      baseWidths: BASE_ORGANIZATION_COLUMN_WIDTHS,
      hiddenColumns: organizationHiddenColumns,
    })
  }, [organizationHiddenColumns])

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

  const organizationTableRows = useMemo(() => buildOrganizationTableRows(rows, accessRequests), [accessRequests, rows])

  const {
    championOptions,
    championStatusOptions,
    createdDateOptions,
    inviteOptions,
    organizationOptions,
    seatOptions,
    validDateOptions,
  } = useMemo(() => getOrganizationFilterOptions(organizationTableRows), [organizationTableRows])

  const displayedOrganizations = useMemo(
    () =>
      getDisplayedOrganizations(
        organizationTableRows,
        {
          selectedChampionStatuses,
          selectedChampions,
          selectedCreatedDates,
          selectedInvites,
          selectedOrganizations,
          selectedSeats,
          selectedValidDates,
        },
        organizationSortState
      ),
    [organizationSortState, organizationTableRows, selectedChampionStatuses, selectedChampions, selectedCreatedDates, selectedInvites, selectedOrganizations, selectedSeats, selectedValidDates]
  )

  function buildInviteUrl(token: string) {
    const path = `${basePath}/waiting-for-invite?token=${encodeURIComponent(token)}`
    if (typeof window === 'undefined') return path
    return `${window.location.origin}${path}`
  }

  async function copyInviteUrl(url: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(url)
      setErr(null)
    } catch {
      setErr('Could not copy the invitation link automatically. Copy it manually from the field below.')
    }
  }

  async function revealInviteLink(row: OrganizationRow) {
    if (!row.champion_invitation_token) {
      setErr('This organization has no pending champion invitation link to copy.')
      return
    }

    const url = buildInviteUrl(row.champion_invitation_token)
    setLatestInviteLink({ email: row.champion_email ?? '-', url })
    await copyInviteUrl(url)
  }

  async function loadOrganizations() {
    setErr(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      window.location.assign('/login')
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', session.user.id)
      .maybeSingle()

    if (profileError) {
      setErr(profileError.message)
      setLoading(false)
      return
    }

    const globalRole = (profile as HeaderRow | null)?.global_role ?? null
    if (globalRole !== 'admin') {
      setIsAdmin(false)
      setLoading(false)
      return
    }

    setIsAdmin(true)

    const { data, error } = await supabase.rpc('admin_list_organizations')
    if (error) {
      setErr(error.message)
      setLoading(false)
      return
    }

    setRows(Array.isArray(data) ? (data as OrganizationRow[]) : [])

    const { data: requestsData, error: requestsError } = await supabase.rpc('admin_list_access_requests')
    if (requestsError) {
      setErr(requestsError.message)
      setLoading(false)
      return
    }

    setAccessRequests(Array.isArray(requestsData) ? (requestsData as AccessRequestRow[]) : [])
    setLoading(false)
  }

  useEffect(() => {
    void loadOrganizations()
  }, [])

  function resetCreateRow() {
    setCreateRowOpen(false)
    setSelectedRequestId(null)
    setOrganizationName('')
    setChampionEmail('')
    setChampionFirstName('')
    setChampionLastName('')
    setSeatsPurchased('10')
    setInvitesAllowedTotal('10')
    setValidTo('')
  }

  async function createOrganization() {
    setErr(null)
    setLatestInviteLink(null)

    const safeOrganizationName = organizationName.trim()
    const safeChampionEmail = championEmail.trim().toLowerCase()
    const safeChampionFirstName = championFirstName.trim()
    const safeChampionLastName = championLastName.trim()
    const safeSeatsPurchased = Number(seatsPurchased)
    const safeInvitesAllowedTotal = Number(invitesAllowedTotal)

    if (!safeOrganizationName) {
      setErr('Organization name is required.')
      return
    }

    if (!safeChampionEmail) {
      setErr('Champion email is required.')
      return
    }

    if (!Number.isFinite(safeSeatsPurchased) || safeSeatsPurchased < 1) {
      setErr('Seats purchased must be at least 1.')
      return
    }

    if (!Number.isFinite(safeInvitesAllowedTotal) || safeInvitesAllowedTotal < 1) {
      setErr('Invites allowed total must be at least 1.')
      return
    }

    setSaving(true)

    const { data, error } = await supabase.rpc('admin_create_organization_with_champion', {
      p_organization_name: safeOrganizationName,
      p_champion_email: safeChampionEmail,
      p_champion_first_name: safeChampionFirstName || null,
      p_champion_last_name: safeChampionLastName || null,
      p_seats_purchased: safeSeatsPurchased,
      p_invites_allowed_total: safeInvitesAllowedTotal,
      p_valid_to: validTo || null,
    })

    if (error) {
      setErr(error.message)
      setSaving(false)
      return
    }

    const result = Array.isArray(data) ? (data[0] as CreateOrganizationResult | undefined) : (data as CreateOrganizationResult | null)

    if (result?.invitation_token) {
      setLatestInviteLink({
        email: result.champion_email,
        url: buildInviteUrl(result.invitation_token),
      })
    } else {
      setLatestInviteLink(null)
    }

    let followUpError: string | null = null

    if (selectedRequestId) {
      const { error: statusError } = await supabase.rpc('admin_set_access_request_status', {
        p_request_id: selectedRequestId,
        p_status: 'APPROVED',
        p_notes_admin: `Organization "${safeOrganizationName}" created.`,
      })

      if (statusError) followUpError = statusError.message
    }

    resetCreateRow()
    await loadOrganizations()
    if (followUpError) setErr(followUpError)
    setSaving(false)
  }

  function loadRequestIntoCreateRow(row: AccessRequestRow) {
    setSelectedRequestId(row.request_id)
    setOrganizationName(row.company_name)
    setChampionEmail(row.requester_email)
    setChampionFirstName(row.first_name ?? '')
    setChampionLastName(row.last_name ?? '')
    const requestedInvitesValue = row.requested_invites && row.requested_invites > 0 ? String(row.requested_invites) : '10'
    setInvitesAllowedTotal(requestedInvitesValue)
    setSeatsPurchased(requestedInvitesValue)
    setValidTo('')
    setErr(null)
    setCreateRowOpen(true)
  }

  if (loading) {
    return (
      <SettingsPageShell
        title="Organizations"
        titleStyle={{ color: settingsProcessAccent }}
        subtitle="Create organizations, prepare the first champion and control starter access."
      >
        <SettingsSection style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>Loading organization administration...</div>
        </SettingsSection>
      </SettingsPageShell>
    )
  }

  if (!isAdmin) {
    return (
      <SettingsPageShell
        title="Organizations"
        titleStyle={{ color: settingsProcessAccent }}
        subtitle="Create organizations, prepare the first champion and control starter access."
      >
        <SettingsBanner tone="error">
          <b>Access denied:</b> this page is available only for the global admin.
        </SettingsBanner>
      </SettingsPageShell>
    )
  }

  return (
    <SettingsPageShell
      title="Organizations"
      titleStyle={{ color: settingsProcessAccent }}
      subtitle="Create organizations, set the initial license and assign or invite the first champion."
      summary={
        <div style={{ width: '100%', maxWidth: getSettingsSummaryGridMaxWidth(4), marginLeft: 'auto' }}>
          <SettingsSummaryGrid columns={4} maxWidth={getSettingsSummaryGridMaxWidth(4)}>
            <SettingsSummaryTile label="Organizations" value={rows.length} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
            <SettingsSummaryTile label="Assigned champions" value={assignedChampionCount} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
            <SettingsSummaryTile label="Pending invites" value={pendingChampionCount} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
            <SettingsSummaryTile label="Access requests" value={pendingAccessRequestCount} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
          </SettingsSummaryGrid>
        </div>
      }
    >
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
              setOrganizationHiddenColumns(DEFAULT_ORGANIZATION_HIDDEN_COLUMNS)
              setCreateRowOpen(true)
            }}
            disabled={saving || createRowOpen}
            className="rf-button"
            style={{ ...settingsCompactPrimaryButtonStyle, opacity: saving || createRowOpen ? 0.6 : 1 }}
          >
            New organization
          </button>

          {latestInviteLink ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
              <span style={{ color: settingsProcessAccent, fontSize: 12.5, fontWeight: 700 }}>Champion link ready for {latestInviteLink.email}</span>
              <input readOnly value={latestInviteLink.url} style={inviteLinkInputStyle} />
              <button type="button" onClick={() => void copyInviteUrl(latestInviteLink.url)} className="rf-button" style={settingsCompactActionButtonStyle}>
                Copy
              </button>
              <a href={latestInviteLink.url} target="_blank" rel="noreferrer" className="rf-button" style={{ ...settingsCompactActionButtonStyle, textDecoration: 'none' }}>
                Open
              </a>
            </div>
          ) : null}
        </div>

        <div style={settingsTableWrapStyle}>
          <div style={projectsTableViewportScrollerStyle}>
            <table style={{ ...settingsTableStyle, minWidth: 1240 }}>
              <colgroup>
                <col style={{ width: organizationColumnWidths.organization }} />
                <col style={{ width: organizationColumnWidths.champion }} />
                <col style={{ width: organizationColumnWidths.status }} />
                <col style={{ width: organizationColumnWidths.seats }} />
                <col style={{ width: organizationColumnWidths.invites }} />
                <col style={{ width: organizationColumnWidths.validTo }} />
                <col style={{ width: organizationColumnWidths.created }} />
                <col style={{ width: organizationColumnWidths.actions }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={organizationHiddenColumns.organization ? hiddenHeaderStyle : settingsTableHeaderStyle}>
                    {organizationHiddenColumns.organization ? (
                      <SettingsHiddenColumnHeader label="Organization" onShow={() => setOrganizationHiddenColumns((current) => ({ ...current, organization: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="Organization"
                        values={organizationOptions}
                        selectedValues={selectedOrganizations ?? organizationOptions}
                        onApplyValues={setSelectedOrganizations}
                        onSort={(direction) => setOrganizationSortState({ column: 'organization', direction })}
                        onHideColumn={() => setOrganizationHiddenColumns((current) => ({ ...current, organization: true }))}
                      />
                    )}
                  </th>
                  <th style={organizationHiddenColumns.champion ? hiddenHeaderStyle : settingsTableHeaderStyle}>
                    {organizationHiddenColumns.champion ? (
                      <SettingsHiddenColumnHeader label="Champion" onShow={() => setOrganizationHiddenColumns((current) => ({ ...current, champion: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="Champion"
                        values={championOptions}
                        selectedValues={selectedChampions ?? championOptions}
                        onApplyValues={setSelectedChampions}
                        onSort={(direction) => setOrganizationSortState({ column: 'champion', direction })}
                        onHideColumn={() => setOrganizationHiddenColumns((current) => ({ ...current, champion: true }))}
                      />
                    )}
                  </th>
                  <th style={organizationHiddenColumns.status ? hiddenHeaderStyle : centeredHeaderStyle}>
                    {organizationHiddenColumns.status ? (
                      <SettingsHiddenColumnHeader label="Status" onShow={() => setOrganizationHiddenColumns((current) => ({ ...current, status: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="Status"
                        values={championStatusOptions}
                        selectedValues={selectedChampionStatuses ?? championStatusOptions}
                        onApplyValues={setSelectedChampionStatuses}
                        onSort={(direction) => setOrganizationSortState({ column: 'status', direction })}
                        onHideColumn={() => setOrganizationHiddenColumns((current) => ({ ...current, status: true }))}
                      />
                    )}
                  </th>
                  <th style={organizationHiddenColumns.seats ? hiddenHeaderStyle : centeredHeaderStyle}>
                    {organizationHiddenColumns.seats ? (
                      <SettingsHiddenColumnHeader label="Seats" onShow={() => setOrganizationHiddenColumns((current) => ({ ...current, seats: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="Seats"
                        values={seatOptions}
                        selectedValues={selectedSeats ?? seatOptions}
                        onApplyValues={setSelectedSeats}
                        onSort={(direction) => setOrganizationSortState({ column: 'seats', direction })}
                        onHideColumn={() => setOrganizationHiddenColumns((current) => ({ ...current, seats: true }))}
                      />
                    )}
                  </th>
                  <th style={organizationHiddenColumns.invites ? hiddenHeaderStyle : centeredHeaderStyle}>
                    {organizationHiddenColumns.invites ? (
                      <SettingsHiddenColumnHeader label="Invites" onShow={() => setOrganizationHiddenColumns((current) => ({ ...current, invites: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="Invites"
                        values={inviteOptions}
                        selectedValues={selectedInvites ?? inviteOptions}
                        onApplyValues={setSelectedInvites}
                        onSort={(direction) => setOrganizationSortState({ column: 'invites', direction })}
                        onHideColumn={() => setOrganizationHiddenColumns((current) => ({ ...current, invites: true }))}
                      />
                    )}
                  </th>
                  <th style={organizationHiddenColumns.validTo ? hiddenHeaderStyle : settingsTableHeaderStyle}>
                    {organizationHiddenColumns.validTo ? (
                      <SettingsHiddenColumnHeader label="Valid to" onShow={() => setOrganizationHiddenColumns((current) => ({ ...current, validTo: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="Valid to"
                        values={validDateOptions}
                        selectedValues={selectedValidDates ?? validDateOptions}
                        onApplyValues={setSelectedValidDates}
                        onSort={(direction) => setOrganizationSortState({ column: 'validTo', direction })}
                        onHideColumn={() => setOrganizationHiddenColumns((current) => ({ ...current, validTo: true }))}
                      />
                    )}
                  </th>
                  <th style={organizationHiddenColumns.created ? hiddenHeaderStyle : settingsTableHeaderStyle}>
                    {organizationHiddenColumns.created ? (
                      <SettingsHiddenColumnHeader label="Created / requested" onShow={() => setOrganizationHiddenColumns((current) => ({ ...current, created: false }))} />
                    ) : (
                      <SettingsFilterColumnHeader
                        label="Created / requested"
                        values={createdDateOptions}
                        selectedValues={selectedCreatedDates ?? createdDateOptions}
                        onApplyValues={setSelectedCreatedDates}
                        onSort={(direction) => setOrganizationSortState({ column: 'created', direction })}
                        onHideColumn={() => setOrganizationHiddenColumns((current) => ({ ...current, created: true }))}
                      />
                    )}
                  </th>
                  <th style={centeredHeaderStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {createRowOpen ? (
                  <tr>
                    <td style={organizationHiddenColumns.organization ? hiddenCellStyle : settingsTableCellStyle}>
                      {organizationHiddenColumns.organization ? null : (
                        <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Organization name" style={projectsCompactInputStyle} />
                      )}
                    </td>
                    <td style={organizationHiddenColumns.champion ? hiddenCellStyle : settingsTableCellStyle}>
                      {organizationHiddenColumns.champion ? null : (
                        <div style={{ display: 'grid', gap: 6 }}>
                          <input value={championEmail} onChange={(event) => setChampionEmail(event.target.value)} placeholder="champion@example.com" style={projectsCompactInputStyle} />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            <input value={championFirstName} onChange={(event) => setChampionFirstName(event.target.value)} placeholder="First name" style={projectsCompactInputStyle} />
                            <input value={championLastName} onChange={(event) => setChampionLastName(event.target.value)} placeholder="Last name" style={projectsCompactInputStyle} />
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={organizationHiddenColumns.status ? hiddenCellStyle : centeredCellStyle}>{organizationHiddenColumns.status ? null : '-'}</td>
                    <td style={organizationHiddenColumns.seats ? hiddenCellStyle : centeredCellStyle}>
                      {organizationHiddenColumns.seats ? null : <input value={seatsPurchased} onChange={(event) => setSeatsPurchased(event.target.value)} type="number" min={1} style={projectsCompactInputStyle} />}
                    </td>
                    <td style={organizationHiddenColumns.invites ? hiddenCellStyle : centeredCellStyle}>
                      {organizationHiddenColumns.invites ? null : <input value={invitesAllowedTotal} onChange={(event) => setInvitesAllowedTotal(event.target.value)} type="number" min={1} style={projectsCompactInputStyle} />}
                    </td>
                    <td style={organizationHiddenColumns.validTo ? hiddenCellStyle : settingsTableCellStyle}>
                      {organizationHiddenColumns.validTo ? null : <input value={validTo} onChange={(event) => setValidTo(event.target.value)} type="date" style={projectsCompactInputStyle} />}
                    </td>
                    <td style={organizationHiddenColumns.created ? hiddenCellStyle : settingsTableCellStyle}>{organizationHiddenColumns.created ? null : '-'}</td>
                    <td style={settingsTableCellStyle}>
                      <div style={projectsActionsStyle}>
                        <button type="button" onClick={() => void createOrganization()} disabled={saving} className="rf-button" style={{ ...settingsCompactPrimaryButtonStyle, opacity: saving ? 0.6 : 1 }}>
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" onClick={resetCreateRow} disabled={saving} className="rf-button" style={settingsCompactActionButtonStyle}>
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
                {displayedOrganizations.length === 0 && !createRowOpen ? (
                  <tr>
                    <td colSpan={8} style={tableEmptyCellStyle}>
                      No organizations available.
                    </td>
                  </tr>
                ) : (
                  displayedOrganizations.map((row) => (
                    <tr key={row.key} className="rowHover">
                      <td style={organizationHiddenColumns.organization ? hiddenCellStyle : settingsTableCellStyle}>
                        {organizationHiddenColumns.organization ? null : <div style={projectsProcessCellStyle}>{row.organizationName}</div>}
                      </td>
                      <td style={organizationHiddenColumns.champion ? hiddenCellStyle : settingsTableCellStyle}>
                        {organizationHiddenColumns.champion ? null : (
                          <>
                            <div style={accentValueStyle}>{row.championName}</div>
                            <div style={metaTextStyle}>{row.championEmail ?? '-'}</div>
                          </>
                        )}
                      </td>
                      <td style={organizationHiddenColumns.status ? hiddenCellStyle : centeredCellStyle}>{organizationHiddenColumns.status ? null : row.status}</td>
                      <td style={organizationHiddenColumns.seats ? hiddenCellStyle : centeredCellStyle}>{organizationHiddenColumns.seats ? null : row.seats ?? '-'}</td>
                      <td style={organizationHiddenColumns.invites ? hiddenCellStyle : centeredCellStyle}>{organizationHiddenColumns.invites ? null : row.invites ?? '-'}</td>
                      <td style={organizationHiddenColumns.validTo ? hiddenCellStyle : settingsTableCellStyle}>{organizationHiddenColumns.validTo ? null : formatDate(row.validTo)}</td>
                      <td style={organizationHiddenColumns.created ? hiddenCellStyle : settingsTableCellStyle}>{organizationHiddenColumns.created ? null : formatDate(row.createdAt)}</td>
                      <td style={settingsTableCellStyle}>
                        <SettingsTableActions>
                          {row.kind === 'request' ? (
                            <button type="button" onClick={() => loadRequestIntoCreateRow(row.request)} className="rf-button" style={settingsCompactActionButtonStyle}>
                              Use
                            </button>
                          ) : row.organization.champion_invitation_token ? (
                            <button type="button" onClick={() => void revealInviteLink(row.organization)} className="rf-button" style={settingsCompactActionButtonStyle}>
                              Copy link
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.58)' }}>No pending link</span>
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
    </SettingsPageShell>
  )
}
