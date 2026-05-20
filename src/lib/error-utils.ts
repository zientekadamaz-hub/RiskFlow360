export function errorText(error: unknown, fallback = 'unknown'): string {
  if (!error) return fallback
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object') {
    const candidate = error as {
      code?: unknown
      details?: unknown
      error_description?: unknown
      hint?: unknown
      message?: unknown
      name?: unknown
    }
    const text = candidate.message ?? candidate.error_description ?? candidate.details ?? candidate.hint ?? candidate.name ?? candidate.code
    if (text != null && text !== '') {
      if (typeof text === 'object') {
        const nested: string = errorText(text, '')
        if (nested) return nested
      }
      return String(text)
    }
    try {
      const serialized = JSON.stringify(error)
      return serialized && serialized !== '{}' ? serialized : fallback
    } catch {
      return fallback
    }
  }
  return String(error) || fallback
}

export function isTimeoutError(error: unknown) {
  return errorText(error).toLowerCase().includes('timeout')
}

export type AppErrorKind = 'auth' | 'conflict' | 'database' | 'network' | 'permission' | 'timeout' | 'validation' | 'unknown'

export type AppError = {
  kind: AppErrorKind
  message: string
  rawMessage: string
}

function normalizeForMatch(error: unknown) {
  return errorText(error, '').trim().toLowerCase()
}

export function classifyAppError(error: unknown): AppErrorKind {
  const text = normalizeForMatch(error)
  if (!text) return 'unknown'

  if (text.includes('timeout') || text.includes('timed out')) return 'timeout'
  if (text.includes('not authenticated') || text.includes('no signed-in user') || text.includes('jwt')) return 'auth'
  if (text.includes('permission denied') || text.includes('access denied') || text.includes('not authorized') || text.includes('forbidden')) {
    return 'permission'
  }
  if (text.includes('duplicate') || text.includes('already exists') || text.includes('unique constraint')) return 'conflict'
  if (text.includes('required') || text.includes('invalid') || text.includes('select at least') || text.includes('select a ')) return 'validation'
  if (
    text.includes('database error') ||
    text.includes('violates') ||
    text.includes('foreign key') ||
    text.includes('not-null') ||
    text.includes('relation') ||
    text.includes('rpc')
  ) {
    return 'database'
  }
  if (text.includes('failed to fetch') || text.includes('network') || text.includes('fetch failed')) return 'network'
  return 'unknown'
}

const DEFAULT_USER_MESSAGES: Record<AppErrorKind, string> = {
  auth: 'Your session could not be verified. Please sign in again.',
  conflict: 'This record conflicts with existing data. Review the current rows and try again.',
  database: 'The database could not complete this operation. Please try again or contact an administrator.',
  network: 'The request could not reach the server. Check the connection and try again.',
  permission: 'You do not have permission to perform this action.',
  timeout: 'The request timed out. Please try again.',
  validation: 'Check the required fields and try again.',
  unknown: 'Something went wrong. Please try again.',
}

export function toAppError(error: unknown, fallback = DEFAULT_USER_MESSAGES.unknown): AppError {
  const rawMessage = errorText(error, fallback)
  const kind = classifyAppError(error)
  return {
    kind,
    message: rawMessage || fallback || DEFAULT_USER_MESSAGES[kind],
    rawMessage,
  }
}

export function toUserErrorMessage(error: unknown, fallback?: string) {
  const appError = toAppError(error, fallback ?? DEFAULT_USER_MESSAGES.unknown)
  if (appError.kind === 'unknown') return fallback ?? appError.message
  return appError.message || fallback || DEFAULT_USER_MESSAGES[appError.kind]
}
