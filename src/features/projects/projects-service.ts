import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  HeaderRpcRow,
  Mode,
  OpenRiskSummary,
  PfdHistoryTooltipRow,
  ProjectPfmeaStat,
  ProjectRowDb,
  RevisionPopupData,
  RevisionPopupRow,
  RiskColor,
  RpnThresholds,
  SiteDepartmentOption,
  UserCtx,
} from './types'
import {
  getRiskColorFor,
  normalizeProjectText,
  cleanProductList,
  clampInt,
  cellKey,
  formatDateTimePL,
  sectionRevisionFromLabel,
} from './utils'
import { collectPfmeaCurrentOpenRisks, type PfmeaReportRiskRow } from '@/features/reports/pfmea-report-risk-utils'

type ProfileOrgRow = {
  active_organization_id?: string | null
}

type SiteDepartmentRowDb = {
  id?: string | null
  site?: string | null
  department?: string | null
  active?: boolean | null
}

type RiskMatrixConfigRow = {
  id?: number | null
  mode?: Mode | null
  organization_id?: string | null
  project_id?: string | null
  rpn_green_max?: number | null
  rpn_yellow_max?: number | null
  rpn_orange_max?: number | null
}

type RiskMatrixCellRow = {
  severity?: number | null
  do_value?: number | null
  color?: RiskColor | null
  organization_id?: string | null
  project_id?: string | null
}

type PfmeaStatsRow = {
  action_plan_group_id?: string | null
  failure_block_group_id?: string | null
  failure_mode_group_id?: string | null
  id?: string | null
  operation_id?: string | null
  row_no?: string | null
  revision_id?: string | null
  rpn?: number | null
  rpn_current?: number | null
  severity?: number | null
  occurrence?: number | null
  detection?: number | null
  oxd_current?: number | null
  created_at?: string | null
  operations?: { id?: string | null; project_id?: string | null; active?: boolean | null } | Array<{ id?: string | null; project_id?: string | null; active?: boolean | null }> | null
}

const PROJECT_STATUSES = ['DRAFT', 'OPEN', 'OBSOLETE'] as const
const GLOBAL_RISK_MATRIX_CONFIG_ID = 1
const GLOBAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000'

function requireOrganizationId(orgId: string | null): string {
  const normalized = normalizeProjectText(orgId)
  if (!normalized) throw new Error('No active organization selected.')
  return normalized
}

function normalizeProjectStatus(value: string) {
  const normalized = normalizeProjectText(value).toUpperCase()
  if (!PROJECT_STATUSES.includes(normalized as (typeof PROJECT_STATUSES)[number])) {
    throw new Error('Invalid project status.')
  }
  return normalized
}

export async function fetchProjectsUserContext(
  supabase: SupabaseClient,
  userId: string
): Promise<UserCtx> {
  let orgId: string | null = null
  let orgRole: string | null = null
  let globalRole: string | null = null

  const [profileRes, headerRes] = await Promise.all([
    supabase.from('profiles').select('active_organization_id').eq('id', userId).maybeSingle(),
    supabase.rpc('get_my_header').maybeSingle(),
  ])

  orgId = ((profileRes.data as ProfileOrgRow | null)?.active_organization_id ?? null)

  if (!headerRes.error && headerRes.data) {
    const header = headerRes.data as HeaderRpcRow
    orgRole = header.org_role ?? null
    globalRole = header.global_role ?? null
  }

  const normalizedOrgRole = (orgRole ?? '').toLowerCase()
  const isAdmin = (globalRole ?? '').toLowerCase() === 'admin'
  const isChampion = normalizedOrgRole === 'champion'
  const isCustomer = normalizedOrgRole === 'customer'
  const canManageProjects = isAdmin || isChampion || normalizedOrgRole === 'engineer'

  return {
    userId,
    orgId,
    globalRole,
    orgRole,
    canDelete: isAdmin || isChampion,
    isChampion,
    isCustomer,
    canManageProjects,
  }
}

