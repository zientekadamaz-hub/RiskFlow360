export type HeaderRow = {
  global_role?: string | null
}

export type OrganizationRow = {
  organization_id: string
  organization_name: string
  active: boolean
  created_at: string | null
  seats_purchased: number | null
  invites_allowed_total: number | null
  valid_to: string | null
  champion_email: string | null
  champion_first_name: string | null
  champion_last_name: string | null
  champion_status: string | null
  champion_source: string | null
  champion_invitation_token?: string | null
}

export type CreateOrganizationResult = {
  organization_id: string
  organization_name: string
  champion_email: string
  champion_first_name: string | null
  champion_last_name: string | null
  champion_status: string
  invitation_id: string | null
  invitation_token: string | null
}

export type LatestInviteLink = {
  email: string
  url: string
}

export type AccessRequestRow = {
  request_id: string
  company_name: string
  requester_email: string
  first_name: string | null
  last_name: string | null
  requested_invites: number | null
  status: string | null
  notes_admin: string | null
  created_at: string | null
  handled_at: string | null
  handled_by: string | null
  handled_by_name: string | null
}

export type SortDirection = 'asc' | 'desc'
export type OrganizationColumnKey = 'champion' | 'created' | 'invites' | 'organization' | 'seats' | 'status' | 'validTo'
export type OrganizationLayoutColumnKey = OrganizationColumnKey | 'actions'
export type OrganizationHiddenColumns = Record<OrganizationColumnKey, boolean>
export type OrganizationSortState = { column: OrganizationColumnKey; direction: SortDirection }

export type OrganizationTableRow =
  | {
      kind: 'organization'
      key: string
      organization: OrganizationRow
      organizationName: string
      championName: string
      championEmail: string | null
      status: string
      seats: number | null
      invites: number | null
      validTo: string | null
      createdAt: string | null
    }
  | {
      kind: 'request'
      key: string
      request: AccessRequestRow
      organizationName: string
      championName: string
      championEmail: string | null
      status: 'NEW'
      seats: number | null
      invites: number | null
      validTo: string | null
      createdAt: string | null
    }

export type OrganizationFilterState = {
  selectedChampionStatuses: string[] | null
  selectedChampions: string[] | null
  selectedCreatedDates: string[] | null
  selectedInvites: string[] | null
  selectedOrganizations: string[] | null
  selectedSeats: string[] | null
  selectedValidDates: string[] | null
}

export type OrganizationFilterOptions = {
  championOptions: string[]
  championStatusOptions: string[]
  createdDateOptions: string[]
  inviteOptions: string[]
  organizationOptions: string[]
  seatOptions: string[]
  validDateOptions: string[]
}

export type OrganizationSummary = {
  assignedChampionCount: number
  pendingAccessRequestCount: number
  pendingChampionCount: number
}

export const DEFAULT_ORGANIZATION_HIDDEN_COLUMNS: OrganizationHiddenColumns = {
  champion: false,
  created: false,
  invites: false,
  organization: false,
  seats: false,
  status: false,
  validTo: false,
}

export const BASE_ORGANIZATION_COLUMN_WIDTHS: Record<OrganizationLayoutColumnKey, number> = {
  organization: 240,
  champion: 300,
  status: 140,
  seats: 92,
  invites: 100,
  validTo: 130,
  created: 130,
  actions: 180,
}

export function normalizeBasePath(value: string | undefined) {
  const raw = value?.trim() ?? ''
  if (!raw || raw === '/') return ''
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`
  return withLeadingSlash.replace(/\/+$/, '')
}

export function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' })
  )
}

export function formatDate(value: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function compareNullableDate(left: string | null, right: string | null) {
  const leftTime = left ? new Date(left).getTime() : 0
  const rightTime = right ? new Date(right).getTime() : 0
  return (Number.isFinite(leftTime) ? leftTime : 0) - (Number.isFinite(rightTime) ? rightTime : 0)
}

export function compareNumbers(left: number | null, right: number | null) {
  return (left ?? 0) - (right ?? 0)
}

export function formatChampionName(row: OrganizationRow) {
  const full = `${row.champion_first_name ?? ''} ${row.champion_last_name ?? ''}`.trim()
  if (full) return full
  return row.champion_email ?? '-'
}

export function requesterName(row: AccessRequestRow) {
  return `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.requester_email
}

export function statusLabel(value: string | null) {
  return (value ?? '-').toUpperCase()
}

export function isOpenAccessRequestStatus(value: string | null) {
  const normalized = statusLabel(value)
  return normalized === '-' || normalized === 'NEW' || normalized === 'PENDING'
}

