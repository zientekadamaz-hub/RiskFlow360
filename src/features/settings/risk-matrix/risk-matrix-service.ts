import { supabase } from '@app/lib/supabaseBrowser'
import { cellKey } from './matrix-config'
import type { RiskColor } from './matrix-colors'
import type { RiskMatrixContext, RiskMatrixDbCell, RiskMatrixDbConfig, RiskMatrixMode, RpnThresholds } from './types'
import {
  DEFAULT_RPN,
  QUERY_TIMEOUT_MS,
  buildDefaultCells,
  delay,
  errorText,
  isTimeoutError,
  withTimeout,
} from './risk-matrix-utils'

const SESSION_RETRY_COUNT = 8
const SESSION_RETRY_DELAY_MS = 250
const GLOBAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000'
const ORGANIZATION_NOTICE = 'Changes are saved automatically for the active organization.'
const ADMIN_ORGANIZATION_NOTICE = 'Changes are saved automatically for the active organization. This is the same Risk Matrix used by RPN Matrix reports for that organization.'

type QueryResult<T> = {
  data: T | null
  error: unknown
  status?: number
  statusText?: string
}

const timeoutError = {
  code: 'RISK_MATRIX_TIMEOUT',
  details: 'Risk Matrix query timed out.',
  hint: '',
  message: 'timeout',
  name: 'RiskMatrixTimeout',
}

function hasAuthCookie() {
  if (typeof document === 'undefined') return false

  return document.cookie
    .split(';')
    .map((cookie) => cookie.trim().split('=')[0])
    .some((name) => name.startsWith('sb-') && name.includes('auth-token'))
}

function isMissingColumnError(error: unknown, columnName: string) {
  const text = errorText(error).toLowerCase()
  return text.includes(`column`) && text.includes(columnName.toLowerCase()) && text.includes('does not exist')
}

export async function getRiskMatrixSessionUser() {
  for (let i = 0; i < SESSION_RETRY_COUNT; i += 1) {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user ?? null
    if (user) return user
    if (!hasAuthCookie()) return null

    if (i === 2 || i === 5) {
      try {
        await supabase.auth.refreshSession()
      } catch {}
    }

    await delay(SESSION_RETRY_DELAY_MS)
  }

  return null
}

export async function loadRiskMatrixContext(): Promise<{
  context: RiskMatrixContext | null
  error: string | null
  globalRole: string | null
  organizationId: string | null
  timeout: boolean
  userId: string | null
}> {
  const user = await getRiskMatrixSessionUser()
  if (!user) {
    return { context: null, error: 'Cannot read user: Not authenticated.', globalRole: null, organizationId: null, timeout: false, userId: null }
  }

  const result = await withTimeout(
    supabase
      .from('profiles')
      .select('active_organization_id,global_role')
      .eq('id', user.id)
      .maybeSingle(),
    QUERY_TIMEOUT_MS,
    { count: null, data: null, error: timeoutError, status: 408, statusText: 'timeout' }
  ) as QueryResult<{ active_organization_id?: string | null; global_role?: string | null }>

  if (result.error) {
    const text = errorText(result.error)
    console.error(`LOAD ORG ERROR | HTTP ${result.status ?? '??'} ${result.statusText ?? ''} | ${text}`, result.error)
    return {
      context: null,
      error: `Cannot load organization: ${text}`,
      globalRole: null,
      organizationId: null,
      timeout: isTimeoutError(result.error),
      userId: user.id,
    }
  }

  const organizationId = result.data?.active_organization_id ?? null
  const globalRole = result.data?.global_role ?? null

  if (organizationId) {
    return {
      context: {
        globalRole,
        id: organizationId,
        kind: 'organization',
        notice: globalRole === 'admin' ? ADMIN_ORGANIZATION_NOTICE : ORGANIZATION_NOTICE,
        userId: user.id,
      },
      error: null,
      globalRole,
      organizationId,
      timeout: false,
      userId: user.id,
    }
  }

  return {
    context: null,
    error: 'No active organization selected for this user.',
    globalRole,
    organizationId: null,
    timeout: false,
    userId: user.id,
  }
}

export async function loadRiskMatrixConfig(context: RiskMatrixContext): Promise<{
  config: { mode: RiskMatrixMode; rpn: RpnThresholds } | null
  error: string | null
}> {
  const query = context.kind === 'organization'
    ? supabase
      .from('risk_matrix_config')
      .select('id,mode,rpn_green_max,rpn_yellow_max,rpn_orange_max,organization_id')
      .eq('organization_id', context.id)
      .maybeSingle()
    : null

  if (!query) {
    return { config: { mode: 'manual', rpn: DEFAULT_RPN }, error: null }
  }

  const result = await withTimeout(
    query,
    QUERY_TIMEOUT_MS,
    { count: null, data: null, error: timeoutError, status: 408, statusText: 'timeout' }
  ) as QueryResult<RiskMatrixDbConfig>

  if (result.error) {
    const text = errorText(result.error)
    console.error(`LOAD CONFIG ERROR | HTTP ${result.status ?? '??'} ${result.statusText ?? ''} | ${text}`, result.error)
    return { config: null, error: `Cannot load config: ${text}` }
  }

  if (!result.data) {
    return { config: { mode: 'manual', rpn: DEFAULT_RPN }, error: null }
  }

  return {
    config: {
      mode: result.data.mode,
      rpn: {
        greenMax: result.data.rpn_green_max,
        orangeMax: result.data.rpn_orange_max,
        yellowMax: result.data.rpn_yellow_max,
      },
    },
    error: null,
  }
}

