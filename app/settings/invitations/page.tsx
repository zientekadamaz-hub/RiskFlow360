'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import type { CSSProperties } from 'react'
import {
  SettingsBanner,
  SettingsConfirmDialog,
  SettingsPageShell,
  SettingsSection,
  SettingsSummaryGrid,
  SettingsSummaryTile,
  SettingsTrashButton,
  getSettingsTableColumnWidths,
  settingsCompactActionButtonStyle,
  settingsCompactPrimaryButtonStyle,
  settingsFrameStyle,
  settingsHiddenTableColumnWidthPx,
  settingsInputStyle,
  settingsInlineStatusStyle,
  settingsSectionSubtitleStyle,
  settingsSectionTitleStyle,
  settingsTableWrapStyle,
} from '@/components/rf-ui'
import { StandardSelect } from '@/features/settings/StandardSelect'
import {
  projectsActionsStyle,
  projectsCompactInputStyle,
  PROJECTS_PROCESS_ACCENT,
  projectsProcessCellStyle,
  projectsSummaryValueStyle,
  projectsTableCellStyle,
  projectsTableHeaderStyle,
  projectsTableShellStyle,
  projectsTableStyle,
  projectsTableViewportScrollerStyle,
} from '@/features/projects/view-styles'
import {
  deleteOrganizationInvitation,
  displayInviteStatus,
  fetchOrganizationInvites,
  fetchOrganizationLicense,
  formatInviteRole,
  setOrganizationInvitationStatus,
  updateOrganizationInvitation,
  updateOrganizationMemberRole,
  type AppRole,
  type InviteRow,
  type LicenseRow,
} from '@/features/settings/invitations-service'
import {
  BASE_INVITATION_COLUMN_WIDTHS,
  DEFAULT_INVITATION_HIDDEN_COLUMNS,
  formatDateTime,
  getAllowedInvitationRoles,
  getDisplayedInvites,
  getInvitationFilterOptions,
  getInvitationSummary,
  inviteDisplayName,
  mapInviteError,
  normalizeBasePath,
  type ActiveProfileRow,
  type HeaderRpcRow,
  type InvitationColumnKey,
  type InvitationHiddenColumns,
  type InvitationSortState,
  type InviteLinkState,
  type SendInviteResponse,
} from '@/features/settings/invitations-page-model'
import { InvitationsTableHeader } from '@/features/settings/invitations-table-header'