export function getOrganizationSummary(rows: OrganizationRow[], accessRequests: AccessRequestRow[]): OrganizationSummary {
  return {
    assignedChampionCount: rows.filter((row) => statusLabel(row.champion_status) === 'ASSIGNED').length,
    pendingAccessRequestCount: accessRequests.filter((row) => isOpenAccessRequestStatus(row.status)).length,
    pendingChampionCount: rows.filter((row) => statusLabel(row.champion_status) === 'PENDING').length,
  }
}

export function buildOrganizationTableRows(rows: OrganizationRow[], accessRequests: AccessRequestRow[]): OrganizationTableRow[] {
  const organizationRows: OrganizationTableRow[] = rows.map((row) => ({
    kind: 'organization',
    key: `organization-${row.organization_id}`,
    organization: row,
    organizationName: row.organization_name,
    championName: formatChampionName(row),
    championEmail: row.champion_email,
    status: statusLabel(row.champion_status),
    seats: row.seats_purchased,
    invites: row.invites_allowed_total,
    validTo: row.valid_to,
    createdAt: row.created_at,
  }))

  const requestRows: OrganizationTableRow[] = accessRequests
    .filter((row) => isOpenAccessRequestStatus(row.status))
    .map((row) => ({
      kind: 'request',
      key: `request-${row.request_id}`,
      request: row,
      organizationName: row.company_name,
      championName: requesterName(row),
      championEmail: row.requester_email,
      status: 'NEW',
      seats: row.requested_invites,
      invites: row.requested_invites,
      validTo: null,
      createdAt: row.created_at,
    }))

  return [...organizationRows, ...requestRows]
}

export function getOrganizationFilterOptions(organizationTableRows: OrganizationTableRow[]): OrganizationFilterOptions {
  return {
    championOptions: uniqueSorted(organizationTableRows.map((row) => row.championName)),
    championStatusOptions: uniqueSorted(organizationTableRows.map((row) => row.status)),
    createdDateOptions: uniqueSorted(organizationTableRows.map((row) => formatDate(row.createdAt))),
    inviteOptions: uniqueSorted(organizationTableRows.map((row) => String(row.invites ?? '-'))),
    organizationOptions: uniqueSorted(organizationTableRows.map((row) => row.organizationName)),
    seatOptions: uniqueSorted(organizationTableRows.map((row) => String(row.seats ?? '-'))),
    validDateOptions: uniqueSorted(organizationTableRows.map((row) => formatDate(row.validTo))),
  }
}

export function getDisplayedOrganizations(
  organizationTableRows: OrganizationTableRow[],
  filters: OrganizationFilterState,
  organizationSortState: OrganizationSortState
) {
  const organizationSet = filters.selectedOrganizations === null ? null : new Set(filters.selectedOrganizations)
  const championSet = filters.selectedChampions === null ? null : new Set(filters.selectedChampions)
  const statusSet = filters.selectedChampionStatuses === null ? null : new Set(filters.selectedChampionStatuses)
  const seatSet = filters.selectedSeats === null ? null : new Set(filters.selectedSeats)
  const inviteSet = filters.selectedInvites === null ? null : new Set(filters.selectedInvites)
  const validSet = filters.selectedValidDates === null ? null : new Set(filters.selectedValidDates)
  const createdSet = filters.selectedCreatedDates === null ? null : new Set(filters.selectedCreatedDates)

  const filtered = organizationTableRows.filter((row) => {
    return (
      (organizationSet === null || organizationSet.has(row.organizationName)) &&
      (championSet === null || championSet.has(row.championName)) &&
      (statusSet === null || statusSet.has(row.status)) &&
      (seatSet === null || seatSet.has(String(row.seats ?? '-'))) &&
      (inviteSet === null || inviteSet.has(String(row.invites ?? '-'))) &&
      (validSet === null || validSet.has(formatDate(row.validTo))) &&
      (createdSet === null || createdSet.has(formatDate(row.createdAt)))
    )
  })

  return [...filtered].sort((left, right) => {
    let comparison = 0
    if (organizationSortState.column === 'organization') {
      comparison = left.organizationName.localeCompare(right.organizationName, undefined, { sensitivity: 'base' })
    } else if (organizationSortState.column === 'champion') {
      comparison = left.championName.localeCompare(right.championName, undefined, { sensitivity: 'base' })
    } else if (organizationSortState.column === 'status') {
      comparison = left.status.localeCompare(right.status, undefined, { sensitivity: 'base' })
    } else if (organizationSortState.column === 'seats') {
      comparison = compareNumbers(left.seats, right.seats)
    } else if (organizationSortState.column === 'invites') {
      comparison = compareNumbers(left.invites, right.invites)
    } else if (organizationSortState.column === 'validTo') {
      comparison = compareNullableDate(left.validTo, right.validTo)
    } else {
      comparison = compareNullableDate(left.createdAt, right.createdAt)
    }
    return organizationSortState.direction === 'asc' ? comparison : -comparison
  })
}