export async function saveRiskMatrixConfig(context: RiskMatrixContext, mode: RiskMatrixMode, rpn: RpnThresholds) {
  const payload: Record<string, unknown> = {
    mode,
    rpn_green_max: rpn.greenMax,
    rpn_orange_max: rpn.orangeMax,
    rpn_yellow_max: rpn.yellowMax,
    updated_at: new Date().toISOString(),
  }

  if (context.kind === 'system_default') {
    payload.project_id = GLOBAL_PROJECT_ID
  } else {
    payload.organization_id = context.id
  }

  if (context.kind !== 'organization') {
    return 'Cannot save config: no active organization selected.'
  }

  const { error, status, statusText } = await supabase
    .from('risk_matrix_config')
    .upsert(payload, { onConflict: 'organization_id' })

  if (!error) return null

  const text = errorText(error)
  console.error(`SAVE CONFIG ERROR | HTTP ${status ?? '??'} ${statusText ?? ''} | ${text}`, error)
  return `Cannot save config: ${text}`
}

export async function loadRiskMatrixCells(context: RiskMatrixContext): Promise<{ cells: Record<string, RiskColor> | null; error: string | null }> {
  const base = buildDefaultCells()

  if (context.kind === 'organization') {
    const result = await withTimeout(
      supabase
        .from('risk_matrix_cells')
        .select('organization_id,severity,do_value,color')
        .eq('organization_id', context.id),
      QUERY_TIMEOUT_MS,
      { count: null, data: null, error: timeoutError, status: 408, statusText: 'timeout' }
    ) as QueryResult<RiskMatrixDbCell[]>

    if (result.error) {
      const text = errorText(result.error)
      console.error(`LOAD MATRIX ERROR | HTTP ${result.status ?? '??'} ${result.statusText ?? ''} | ${text}`, result.error)
      return { cells: null, error: `Cannot load matrix: ${text}` }
    }

    if (!result.data?.length) return { cells: base, error: null }

    const next = { ...base }
    for (const row of result.data) next[cellKey(row.severity, row.do_value)] = row.color

    return { cells: next, error: null }
  }

  const result = await withTimeout(
    supabase
      .from('risk_matrix_cells')
      .select('organization_id,project_id,severity,do_value,color')
      .eq('project_id', GLOBAL_PROJECT_ID),
    QUERY_TIMEOUT_MS,
    { count: null, data: null, error: timeoutError, status: 408, statusText: 'timeout' }
  ) as QueryResult<RiskMatrixDbCell[]>

  if (result.error) {
    const text = errorText(result.error)
    if (isMissingColumnError(result.error, 'project_id')) {
      return { cells: base, error: null }
    }

    console.error(`LOAD MATRIX ERROR | HTTP ${result.status ?? '??'} ${result.statusText ?? ''} | ${text}`, result.error)
    return { cells: null, error: `Cannot load matrix: ${text}` }
  }

  if (!result.data?.length) return { cells: base, error: null }

  const next = { ...base }
  for (const row of result.data) next[cellKey(row.severity, row.do_value)] = row.color

  return { cells: next, error: null }
}

export async function saveRiskMatrixCells(context: RiskMatrixContext, changes: Record<string, RiskColor>) {
  const entries = Object.entries(changes)
  if (!entries.length) return null

  const payload: RiskMatrixDbCell[] = entries.map(([key, color]) => {
    const [severity, doValue] = key.split('|').map(Number)
    if (context.kind === 'system_default') {
      return { color, do_value: doValue, project_id: GLOBAL_PROJECT_ID, severity }
    }

    return { color, do_value: doValue, organization_id: context.id, severity }
  })

  const { error, status, statusText } = await supabase
    .from('risk_matrix_cells')
    .upsert(payload, { onConflict: context.kind === 'system_default' ? 'project_id,severity,do_value' : 'organization_id,severity,do_value' })

  if (!error) return null

  const text = errorText(error)
  if (context.kind === 'system_default' && isMissingColumnError(error, 'project_id')) {
    return {
      message: 'Cannot save default manual matrix cells until the database migration for system default Risk Matrix cells is applied.',
      restoredChanges: payload.reduce<Record<string, RiskColor>>((acc, row) => {
        acc[cellKey(row.severity, row.do_value)] = row.color
        return acc
      }, {}),
    }
  }

  console.error(`UPSERT ERROR | HTTP ${status ?? '??'} ${statusText ?? ''} | ${text}`, error)
  return {
    message: `Cannot save manual changes: ${text}`,
    restoredChanges: payload.reduce<Record<string, RiskColor>>((acc, row) => {
      acc[cellKey(row.severity, row.do_value)] = row.color
      return acc
    }, {}),
  }
}