export async function fetchProjectSiteDepartments(
  supabase: SupabaseClient,
  orgId: string | null
): Promise<{
  siteOptions: string[]
  siteDeptRows: SiteDepartmentOption[]
  siteDeptMap: Record<string, { site: string; department: string }>
}> {
  if (!orgId) {
    return { siteOptions: [], siteDeptRows: [], siteDeptMap: {} }
  }

  const { data, error } = await supabase
    .from('site_departments')
    .select('id,site,department,active')
    .eq('organization_id', orgId)
    .order('site')
    .order('department')

  if (error) {
    return { siteOptions: [], siteDeptRows: [], siteDeptMap: {} }
  }

  const rows = ((data ?? []) as SiteDepartmentRowDb[])
    .filter((row) => row?.active !== false)
    .map((row) => ({
      id: String(row.id ?? ''),
      site: normalizeProjectText(row.site),
      department: normalizeProjectText(row.department),
    }))
    .filter((row) => row.id && row.site && row.department)

  const siteOptions = Array.from(new Set(rows.map((row) => row.site))).sort((a, b) => a.localeCompare(b))
  const siteDeptMap: Record<string, { site: string; department: string }> = {}
  for (const row of rows) {
    siteDeptMap[row.id] = { site: row.site, department: row.department }
  }

  return { siteOptions, siteDeptRows: rows, siteDeptMap }
}

export async function fetchProjectsWithRevision(
  supabase: SupabaseClient,
  orgId: string | null
): Promise<ProjectRowDb[]> {
  const organizationId = normalizeProjectText(orgId)
  if (!organizationId) return []

  const { data, error } = await supabase
    .from('projects_with_revision')
    .select(
      'id,organization_id,name,site_department_id,status,created_at,updated_at,user_id,updated_by,products,open_revision_label,draft_revision_label,current_open_revision_id,current_draft_revision_id'
    )
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ProjectRowDb[]
}

export async function createProjectRecord(
  supabase: SupabaseClient,
  params: {
    orgId: string | null
    userId: string
    rawProjects: ProjectRowDb[]
    siteDeptRows: SiteDepartmentOption[]
    processName: string
    siteName: string
    departmentName: string
    products: string[]
  }
) {
  const organizationId = requireOrganizationId(params.orgId)
  const processName = params.processName.trim()
  const nameKey = processName.toLowerCase()
  const existsLocal = params.rawProjects.some((project) => normalizeProjectText(project.name).toLowerCase() === nameKey)
  if (existsLocal) throw new Error('Process name already exists.')

  const siteDeptId =
    params.siteDeptRows.find((row) => row.site === params.siteName.trim() && row.department === params.departmentName.trim())?.id ?? null
  if (!siteDeptId) throw new Error('Invalid Site + Department selection.')

  const dupCheck = await supabase
    .from('projects')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', processName)
    .limit(1)
  if (dupCheck.error) throw dupCheck.error
  if (dupCheck.data && dupCheck.data.length) throw new Error('Process name already exists.')

  const payload: Record<string, unknown> = {
    organization_id: organizationId,
    site_department_id: siteDeptId,
    status: 'DRAFT',
    updated_at: new Date().toISOString(),
    name: processName,
    standard: 'GENERIC',
    user_id: params.userId || null,
    updated_by: params.userId || null,
  }

  const productsList = cleanProductList(params.products)
  if (productsList.length) payload.products = productsList.join(', ')

  let insertRes = await supabase.from('projects').insert([payload])
  if (insertRes.error && /products?/i.test(insertRes.error.message)) {
    const fallback = { ...payload }
    delete fallback.products
    insertRes = await supabase.from('projects').insert([fallback])
  }
  if (insertRes.error) throw new Error(insertRes.error.message)
}

export async function updateProjectRecord(
  supabase: SupabaseClient,
  params: {
    editingId: string
    orgId: string | null
    userId: string
    rawProjects: ProjectRowDb[]
    siteDeptRows: SiteDepartmentOption[]
    processName: string
    siteName: string
    departmentName: string
    status: string
    products: string[]
  }
) {
  const organizationId = requireOrganizationId(params.orgId)
  const processName = params.processName.trim()
  const status = normalizeProjectStatus(params.status)
  const nameKey = processName.toLowerCase()
  const existsLocal = params.rawProjects.some(
    (project) => project.id !== params.editingId && normalizeProjectText(project.name).toLowerCase() === nameKey
  )
  if (existsLocal) throw new Error('Process name already exists.')

  const siteDeptId =
    params.siteDeptRows.find((row) => row.site === params.siteName.trim() && row.department === params.departmentName.trim())?.id ?? null
  if (!siteDeptId) throw new Error('Invalid Site + Department selection.')

  const dupCheck = await supabase
    .from('projects')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', processName)
    .neq('id', params.editingId)
    .limit(1)
  if (dupCheck.error) throw dupCheck.error
  if (dupCheck.data && dupCheck.data.length) throw new Error('Process name already exists.')

  const productsList = cleanProductList(params.products)
  const payload: Record<string, unknown> = {
    name: processName,
    site_department_id: siteDeptId,
    status,
    updated_at: new Date().toISOString(),
    updated_by: params.userId || null,
    products: productsList.length ? productsList.join(', ') : null,
  }

  let updateRes = await supabase.from('projects').update(payload).eq('id', params.editingId).eq('organization_id', organizationId)
  if (updateRes.error && /products?/i.test(updateRes.error.message)) {
    const fallback = { ...payload }
    delete fallback.products
    updateRes = await supabase.from('projects').update(fallback).eq('id', params.editingId).eq('organization_id', organizationId)
  }
  if (updateRes.error) throw new Error(updateRes.error.message)
}

