export type HeaderAuthState = 'unknown' | 'authed' | 'unauthed'
export type HeaderAppRole = 'admin' | 'champion' | 'engineer' | 'viewer' | 'customer' | string
export type HeaderMenuItem = {
  href: string
  key: string
  label: string
}

const NO_ORG_ALLOWED_PREFIXES = ['/waiting-for-invite', '/request-access', '/login', '/signup']

export const reportsMenuItems: HeaderMenuItem[] = [
  { href: '/reports/rpn-matrix', key: 'rpn', label: 'RPN Matrix' },
  { href: '/reports/progress-chart', key: 'progress', label: 'Progress Chart' },
]

export const settingsMenuItems: HeaderMenuItem[] = [
  { href: '/settings/risk-matrix', key: 'risk', label: 'Risk Matrix' },
  { href: '/settings/severity', key: 'severity', label: 'Severity' },
  { href: '/settings/occurrence', key: 'occurrence', label: 'Occurrence' },
  { href: '/settings/detection', key: 'detection', label: 'Detection' },
  { href: '/settings/sites-departments', key: 'sites-departments', label: 'Sites & Departments' },
  { href: '/settings/invitations', key: 'invitations', label: 'Invitations' },
  { href: '/settings/customer-access', key: 'customer-access', label: 'Customer Access' },
]

export const adminMenuItems: HeaderMenuItem[] = [
  { href: '/settings/organizations', key: 'organizations', label: 'Organizations' },
  { href: '/settings/ui-preview', key: 'ui-preview', label: 'UI Preview' },
]

function normalizeRole(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function isPathMatch(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function shouldShowAuthedHeader(mounted: boolean, authState: HeaderAuthState) {
  return mounted && authState === 'authed'
}

export function canSeeSettingsFor(isAuthed: boolean, userRole: HeaderAppRole | null, orgRole: string | null) {
  return isAuthed && (normalizeRole(userRole) === 'admin' || normalizeRole(orgRole) === 'champion')
}

export function canSeeAdminFor(isAuthed: boolean, userRole: HeaderAppRole | null) {
  return isAuthed && normalizeRole(userRole) === 'admin'
}

export function displayRoleFor(userRole: HeaderAppRole | null, orgRole: string | null) {
  const normalizedUserRole = normalizeRole(userRole)
  const normalizedOrgRole = normalizeRole(orgRole)
  const preferredRole = normalizedUserRole === 'admin' ? normalizedUserRole : normalizedOrgRole || normalizedUserRole
  if (!preferredRole) return ''
  return preferredRole.charAt(0).toUpperCase() + preferredRole.slice(1)
}

export function displayFullNameFor(firstName: string | null, lastName: string | null) {
  const fn = (firstName ?? '').trim()
  const ln = (lastName ?? '').trim()
  const full = `${fn} ${ln}`.trim()
  return full || null
}

export function displayOrgNameFor(orgName: string | null, userRole: HeaderAppRole | null) {
  if (normalizeRole(userRole) === 'admin') return null
  const value = (orgName ?? '').trim()
  return value || null
}

export function isNoOrgAllowedPath(pathname: string) {
  return NO_ORG_ALLOWED_PREFIXES.some((prefix) => isPathMatch(pathname, prefix))
}

export function buildHeaderAssetPath(path: string, basePath = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const normalizedBase = basePath.trim()
  if (!normalizedBase) return normalizedPath
  const withLeadingSlash = normalizedBase.startsWith('/') ? normalizedBase : `/${normalizedBase}`
  return `${withLeadingSlash.replace(/\/+$/, '')}${normalizedPath}`
}
