import {
  displayInviteStatus,
  formatInviteRole,
  type AppRole,
  type InviteRow,
  type LicenseRow,
} from './invitations-service'

export type HeaderRpcRow = {
  org_name?: string | null
  org_role?: string | null
  global_role?: AppRole | null
}

export type ActiveProfileRow = {
  active_organization_id?: string | null
}

export type InviteLinkState = {
  email: string
  url: string
}

export type SendInviteResponse = {
  email?: string
  error?: string
  id?: string | null
  inviteUrl?: string
  ok?: boolean
}

export type InvitationStatusFilter = 'ACTIVE' | 'NOACTIVE' | 'PENDING'
export type InvitationColumnKey = 'accepted' | 'created' | 'email' | 'name' | 'role' | 'status'
export type InvitationLayoutColumnKey = InvitationColumnKey | 'actions'
export type InvitationHiddenColumns = Record<InvitationColumnKey, boolean>
export type InvitationSortState = {
  column: InvitationColumnKey
  direction: 'asc' | 'desc'
} | null

export type InvitationFilterState = {
  selectedEmails: string[] | null
  selectedNames: string[] | null
  selectedRoles: string[] | null
  selectedStatuses: string[] | null
}

export type InvitationFilterOptions = {
  emailOptions: string[]
  nameOptions: string[]
  roleOptions: string[]
  statusOptions: InvitationStatusFilter[]
}

export type InvitationSummary = {
  activeChampionCount: number
  activeCount: number
  allowedSeats: number | null
  freeSeats: number | null
  pendingCount: number
  usedSeats: number
}

export const DEFAULT_INVITATION_HIDDEN_COLUMNS: InvitationHiddenColumns = {
  accepted: false,
  created: false,
  email: false,
  name: false,
  role: false,
  status: false,
}

export const BASE_INVITATION_COLUMN_WIDTHS: Record<InvitationLayoutColumnKey, number> = {
  name: 190,
  email: 250,
  role: 145,
  status: 120,
  created: 145,
  accepted: 145,
  actions: 330,
}

export function formatDateTime(value: string | null) {
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

export function normalizeBasePath(value: string | undefined) {
  const raw = value?.trim() ?? ''
  if (!raw || raw === '/') return ''
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`
  return withLeadingSlash.replace(/\/+$/, '')
}

export function inviteDisplayName(row: InviteRow) {
  const full = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()
  return full || '-'
}

export function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )
}

export function compareNullableDate(left: string | null, right: string | null) {
  const leftTime = left ? new Date(left).getTime() : 0
  const rightTime = right ? new Date(right).getTime() : 0
  return (Number.isFinite(leftTime) ? leftTime : 0) - (Number.isFinite(rightTime) ? rightTime : 0)
}

export function invitationSortValue(row: InviteRow, column: InvitationColumnKey) {
  if (column === 'name') return inviteDisplayName(row)
  if (column === 'email') return row.email
  if (column === 'role') return formatInviteRole(row.role)
  if (column === 'status') return displayInviteStatus(row)
  if (column === 'created') return row.created_at ?? ''
  return row.accepted_at ?? ''
}

export function getAllowedInvitationRoles(orgRole: AppRole | null, globalRole: AppRole | null): AppRole[] {
  const canInviteChampion = orgRole === 'champion' || globalRole === 'admin'
  return canInviteChampion ? ['engineer', 'viewer', 'customer', 'champion'] : ['engineer', 'viewer', 'customer']
}

export function getInvitationSummary(invites: InviteRow[], license: LicenseRow | null): InvitationSummary {
  const usedSeats = invites.filter((invite) => ['PENDING', 'ACTIVE'].includes(displayInviteStatus(invite))).length
  const allowedSeats = license?.invites_allowed_total ?? null
  const freeSeats = allowedSeats === null ? null : Math.max(0, allowedSeats - usedSeats)
  const pendingCount = invites.filter((invite) => displayInviteStatus(invite) === 'PENDING').length
  const activeCount = invites.filter((invite) => displayInviteStatus(invite) === 'ACTIVE').length
  const activeChampionCount = invites.filter(
    (invite) => invite.source === 'member' && displayInviteStatus(invite) === 'ACTIVE' && invite.role === 'champion'
  ).length

  return {
    activeChampionCount,
    activeCount,
    allowedSeats,
    freeSeats,
    pendingCount,
    usedSeats,
  }
}

export function getInvitationFilterOptions(invites: InviteRow[]): InvitationFilterOptions {
  return {
    emailOptions: uniqueSorted(invites.map((invite) => invite.email)),
    nameOptions: uniqueSorted(invites.map(inviteDisplayName)),
    roleOptions: uniqueSorted(invites.map((invite) => formatInviteRole(invite.role))),
    statusOptions: uniqueSorted(invites.map((invite) => displayInviteStatus(invite) as InvitationStatusFilter)) as InvitationStatusFilter[],
  }
}

export function getDisplayedInvites(invites: InviteRow[], filters: InvitationFilterState, sortState: InvitationSortState) {
  const nameSet = filters.selectedNames === null ? null : new Set(filters.selectedNames)
  const emailSet = filters.selectedEmails === null ? null : new Set(filters.selectedEmails)
  const roleSet = filters.selectedRoles === null ? null : new Set(filters.selectedRoles)
  const statusSet = filters.selectedStatuses === null ? null : new Set(filters.selectedStatuses)

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
}

export function mapInviteError(message: string) {
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
