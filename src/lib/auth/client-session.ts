import { supabase } from '@app/lib/supabaseBrowser'
import { sanitizeRedirectPath } from '@/lib/routing'

export const HEADER_CACHE_KEY = '__APP_HEADER_CACHE__'
export const SETTINGS_ACCESS_CACHE_KEY = '__SETTINGS_ACCESS_OK__'
export const LAST_ACTIVITY_KEY = '__APP_LAST_ACTIVITY_AT__'

const SESSION_RETRY_COUNT = 8
const SESSION_RETRY_DELAY_MS = 250
const HEADER_CACHE_TTL_MS = 30 * 60 * 1000

export type AppRole = 'admin' | 'champion' | 'engineer' | 'viewer' | 'customer' | string

export type HeaderRpcRow = {
  first_name?: string | null
  last_name?: string | null
  org_name?: string | null
  org_role?: string | null
  global_role?: AppRole | null
}

export type HeaderCacheEntry = {
  ts: number
  userId: string
  firstName: string | null
  lastName: string | null
  orgName: string | null
  orgRole: string | null
  userRole: AppRole | null
}

export function hasSupabaseAuthCookie() {
  if (typeof document === 'undefined') return false
  return document.cookie
    .split(';')
    .map((cookieValue) => cookieValue.trim().split('=')[0])
    .some((name) => name.startsWith('sb-') && name.includes('auth-token'))
}

export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), ms)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function getSessionUserWithRetries() {
  for (let index = 0; index < SESSION_RETRY_COUNT; index += 1) {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.user) {
      return session.user
    }

    if (!hasSupabaseAuthCookie()) {
      return null
    }

    if (index === 2 || index === 5) {
      try {
        await supabase.auth.refreshSession()
      } catch {}
    }

    await delay(SESSION_RETRY_DELAY_MS)
  }

  return null
}

export async function getActiveOrganizationId(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.active_organization_id ?? null
}

export async function getHeaderContext() {
  const { data, error } = await supabase.rpc('get_my_header').maybeSingle()

  if (error) {
    return { status: 'error' as const, row: null }
  }

  if (!data) {
    return { status: 'no-org' as const, row: null }
  }

  const row = data as HeaderRpcRow
  if (row.global_role === 'admin') {
    return { status: 'ok' as const, row }
  }

  if (!row.org_name || !row.org_role) {
    return { status: 'no-org' as const, row }
  }

  return { status: 'ok' as const, row }
}

export function getDisplayName(firstName?: string | null, lastName?: string | null) {
  const first = firstName?.trim() ?? ''
  const last = lastName?.trim() ?? ''
  return `${first} ${last}`.trim() || null
}

export function isSettingsAllowed(row: HeaderRpcRow | null) {
  if (!row) return false
  return row.global_role === 'admin' || row.org_role === 'champion'
}

export function readHeaderCache() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(HEADER_CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as HeaderCacheEntry
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.ts !== 'number' || typeof parsed.userId !== 'string') return null
    if (Date.now() - parsed.ts > HEADER_CACHE_TTL_MS) return null

    return parsed
  } catch {
    return null
  }
}

export function writeHeaderCache(entry: Omit<HeaderCacheEntry, 'ts'>) {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.setItem(
      HEADER_CACHE_KEY,
      JSON.stringify({
        ...entry,
        ts: Date.now(),
      })
    )
  } catch {}
}

export function clearHeaderCache() {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.removeItem(HEADER_CACHE_KEY)
  } catch {}
}

export function getSafeRedirectTarget(rawPath: string | null | undefined, fallback = '/') {
  return sanitizeRedirectPath(rawPath, fallback)
}
