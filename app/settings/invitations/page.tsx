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

type HeaderRpcRow = {
  org_name?: string | null
  org_role?: string | null
  global_role?: AppRole | null
}

type ActiveProfileRow = {
  active_organization_id?: string | null
}

type InviteLinkState = {
  email: string
  url: string
}

type SendInviteResponse = {
  email?: string
  error?: string
  id?: string | null
  inviteUrl?: string
  ok?: boolean
}

type InvitationStatusFilter = 'ACTIVE' | 'NOACTIVE' | 'PENDING'
type InvitationColumnKey = 'accepted' | 'created' | 'email' | 'name' | 'role' | 'status'
type InvitationLayoutColumnKey = InvitationColumnKey | 'actions'
type InvitationHiddenColumns = Record<InvitationColumnKey, boolean>
type InvitationSortState = {
  column: InvitationColumnKey
  direction: 'asc' | 'desc'
} | null

const DEFAULT_INVITATION_HIDDEN_COLUMNS: InvitationHiddenColumns = {
  accepted: false,
  created: false,
  email: false,
  name: false,
  role: false,
  status: false,
}

const BASE_INVITATION_COLUMN_WIDTHS: Record<InvitationLayoutColumnKey, number> = {
  name: 190,
  email: 250,
  role: 145,
  status: 120,
  created: 145,
  accepted: 145,
  actions: 330,
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

function normalizeBasePath(value: string | undefined) {
  const raw = value?.trim() ?? ''
  if (!raw || raw === '/') return ''
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`
  return withLeadingSlash.replace(/\/+$/, '')
}

function inviteDisplayName(row: InviteRow) {
  const full = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()
  return full || '-'
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )
}

function compareNullableDate(left: string | null, right: string | null) {
  const leftTime = left ? new Date(left).getTime() : 0
  const rightTime = right ? new Date(right).getTime() : 0
  return (Number.isFinite(leftTime) ? leftTime : 0) - (Number.isFinite(rightTime) ? rightTime : 0)
}

function invitationSortValue(row: InviteRow, column: InvitationColumnKey) {
  if (column === 'name') return inviteDisplayName(row)
  if (column === 'email') return row.email
  if (column === 'role') return formatInviteRole(row.role)
  if (column === 'status') return displayInviteStatus(row)
  if (column === 'created') return row.created_at ?? ''
  return row.accepted_at ?? ''
}

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
  const canInviteChampion = orgRole === 'champion' || globalRole === 'admin'
  const allowedRoles = useMemo<AppRole[]>(
    () => (canInviteChampion ? ['engineer', 'viewer', 'customer', 'champion'] : ['engineer', 'viewer', 'customer']),
    [canInviteChampion]
  )

  const usedSeats = useMemo(() => invites.filter((invite) => ['PENDING', 'ACTIVE'].includes(displayInviteStatus(invite))).length, [invites])
  const allowedSeats = license?.invites_allowed_total ?? null
  const freeSeats = allowedSeats === null ? null : Math.max(0, allowedSeats - usedSeats)
  const pendingCount = useMemo(() => invites.filter((invite) => displayInviteStatus(invite) === 'PENDING').length, [invites])
  const activeCount = useMemo(() => invites.filter((invite) => displayInviteStatus(invite) === 'ACTIVE').length, [invites])
  const activeChampionCount = useMemo(
    () => invites.filter((invite) => invite.source === 'member' && displayInviteStatus(invite) === 'ACTIVE' && invite.role === 'champion').length,
    [invites]
  )
  const canSend = !!orgId && !!email.trim() && !!firstName.trim() && !!lastName.trim() && !sending
  const canSendWithLicense = freeSeats === null ? canSend : canSend && freeSeats > 0

  const nameOptions = useMemo(() => uniqueSorted(invites.map(inviteDisplayName)), [invites])
  const emailOptions = useMemo(() => uniqueSorted(invites.map((invite) => invite.email)), [invites])
  const roleOptions = useMemo(() => uniqueSorted(invites.map((invite) => formatInviteRole(invite.role))), [invites])
  const statusOptions = useMemo(() => uniqueSorted(invites.map((invite) => displayInviteStatus(invite) as InvitationStatusFilter)), [invites])
  const displayedInvites = useMemo(() => {
    const nameSet = selectedNames === null ? null : new Set(selectedNames)
    const emailSet = selectedEmails === null ? null : new Set(selectedEmails)
    const roleSet = selectedRoles === null ? null : new Set(selectedRoles)
    const statusSet = selectedStatuses === null ? null : new Set(selectedStatuses)

    const filtered = invites.filter((row) => {
      const nameOk = nameSet === null ? true : nameSet.has(inviteDisplayName(row))
      const emailOk = emailSet === null ? true : emailSet.has(row.email)
      const roleOk = roleSet === null ? true : roleSet.has(formatInviteRole(row.role))
      const statusOk = statusSet === null ? true : statusSet.has(displayInviteStatus(row))
      return nameOk && emailOk && roleOk && statusOk
    })

    if (!sortState) return filtered

    return [...filtered].sort((left, right) => {
      let comparison = 0
      if (sortState.column === 'created') comparison = compareNullableDate(left.created_at, right.created_at)
      else if (sortState.column === 'accepted') comparison = compareNullableDate(left.accepted_at, right.accepted_at)
      else {
        comparison = invitationSortValue(left, sortState.column).localeCompare(invitationSortValue(right, sortState.column), undefined, {
          sensitivity: 'base',
        })
      }
      return sortState.direction === 'asc' ? comparison : -comparison
    })
  }, [invites, selectedEmails, selectedNames, selectedRoles, selectedStatuses, sortState])
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

  function mapInviteError(message: string) {
    const lower = message.toLowerCase()
    if (lower.includes('license') || lower.includes('limit') || lower.includes('seats')) {
      return 'License limit reached for your organization.'
    }
    if (lower.includes('already exists') && lower.includes('email')) {
      return 'A user with this email already exists. Use a different email address.'
    }
    if (lower.includes('invitation') && (lower.includes('exists') || lower.includes('duplicate') || lower.includes('unique'))) {
      return 'An invitation for this email already exists in your organization.'
    }
    if (lower.includes('duplicate') && lower.includes('organization')) {
      return 'An invitation for this email already exists in your organization.'
    }
    return message
  }

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

function InvitationsTableHeader({
  emailOptions,
  hiddenColumns,
  hiddenHeaderStyle,
  nameOptions,
  roleOptions,
  selectedEmails,
  selectedNames,
  selectedRoles,
  selectedStatuses,
  setHiddenColumns,
  setSelectedEmails,
  setSelectedNames,
  setSelectedRoles,
  setSelectedStatuses,
  setSortState,
  statusOptions,
}: {
  emailOptions: string[]
  hiddenColumns: InvitationHiddenColumns
  hiddenHeaderStyle: CSSProperties
  nameOptions: string[]
  roleOptions: string[]
  selectedEmails: string[]
  selectedNames: string[]
  selectedRoles: string[]
  selectedStatuses: string[]
  setHiddenColumns: Dispatch<SetStateAction<InvitationHiddenColumns>>
  setSelectedEmails: (values: string[] | null) => void
  setSelectedNames: (values: string[] | null) => void
  setSelectedRoles: (values: string[] | null) => void
  setSelectedStatuses: (values: string[] | null) => void
  setSortState: Dispatch<SetStateAction<InvitationSortState>>
  statusOptions: string[]
}) {
  return (
    <thead>
      <tr>
        <th style={hiddenColumns.name ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.name ? (
            <SettingsHiddenColumnHeader label="Name" onShow={() => setHiddenColumns((current) => ({ ...current, name: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Name"
              values={nameOptions}
              selectedValues={selectedNames}
              onApplyValues={setSelectedNames}
              onSort={(direction) => setSortState({ column: 'name', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, name: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.email ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.email ? (
            <SettingsHiddenColumnHeader label="Email" onShow={() => setHiddenColumns((current) => ({ ...current, email: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Email"
              values={emailOptions}
              selectedValues={selectedEmails}
              onApplyValues={setSelectedEmails}
              onSort={(direction) => setSortState({ column: 'email', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, email: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.role ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.role ? (
            <SettingsHiddenColumnHeader label="Role" onShow={() => setHiddenColumns((current) => ({ ...current, role: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Role"
              values={roleOptions}
              selectedValues={selectedRoles}
              onApplyValues={setSelectedRoles}
              onSort={(direction) => setSortState({ column: 'role', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, role: true }))}
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
        <th style={hiddenColumns.created ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.created ? (
            <SettingsHiddenColumnHeader label="Created" onShow={() => setHiddenColumns((current) => ({ ...current, created: false }))} />
          ) : (
            <SettingsActionColumnHeader
              label="Created"
              onSort={(direction) => setSortState({ column: 'created', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, created: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.accepted ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.accepted ? (
            <SettingsHiddenColumnHeader label="Accepted" onShow={() => setHiddenColumns((current) => ({ ...current, accepted: false }))} />
          ) : (
            <SettingsActionColumnHeader
              label="Accepted"
              onSort={(direction) => setSortState({ column: 'accepted', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, accepted: true }))}
            />
          )}
        </th>
        <th style={projectsTableHeaderStyle}>
          <SettingsActionColumnHeader label="Actions" onSort={(direction) => setSortState({ column: 'name', direction })} />
        </th>
      </tr>
    </thead>
  )
}