export default function InvitationsPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [orgRole, setOrgRole] = useState<AppRole | null>(null)
  const [globalRole, setGlobalRole] = useState<AppRole | null>(null)

  const [license, setLicense] = useState<LicenseRow | null>(null)
  const [invites, setInvites] = useState<InviteRow[]>([])

  const [loading, setLoading] = useState(true)
  const [, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [latestInviteLink, setLatestInviteLink] = useState<InviteLinkState | null>(null)

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<AppRole>('engineer')
  const [createRowOpen, setCreateRowOpen] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editRole, setEditRole] = useState<AppRole>('engineer')
  const [confirmDelete, setConfirmDelete] = useState<InviteRow | null>(null)
  const [hiddenColumns, setHiddenColumns] = useState<InvitationHiddenColumns>(DEFAULT_INVITATION_HIDDEN_COLUMNS)
  const [selectedNames, setSelectedNames] = useState<string[] | null>(null)
  const [selectedEmails, setSelectedEmails] = useState<string[] | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<string[] | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<string[] | null>(null)
  const [sortState, setSortState] = useState<InvitationSortState>({ column: 'created', direction: 'desc' })
  const [infoDialog, setInfoDialog] = useState<{ title: string; message: string } | null>(null)

  const basePath = useMemo(() => normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH), [])
  const allowedRoles = useMemo<AppRole[]>(() => getAllowedInvitationRoles(orgRole, globalRole), [globalRole, orgRole])
  const { activeChampionCount, activeCount, freeSeats, pendingCount, usedSeats } = useMemo(
    () => getInvitationSummary(invites, license),
    [invites, license]
  )
  const canSend = !!orgId && !!email.trim() && !!firstName.trim() && !!lastName.trim() && !sending
  const canSendWithLicense = freeSeats === null ? canSend : canSend && freeSeats > 0

  const { emailOptions, nameOptions, roleOptions, statusOptions } = useMemo(() => getInvitationFilterOptions(invites), [invites])
  const displayedInvites = useMemo(
    () =>
      getDisplayedInvites(
        invites,
        {
          selectedEmails,
          selectedNames,
          selectedRoles,
          selectedStatuses,
        },
        sortState
      ),
    [invites, selectedEmails, selectedNames, selectedRoles, selectedStatuses, sortState]
  )
  const columnWidths = useMemo(() => {
    return getSettingsTableColumnWidths<InvitationColumnKey>({
      baseWidths: BASE_INVITATION_COLUMN_WIDTHS,
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

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        window.location.assign('/')
      }
    })

    return () => {
      try {
        sub?.subscription?.unsubscribe?.()
      } catch {}
    }
  }, [])

  function buildInviteUrl(token: string) {
    const path = `${basePath}/waiting-for-invite?token=${encodeURIComponent(token)}`
    if (typeof window === 'undefined') return path
    return `${window.location.origin}${path}`
  }

  async function copyInviteUrl(url: string, successMessage = 'Invitation link copied.') {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable')
      }
      await navigator.clipboard.writeText(url)
      setErr(null)
      setOk(successMessage)
    } catch {
      setErr('Could not copy the invitation link automatically. Copy it manually from the field below.')
    }
  }

  async function revealInviteLink(row: InviteRow, options?: { copy?: boolean; successMessage?: string }) {
    if (!row.token) {
      setErr('This invitation has no token. Resend it to generate a fresh secure link.')
      return
    }

    const url = buildInviteUrl(row.token)
    setLatestInviteLink({ email: row.email, url })

    if (options?.copy) {
      await copyInviteUrl(url, options.successMessage)
      return
    }

    setErr(null)
    setOk(options?.successMessage ?? 'Invitation link is ready.')
  }

  async function loadAll(options?: { foreground?: boolean }) {
    const foreground = options?.foreground ?? true
    if (foreground) setLoading(true)
    else setRefreshing(true)
    setErr(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      window.location.assign('/login')
      return
    }

    const [profileRes, headerRes] = await Promise.all([
      supabase.from('profiles').select('active_organization_id').eq('id', session.user.id).maybeSingle(),
      supabase.rpc('get_my_header').maybeSingle(),
    ])

    if (profileRes.error) {
      setErr(profileRes.error.message)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const activeOrgId = (profileRes.data as ActiveProfileRow | null)?.active_organization_id ?? null
    const header = (headerRes.data as HeaderRpcRow | null) ?? null

    setOrgId(activeOrgId)
    setOrgName(header?.org_name ?? null)
    setOrgRole((header?.org_role as AppRole | null) ?? null)
    setGlobalRole((header?.global_role as AppRole | null) ?? null)

    if (!activeOrgId) {
      setErr('User has no active organization.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    try {
      const [licenseRow, inviteRows] = await Promise.all([
        fetchOrganizationLicense(supabase, activeOrgId),
        fetchOrganizationInvites(supabase, activeOrgId),
      ])
      setLicense(licenseRow)
      setInvites(inviteRows)
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not load invitation data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadAll({ foreground: true })
  }, [])

  async function sendInvite() {
    setErr(null)
    setOk(null)
    if (!orgId) return

    const nextEmail = email.trim().toLowerCase()
    const nextFirstName = firstName.trim()
    const nextLastName = lastName.trim()

    if (!nextEmail || !nextFirstName || !nextLastName) return

    if (freeSeats !== null && freeSeats <= 0) {
      setInfoDialog({
        title: 'Invitation cannot be sent',
        message: 'License limit reached for your organization.',
      })
      return
    }

    setSending(true)

    try {
      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: nextEmail,
          firstName: nextFirstName,
          lastName: nextLastName,
          organizationId: orgId,
          role,
        }),
      })

      const result = (await response.json().catch(() => ({}))) as SendInviteResponse
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? 'Could not send invitation.')
      }

      setLatestInviteLink(result.inviteUrl ? { email: result.email ?? nextEmail, url: result.inviteUrl } : null)
      setOk('Invitation email sent. Status: PENDING.')
      setEmail('')
      setFirstName('')
      setLastName('')
      setCreateRowOpen(false)
      await loadAll({ foreground: false })
    } catch (error) {
      setInfoDialog({
        title: 'Invitation cannot be sent',
        message: mapInviteError(error instanceof Error ? error.message : 'Could not send invitation.'),
      })
    } finally {
      setSending(false)
    }
  }

  function startEdit(row: InviteRow) {
    setEditingId(row.id)
    setEditEmail(row.email)
    setEditFirstName(row.first_name ?? '')
    setEditLastName(row.last_name ?? '')
    setEditRole(row.role)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditEmail('')
    setEditFirstName('')
    setEditLastName('')
    setEditRole('engineer')
  }

  function cancelCreate() {
    setEmail('')
    setFirstName('')
    setLastName('')
    setRole('engineer')
    setCreateRowOpen(false)
  }

  async function saveEdit(row: InviteRow) {
    const nextEmail = editEmail.trim().toLowerCase()
    const nextFirstName = editFirstName.trim()
    const nextLastName = editLastName.trim()
    if (!nextEmail || !nextFirstName || !nextLastName) return
    if (row.source === 'member' && row.role === 'champion' && editRole !== 'champion' && activeChampionCount <= 1) {
      setInfoDialog({
        title: 'Champion role is required',
        message: 'This organization must always have at least one active Champion. Add or promote another Champion before changing this role.',
      })
      return
    }

    setErr(null)
    setOk(null)
    setRowBusyId(row.id)

    try {
      if (row.source === 'member') {
        if (!orgId || !row.user_id) {
          throw new Error('Member record is incomplete.')
        }
        await updateOrganizationMemberRole(supabase, {
          organizationId: orgId,
          userId: row.user_id,
          role: editRole,
        })
        setOk('Member role updated.')
      } else {
        await updateOrganizationInvitation(supabase, {
          invitationId: row.invitation_id ?? row.id,
          email: nextEmail,
          role: editRole,
          firstName: nextFirstName,
          lastName: nextLastName,
        })
        setOk('Invitation updated.')
      }
      await loadAll({ foreground: false })
      cancelEdit()
    } catch (error) {
      setErr(mapInviteError(error instanceof Error ? error.message : 'Could not update invitation.'))
    } finally {
      setRowBusyId(null)
    }
  }

  async function updateStatus(row: InviteRow, nextStatus: 'NOACTIVE' | 'ACTIVE' | 'PENDING') {
    if (row.source === 'member') {
      setInfoDialog({
        title: 'Member is already active',
        message: 'Active organization members cannot be deactivated from the invitation row. Change their role or transfer Champion ownership first.',
      })
      return
    }

    setErr(null)
    setOk(null)
    setRowBusyId(row.id)

    try {
      await setOrganizationInvitationStatus(supabase, {
        invitationId: row.invitation_id ?? row.id,
        status: nextStatus,
      })
      setOk(nextStatus === 'NOACTIVE' ? 'Invitation deactivated.' : nextStatus === 'ACTIVE' ? 'Invitation activated.' : 'Invitation updated.')
      await loadAll({ foreground: false })
    } catch (error) {
      setErr(mapInviteError(error instanceof Error ? error.message : 'Could not update invitation status.'))
    } finally {
      setRowBusyId(null)
    }
  }

  async function resendInvite(row: InviteRow) {
    if (row.source === 'member') return

    setErr(null)
    setOk(null)
    setRowBusyId(row.id)

    try {
      const response = await fetch('/api/invitations/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invitationId: row.invitation_id ?? row.id,
        }),
      })

      const result = (await response.json().catch(() => ({}))) as SendInviteResponse
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? 'Could not resend invitation.')
      }

      setLatestInviteLink(result.inviteUrl ? { email: result.email ?? row.email, url: result.inviteUrl } : null)
      setOk('Invitation email resent.')
      await loadAll({ foreground: false })

      if (orgId) {
        const nextLicense = await fetchOrganizationLicense(supabase, orgId)
        setLicense(nextLicense)
      }
    } catch (error) {
      setInfoDialog({
        title: 'Invitation cannot be resent',
        message: mapInviteError(error instanceof Error ? error.message : 'Could not resend invitation.'),
      })
    } finally {
      setRowBusyId(null)
    }
  }

  async function confirmDeleteInvite() {
    if (!confirmDelete) return

    setErr(null)
    setOk(null)
    setRowBusyId(confirmDelete.id)

    try {
      await deleteOrganizationInvitation(supabase, confirmDelete.invitation_id ?? confirmDelete.id)
      setOk('Invitation deleted.')
      setConfirmDelete(null)
      await loadAll({ foreground: false })
    } catch (error) {
      setErr(mapInviteError(error instanceof Error ? error.message : 'Could not delete invitation.'))
    } finally {
      setRowBusyId(null)
    }
  }

  if (loading) {
    return (
      <SettingsPageShell
        title="Invitations"
        subtitle="Invite organization members, manage invitation status and grant customer-specific access from one standard screen."
      >
        <SettingsSection style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>Loading invitations and customer access...</div>
        </SettingsSection>
      </SettingsPageShell>
    )
  }

  return (
    <>
      <SettingsPageShell
        title="Invitations"
        titleStyle={{ color: PROJECTS_PROCESS_ACCENT }}
        subtitle={<>Invite organization members, track seat usage and manage secure activation links for <b>{orgName ?? 'the active organization'}</b>.</>}
        summary={
          <div style={{ width: '100%', maxWidth: 540, marginLeft: 'auto' }}>
            <SettingsSummaryGrid columns={4}>
              <SettingsSummaryTile label="Used seats" value={usedSeats} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
              <SettingsSummaryTile label="Free seats" value={freeSeats ?? '-'} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
              <SettingsSummaryTile label="Pending invites" value={pendingCount} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
              <SettingsSummaryTile label="Active invites" value={activeCount} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
            </SettingsSummaryGrid>
          </div>
        }
      >
        {err ? (
          <SettingsBanner tone="error">
            <b>Error:</b> {err}
          </SettingsBanner>
        ) : null}

        {ok ? <SettingsBanner tone="success">{ok}</SettingsBanner> : null}

        <div style={{ ...settingsFrameStyle, marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setCreateRowOpen(true)
            }}
            disabled={!orgId || createRowOpen || (freeSeats !== null && freeSeats <= 0)}
            className="rf-button"
            style={{ ...settingsCompactPrimaryButtonStyle, opacity: orgId && !createRowOpen && (freeSeats === null || freeSeats > 0) ? 1 : 0.6 }}
          >
            Add member
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
                  <col style={{ width: columnWidths.name }} />
                  <col style={{ width: columnWidths.email }} />
                  <col style={{ width: columnWidths.role }} />
                  <col style={{ width: columnWidths.status }} />
                  <col style={{ width: columnWidths.created }} />
                  <col style={{ width: columnWidths.accepted }} />
                  <col style={{ width: columnWidths.actions }} />
                </colgroup>
                <InvitationsTableHeader
                  emailOptions={emailOptions}
                  hiddenColumns={hiddenColumns}
                  hiddenHeaderStyle={hiddenHeaderStyle}
                  nameOptions={nameOptions}
                  roleOptions={roleOptions}
                  selectedEmails={selectedEmails ?? emailOptions}
                  selectedNames={selectedNames ?? nameOptions}
                  selectedRoles={selectedRoles ?? roleOptions}
                  selectedStatuses={selectedStatuses ?? statusOptions}
                  setHiddenColumns={setHiddenColumns}
                  setSelectedEmails={setSelectedEmails}
                  setSelectedNames={setSelectedNames}
                  setSelectedRoles={setSelectedRoles}
                  setSelectedStatuses={setSelectedStatuses}
                  setSortState={setSortState}
                  statusOptions={statusOptions}
                />
                <tbody>
                  {createRowOpen ? (
                    <tr className="rowHover">
                      <td style={hiddenColumns.name ? hiddenCellStyle : projectsTableCellStyle}>
                        {hiddenColumns.name ? null : (
                          <div style={{ display: 'grid', gap: 8 }}>
                            <input
                              value={firstName}
                              onChange={(event) => setFirstName(event.target.value)}
                              style={projectsCompactInputStyle}
                              placeholder="First name"
                            />
                            <input
                              value={lastName}
                              onChange={(event) => setLastName(event.target.value)}
                              style={projectsCompactInputStyle}
                              placeholder="Last name"
                            />
                          </div>
                        )}
                      </td>
                      <td style={hiddenColumns.email ? hiddenCellStyle : projectsTableCellStyle}>
                        {hiddenColumns.email ? null : (
                          <input
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            style={projectsCompactInputStyle}
                            placeholder="name@company.com"
                          />
                        )}
                      </td>
                      <td style={hiddenColumns.role ? hiddenCellStyle : projectsTableCellStyle}>
                        {hiddenColumns.role ? null : (
                          <StandardSelect
                            compact
                            onChange={(nextRole) => setRole(nextRole as AppRole)}
                            options={allowedRoles.map((entry) => ({ label: formatInviteRole(entry), value: entry }))}
                            style={projectsCompactInputStyle}
                            value={role}
                          />
                        )}
                      </td>
                      <td style={hiddenColumns.status ? hiddenCellStyle : projectsTableCellStyle}>
                        {hiddenColumns.status ? null : <span style={settingsInlineStatusStyle('PENDING')}>PENDING</span>}
                      </td>
                      <td style={hiddenColumns.created ? hiddenCellStyle : projectsTableCellStyle}>{hiddenColumns.created ? null : '-'}</td>
                      <td style={hiddenColumns.accepted ? hiddenCellStyle : projectsTableCellStyle}>{hiddenColumns.accepted ? null : '-'}</td>
                      <td style={projectsTableCellStyle}>
                        <div style={projectsActionsStyle}>
                          <button
                            type="button"
                            onClick={() => void sendInvite()}
                            disabled={!canSendWithLicense}
                            className="rf-button"
                            style={{ ...settingsCompactPrimaryButtonStyle, opacity: canSendWithLicense ? 1 : 0.6 }}
                          >
                            {sending ? 'Sending...' : 'Send invite'}
                          </button>
                          <button type="button" onClick={cancelCreate} className="rf-button" style={settingsCompactActionButtonStyle}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {!createRowOpen && displayedInvites.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={projectsTableCellStyle}>
                        No invitations match the current filters.
                      </td>
                    </tr>
                  ) : (
                    displayedInvites.map((row) => {
                      const busy = rowBusyId === row.id
                      const status = displayInviteStatus(row)
                      const isEditing = editingId === row.id
                      const isMember = row.source === 'member'
                      const canCopyLink = !isMember && !!row.token && status === 'PENDING'

                      if (isEditing) {
                        return (
                          <tr key={row.id} className="rowHover">
                            <td style={hiddenColumns.name ? hiddenCellStyle : projectsTableCellStyle}>
                              {hiddenColumns.name ? null : (
                                <>
                              <input
                                value={editFirstName}
                                onChange={(event) => setEditFirstName(event.target.value)}
                                readOnly={isMember}
                                style={{ ...projectsCompactInputStyle, opacity: isMember ? 0.72 : 1, cursor: isMember ? 'not-allowed' : 'text' }}
                                placeholder="First name"
                              />
                              <div style={{ marginTop: 8 }}>
                                <input
                                  value={editLastName}
                                  onChange={(event) => setEditLastName(event.target.value)}
                                  readOnly={isMember}
                                  style={{ ...projectsCompactInputStyle, opacity: isMember ? 0.72 : 1, cursor: isMember ? 'not-allowed' : 'text' }}
                                  placeholder="Last name"
                                />
                              </div>
                                </>
                              )}
                            </td>
                            <td style={hiddenColumns.email ? hiddenCellStyle : projectsTableCellStyle}>
                              {hiddenColumns.email ? null : (
                                <input
                                  value={editEmail}
                                  onChange={(event) => setEditEmail(event.target.value)}
                                  readOnly={isMember}
                                  style={{ ...projectsCompactInputStyle, opacity: isMember ? 0.72 : 1, cursor: isMember ? 'not-allowed' : 'text' }}
                                  placeholder="Email"
                                />
                              )}
                            </td>
                            <td style={hiddenColumns.role ? hiddenCellStyle : projectsTableCellStyle}>
                              {hiddenColumns.role ? null : (
                                <StandardSelect
                                  compact
                                  onChange={(nextRole) => setEditRole(nextRole as AppRole)}
                                  options={allowedRoles.map((entry) => ({ label: formatInviteRole(entry), value: entry }))}
                                  style={projectsCompactInputStyle}
                                  value={editRole}
                                />
                              )}
                            </td>
                            <td style={hiddenColumns.status ? hiddenCellStyle : projectsTableCellStyle}>
                              {hiddenColumns.status ? null : <span style={settingsInlineStatusStyle(status)}>{status}</span>}
                            </td>
                            <td style={hiddenColumns.created ? hiddenCellStyle : projectsTableCellStyle}>{hiddenColumns.created ? null : formatDateTime(row.created_at)}</td>
                            <td style={hiddenColumns.accepted ? hiddenCellStyle : projectsTableCellStyle}>{hiddenColumns.accepted ? null : formatDateTime(row.accepted_at)}</td>
                            <td style={projectsTableCellStyle}>
                              <div style={projectsActionsStyle}>
                                <button
                                  onClick={() => void saveEdit(row)}
                                  disabled={busy}
                                  className="rf-button"
                                  style={{ ...settingsCompactPrimaryButtonStyle, opacity: busy ? 0.6 : 1 }}
                                >
                                  Save
                                </button>
                                <button onClick={cancelEdit} className="rf-button" style={settingsCompactActionButtonStyle}>
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      }

                      return (
                        <tr key={row.id} className="rowHover">
                          <td style={hiddenColumns.name ? hiddenCellStyle : projectsTableCellStyle}>
                            {hiddenColumns.name ? null : <div style={projectsProcessCellStyle}>{inviteDisplayName(row)}</div>}
                          </td>
                          <td style={hiddenColumns.email ? hiddenCellStyle : projectsTableCellStyle}>{hiddenColumns.email ? null : row.email}</td>
                          <td style={hiddenColumns.role ? hiddenCellStyle : projectsTableCellStyle}>{hiddenColumns.role ? null : formatInviteRole(row.role)}</td>
                          <td style={hiddenColumns.status ? hiddenCellStyle : projectsTableCellStyle}>
                            {hiddenColumns.status ? null : <span style={settingsInlineStatusStyle(status)}>{status}</span>}
                          </td>
                          <td style={hiddenColumns.created ? hiddenCellStyle : projectsTableCellStyle}>{hiddenColumns.created ? null : formatDateTime(row.created_at)}</td>
                          <td style={hiddenColumns.accepted ? hiddenCellStyle : projectsTableCellStyle}>{hiddenColumns.accepted ? null : formatDateTime(row.accepted_at)}</td>
                          <td style={projectsTableCellStyle}>
                            <div style={projectsActionsStyle}>
                              {canCopyLink ? (
                                <button
                                  onClick={() => void revealInviteLink(row, { copy: true, successMessage: 'Invitation link copied.' })}
                                  disabled={busy}
                                  className="rf-button"
                                  style={{ ...settingsCompactActionButtonStyle, opacity: busy ? 0.6 : 1 }}
                                >
                                  Copy link
                                </button>
                              ) : null}
                              {!isMember && status === 'PENDING' ? (
                                <button
                                  onClick={() => void resendInvite(row)}
                                  disabled={busy}
                                  className="rf-button"
                                  style={{ ...settingsCompactActionButtonStyle, opacity: busy ? 0.6 : 1 }}
                                >
                                  Resend
                                </button>
                              ) : null}
                              <button
                                onClick={() => startEdit(row)}
                                disabled={busy}
                                className="rf-button"
                                style={{ ...settingsCompactActionButtonStyle, opacity: busy ? 0.6 : 1 }}
                              >
                                Edit
                              </button>
                              {!isMember && status === 'NOACTIVE' ? (
                                <button
                                  onClick={() => void updateStatus(row, 'ACTIVE')}
                                  disabled={busy}
                                  className="rf-button"
                                  style={{ ...settingsCompactActionButtonStyle, opacity: busy ? 0.6 : 1 }}
                                >
                                  Activate
                                </button>
                              ) : !isMember ? (
                                <button
                                  onClick={() => void updateStatus(row, 'NOACTIVE')}
                                  disabled={busy}
                                  className="rf-button"
                                  style={{ ...settingsCompactActionButtonStyle, opacity: busy ? 0.6 : 1 }}
                                >
                                  Deactivate
                                </button>
                              ) : null}
                              {!isMember ? (
                                <SettingsTrashButton
                                  onClick={() => setConfirmDelete(row)}
                                  title={`Delete invitation for ${row.email}`}
                                  ariaLabel={`Delete invitation for ${row.email}`}
                                />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {latestInviteLink ? (
          <SettingsSection style={{ padding: 14 }}>
            <div>
              <div style={settingsSectionTitleStyle}>Latest invitation link</div>
              <div style={settingsSectionSubtitleStyle}>Copy and send this secure activation link to {latestInviteLink.email}.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center', marginTop: 12 }}>
              <input readOnly value={latestInviteLink.url} style={{ ...settingsInputStyle, opacity: 0.86 }} />
              <button onClick={() => void copyInviteUrl(latestInviteLink.url)} className="rf-button" style={settingsCompactActionButtonStyle}>
                Copy link
              </button>
            </div>
          </SettingsSection>
        ) : null}

      </SettingsPageShell>

      <SettingsConfirmDialog
        open={!!confirmDelete}
        title="Delete invitation"
        body={
          <>
            Are you sure you want to delete the invitation for <b>{confirmDelete?.email ?? '-'}</b>?
          </>
        }
        warning="Data will be permanently removed."
        busy={!!rowBusyId}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => (rowBusyId ? null : setConfirmDelete(null))}
        onConfirm={confirmDeleteInvite}
      />

      <SettingsConfirmDialog
        open={!!infoDialog}
        title={infoDialog?.title ?? 'Information'}
        body={infoDialog?.message ?? ''}
        cancelLabel="OK"
        hideConfirm
        onCancel={() => setInfoDialog(null)}
        onConfirm={() => undefined}
      />
    </>
  )
}