export async function deleteProjectRecord(supabase: SupabaseClient, projectId: string, orgId: string | null) {
  const organizationId = requireOrganizationId(orgId)
  const { error } = await supabase.from('projects').delete().eq('id', projectId).eq('organization_id', organizationId)
  if (error) throw error
}

export async function fetchRiskMatrixConfig(
  supabase: SupabaseClient,
  orgId?: string | null
): Promise<{ mode: Mode; thresholds: RpnThresholds }> {
  const organizationId = normalizeProjectText(orgId)
  let config: RiskMatrixConfigRow | null = null

  if (organizationId) {
    const orgConfigRes = await supabase
      .from('risk_matrix_config')
      .select('id,organization_id,mode,rpn_green_max,rpn_yellow_max,rpn_orange_max')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (orgConfigRes.error) throw orgConfigRes.error
    config = (orgConfigRes.data as RiskMatrixConfigRow | null) ?? null
  }

  if (!config) {
    const defaultConfigRes = await supabase
      .from('risk_matrix_config')
      .select('id,project_id,mode,rpn_green_max,rpn_yellow_max,rpn_orange_max')
      .eq('id', GLOBAL_RISK_MATRIX_CONFIG_ID)
      .maybeSingle()

    if (defaultConfigRes.error) throw defaultConfigRes.error
    config = (defaultConfigRes.data as RiskMatrixConfigRow | null) ?? null
  }

  return {
    mode: (config?.mode as Mode) ?? 'rpn',
    thresholds: {
      greenMax: clampInt(Number(config?.rpn_green_max), 1, 1000),
      yellowMax: clampInt(Number(config?.rpn_yellow_max), 1, 1000),
      orangeMax: clampInt(Number(config?.rpn_orange_max), 1, 1000),
    },
  }
}

export async function fetchRiskMatrixCells(
  supabase: SupabaseClient,
  params?: {
    orgId?: string | null
    projectId?: string | null
  }
): Promise<Record<string, RiskColor>> {
  const organizationId = normalizeProjectText(params?.orgId)
  const projectId = normalizeProjectText(params?.projectId) || GLOBAL_PROJECT_ID

  if (organizationId) {
    const orgCellsRes = await supabase
      .from('risk_matrix_cells')
      .select('organization_id,severity,do_value,color')
      .eq('organization_id', organizationId)

    if (orgCellsRes.error) throw orgCellsRes.error
    const orgCells = mapRiskMatrixCells((orgCellsRes.data ?? []) as RiskMatrixCellRow[])
    if (Object.keys(orgCells).length) return orgCells
  }

  const cellsRes = await supabase
    .from('risk_matrix_cells')
    .select('project_id,severity,do_value,color')
    .eq('project_id', projectId)

  if (cellsRes.error) return {}

  return mapRiskMatrixCells((cellsRes.data ?? []) as RiskMatrixCellRow[])
}

function mapRiskMatrixCells(rows: RiskMatrixCellRow[]) {
  const map: Record<string, RiskColor> = {}
  for (const row of rows) {
    const severity = Number(row?.severity)
    const doValue = Number(row?.do_value)
    const color = row?.color as RiskColor | undefined
    if (!Number.isFinite(severity) || !Number.isFinite(doValue) || !color) continue
    map[cellKey(severity, doValue)] = color
  }

  return map
}

