const PUBLIC_PREFIXES = ['/login', '/signup', '/request-access', '/waiting-for-invite', '/api/auth', '/api/request-access']
const PUBLIC_HEADER_PREFIXES: string[] = []

export type NavItem = {
  href: string
  label: string
  description?: string
}

export const moduleNavItems: NavItem[] = [
  { href: '/projects', label: 'Projects', description: 'Zarzadzanie projektami i wyborem danych procesu.' },
  { href: '/pfd', label: 'PFD', description: 'Model procesu i krokow operacyjnych.' },
  { href: '/pfmea', label: 'PFMEA', description: 'Analiza ryzyka procesu i hierarchia FM / Effect / Cause.' },
  { href: '/pcp', label: 'PCP', description: 'Plan kontroli powiazany z PFD i PFMEA.' },
]

export const settingsNavItems: NavItem[] = [
  { href: '/settings/organizations', label: 'Organizations' },
  { href: '/settings/risk-matrix', label: 'Risk Matrix' },
  { href: '/settings/severity', label: 'Severity' },
  { href: '/settings/occurrence', label: 'Occurrence' },
  { href: '/settings/detection', label: 'Detection' },
  { href: '/settings/sites-departments', label: 'Sites & Departments' },
  { href: '/settings/invitations', label: 'Invitations' },
  { href: '/settings/customer-access', label: 'Customer Access' },
]

export function isPublicPath(pathname: string) {
  if (pathname === '/') return true
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function usesPublicHeader(pathname: string) {
  if (isPublicPath(pathname)) return true
  return PUBLIC_HEADER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function sanitizeRedirectPath(rawPath: string | null | undefined, fallback = '/') {
  const value = rawPath?.trim()
  if (!value) return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback

  try {
    const url = new URL(value, 'https://riskflow.local')
    if (url.origin !== 'https://riskflow.local') return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

export function buildLoginRedirect(pathname: string, search = '') {
  const next = sanitizeRedirectPath(`${pathname}${search}`, '/')
  return `/login?next=${encodeURIComponent(next)}`
}