export async function fetchProjectPfmeaStats(
  supabase: SupabaseClient,
  rawProjects: ProjectRowDb[]
): Promise<Record<string, ProjectPfmeaStat>> {
  const projectIds = Array.from(new Set(rawProjects.map((project) => normalizeProjectText(project.id)).filter(Boolean)))
  if (!projectIds.length) return {}

  const revisionByProject: Record<string, string> = {}
  for (const project of rawProjects) {
    const projectId = normalizeProjectText(project.id)
    if (!projectId) continue
    const revisionId = normalizeProjectText(project.current_draft_revision_id) || normalizeProjectText(project.current_open_revision_id)
    if (revisionId) revisionByProject[projectId] = revisionId
  }

  const { data, error } = await supabase
    .from('pfmea_rows')
    .select('id,operation_id,row_no,revision_id,failure_mode_group_id,failure_block_group_id,action_plan_group_id,rpn,rpn_current,severity,occurrence,detection,oxd_current,created_at,operations!inner(id,project_id,active)')
    .in('operations.project_id', projectIds)
    .eq('operations.active', true)

  if (error) throw error

  type RevisionAggregate = {
    riskCount: number
    rpnCount: number
    rpnSum: number
    lastCreatedAt: number
  }

  const aggregateByProjectRevision: Record<string, Record<string, RevisionAggregate>> = {}

  for (const risk of collectPfmeaCurrentOpenRisks((data ?? []) as PfmeaStatsRow[])) {
    const row = risk.row as PfmeaStatsRow
    const operationRelation = row.operations
    const operation = Array.isArray(operationRelation) ? operationRelation[0] : operationRelation
    const projectId = normalizeProjectText(operation?.project_id)
    const revisionId = normalizeProjectText(row.revision_id)
    if (!projectId || !revisionId) continue

    const byRevision = (aggregateByProjectRevision[projectId] ??= {})
    const createdAtMs = new Date(row.created_at ?? 0).getTime()
    const slot = byRevision[revisionId] ?? { riskCount: 0, rpnCount: 0, rpnSum: 0, lastCreatedAt: 0 }
    slot.riskCount += 1
    if (Number.isFinite(createdAtMs)) slot.lastCreatedAt = Math.max(slot.lastCreatedAt, createdAtMs)

    if (risk.rpn != null) {
      slot.rpnCount += 1
      slot.rpnSum += risk.rpn
    }

    byRevision[revisionId] = slot
  }

  const next: Record<string, ProjectPfmeaStat> = {}
  for (const projectId of projectIds) {
    const byRevision = aggregateByProjectRevision[projectId] ?? {}
    const preferredRevision = revisionByProject[projectId] ?? ''
    let slot = preferredRevision ? byRevision[preferredRevision] : undefined
    if (!slot) {
      let latest: RevisionAggregate | undefined
      for (const revisionId of Object.keys(byRevision)) {
        const current = byRevision[revisionId]
        if (!latest || current.lastCreatedAt > latest.lastCreatedAt) latest = current
      }
      slot = latest
    }
    next[projectId] = {
      riskCount: slot?.riskCount ?? 0,
      avgRpn: slot && slot.rpnCount > 0 ? Number((slot.rpnSum / slot.rpnCount).toFixed(1)) : null,
    }
  }

  return next
}

export async function fetchProjectRevisionPopupData(
  supabase: SupabaseClient,
  rawProjects: ProjectRowDb[]
): Promise<Record<string, RevisionPopupData>> {
  const projectIds = Array.from(new Set(rawProjects.map((project) => normalizeProjectText(project.id)).filter(Boolean)))
  if (!projectIds.length) return {}

  const [pfdRes, pfmeaRes, pcpRes] = await Promise.all([
    supabase
      .from('pfd_change_history')
      .select('project_id,created_at,revision_label,change_description,author_name')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('pfmea_change_history')
      .select('project_id,created_at,revision_label,change_description,author_name')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('pcp_change_history')
      .select('project_id,created_at,revision_label,change_description,author_name')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
      .limit(2000),
  ])

  const pickLatestByProject = (rows: PfdHistoryTooltipRow[]) => {
    const latest: Record<string, PfdHistoryTooltipRow> = {}
    for (const row of rows) {
      const projectId = normalizeProjectText(row.project_id)
      if (!projectId || latest[projectId]) continue
      latest[projectId] = row
    }
    return latest
  }

  const pfdLatest = pfdRes.error ? {} : pickLatestByProject((pfdRes.data ?? []) as PfdHistoryTooltipRow[])
  const pfmeaLatest = pfmeaRes.error ? {} : pickLatestByProject((pfmeaRes.data ?? []) as PfdHistoryTooltipRow[])
  const pcpLatest = pcpRes.error ? {} : pickLatestByProject((pcpRes.data ?? []) as PfdHistoryTooltipRow[])

  const projectRevisionById: Record<string, string> = {}
  for (const project of rawProjects) {
    const projectId = normalizeProjectText(project.id)
    if (!projectId) continue
    projectRevisionById[projectId] =
      normalizeProjectText(project.draft_revision_label) || normalizeProjectText(project.open_revision_label) || '0.0.0'
  }

  const pickAuthor = (row: PfdHistoryTooltipRow) => normalizeProjectText(row.author_name) || 'Unknown user'

  const moduleRow = (
    moduleName: 'PFD' | 'PFMEA' | 'PCP',
    row: PfdHistoryTooltipRow | null,
    projectRevisionLabel: string
  ): RevisionPopupRow => {
    const resolvedRevisionLabel = sectionRevisionFromLabel(projectRevisionLabel, moduleName)
    if (!row) {
      return {
        module: moduleName,
        revisionLabel: resolvedRevisionLabel,
        at: '-',
        author: '-',
        description: 'No updates yet',
        hasData: false,
      }
    }

    return {
      module: moduleName,
      revisionLabel: resolvedRevisionLabel,
      at: formatDateTimePL(row.created_at),
      author: pickAuthor(row),
      description: normalizeProjectText(row.change_description) || '-',
      hasData: true,
    }
  }

  const next: Record<string, RevisionPopupData> = {}
  for (const projectId of projectIds) {
    const pfdRow = pfdLatest[projectId] ?? null
    const pfmeaRow = pfmeaLatest[projectId] ?? null
    const pcpRow = pcpLatest[projectId] ?? null
    const projectRevisionLabel = projectRevisionById[projectId] || '0.0.0'

    next[projectId] = {
      loading: false,
      rows: [
        moduleRow('PFD', pfdRow, projectRevisionLabel),
        moduleRow('PFMEA', pfmeaRow, projectRevisionLabel),
        moduleRow('PCP', pcpRow, projectRevisionLabel),
      ],
    }
  }

  return next
}

export async function fetchOpenRiskSummary(
  supabase: SupabaseClient,
  revisionIds: string[],
  params: {
    mode: Mode
    thresholds: RpnThresholds
    cells: Record<string, RiskColor>
  }
): Promise<OpenRiskSummary> {
  const normalizedRevisionIds = revisionIds.map((revisionId) => normalizeProjectText(revisionId)).filter(Boolean)
  if (!normalizedRevisionIds.length) {
    return {
      riskCount: 0,
      openRiskAvgRpn: null,
      riskColorCounts: { red: 0, orange: 0, yellow: 0, green: 0 },
    }
  }

  const { data, error } = await supabase
    .from('pfmea_rows')
    .select('id,operation_id,row_no,revision_id,failure_mode_group_id,failure_block_group_id,action_plan_group_id,severity,occurrence,detection,oxd_current,rpn_current,rpn,created_at,operations!inner(id,project_id,active)')
    .in('revision_id', normalizedRevisionIds)
    .eq('operations.active', true)

  if (error) throw error

  const counts: Record<RiskColor, number> = { red: 0, orange: 0, yellow: 0, green: 0 }
  let rpnSum = 0
  let rpnCount = 0

  const risks = collectPfmeaCurrentOpenRisks((data ?? []) as PfmeaReportRiskRow[])
  for (const risk of risks) {
    const severity = risk.severity
    const doValue = risk.doValue
    const rowRpn = risk.rpn
    let color: RiskColor | null = null
    if (severity != null && doValue != null) {
      color = getRiskColorFor(severity, doValue, params.mode, params.thresholds, params.cells)
    }

    if (color) counts[color] += 1
    if (rowRpn != null) {
      rpnSum += rowRpn
      rpnCount += 1
    }
  }

  return {
    riskCount: risks.length,
    openRiskAvgRpn: rpnCount > 0 ? Number((rpnSum / rpnCount).toFixed(1)) : null,
    riskColorCounts: counts,
  }
}
