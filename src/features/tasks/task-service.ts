import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchProjectSiteDepartments,
  fetchProjectsUserContext,
  fetchRiskMatrixCells,
  fetchRiskMatrixConfig,
  fetchProjectsWithRevision,
} from '@/features/projects/projects-service'
import { getRiskColorFor, normalizeProjectText } from '@/features/projects/utils'
import type { RiskColor } from '@/features/projects/types'
import { isTerminalTaskStatus, normalizeTaskStatus } from './task-status-utils'

export type TaskActionRow = {
  cause: string
  effect: string
  failureMode: string
  id: string
  process: string
  processStep: string
  recommendedAction: string
  responsible: string
  rpn: number | null
  rpnAfter: number | null
  rpnAfterColor: RiskColor | null
  rpnColor: RiskColor | null
  site: string
  status: string
  targetDate: string | null
}

type PfmeaTaskRow = {
  action_plan_group_id?: string | null
  cause?: string | null
  created_at?: string | null
  current_detection?: string | null
  current_prevention?: string | null
  detection?: number | string | null
  detection2?: number | string | null
  effect?: string | null
  failure_block_group_id?: string | null
  failure_mode?: string | null
  failure_mode_group_id?: string | null
  id?: string | null
  occurrence?: number | string | null
  occurrence2?: number | string | null
  operation_id?: string | null
  recommended_action?: string | null
  responsible?: string | null
  revision_id?: string | null
  rpn?: number | string | null
  rpn2?: number | string | null
  rpn_current?: number | string | null
  row_no?: string | null
  severity?: number | string | null
  target_date?: string | null
  action_status?: string | null
  operations?: {
    active?: boolean | null
    id?: string | null
    name?: string | null
    operation?: string | null
    operation_number?: number | null
    project_id?: string | null
  } | null
}

function toNumber(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function asInt1to10(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  const integer = Math.trunc(numeric)
  return integer >= 1 && integer <= 10 ? integer : null
}

function calcRpn(severityRaw: unknown, occurrenceRaw: unknown, detectionRaw: unknown) {
  const severity = asInt1to10(severityRaw)
  const occurrence = asInt1to10(occurrenceRaw)
  const detection = asInt1to10(detectionRaw)
  return severity != null && occurrence != null && detection != null ? severity * occurrence * detection : null
}

function calcDoValue(occurrenceRaw: unknown, detectionRaw: unknown) {
  const occurrence = asInt1to10(occurrenceRaw)
  const detection = asInt1to10(detectionRaw)
  return occurrence != null && detection != null ? occurrence * detection : null
}

function formatProcessStep(operation: PfmeaTaskRow['operations']) {
  const number = operation?.operation_number
  const name = normalizeProjectText(operation?.name)
  const fallback = normalizeProjectText(operation?.operation)
  const label = name || fallback || '-'
  return number != null && Number.isFinite(number) ? `${number}. ${label}` : label
}

function normalizeGroupId(value: unknown) {
  const normalized = normalizeProjectText(value)
  return normalized || null
}

function operationKey(row: PfmeaTaskRow) {
  return normalizeProjectText(row.operation_id) || normalizeProjectText(row.operations?.id)
}

function rowCreatedAtTime(row: PfmeaTaskRow) {
  const time = row.created_at ? new Date(row.created_at).getTime() : Number.NaN
  return Number.isFinite(time) ? time : 0
}

function getTaskProjectRevisionId(project: {
  current_draft_revision_id?: string | null
  current_open_revision_id?: string | null
}) {
  return normalizeProjectText(project.current_open_revision_id) || normalizeProjectText(project.current_draft_revision_id)
}

function sameGroup(left: unknown, right: unknown) {
  const normalizedLeft = normalizeGroupId(left)
  const normalizedRight = normalizeGroupId(right)
  return !!normalizedLeft && !!normalizedRight && normalizedLeft === normalizedRight
}

function rowHasCurrentRiskBlock(row: PfmeaTaskRow) {
  return (
    !!normalizeProjectText(row.effect) &&
    asInt1to10(row.severity) != null &&
    !!normalizeProjectText(row.cause) &&
    asInt1to10(row.occurrence) != null &&
    !!normalizeProjectText(row.current_prevention) &&
    !!normalizeProjectText(row.current_detection) &&
    asInt1to10(row.detection) != null
  )
}

function findCurrentRiskSourceRow(row: PfmeaTaskRow, operationRows: PfmeaTaskRow[]) {
  if (rowHasCurrentRiskBlock(row)) return row

  const rowId = normalizeProjectText(row.id)
  const rowIndex = operationRows.findIndex((item) => normalizeProjectText(item.id) === rowId)
  if (rowIndex < 0) return row

  const failureMode = normalizeProjectText(row.failure_mode)
  const failureModeGroupId = normalizeGroupId(row.failure_mode_group_id)
  const failureBlockGroupId = normalizeGroupId(row.failure_block_group_id)

  for (let index = rowIndex - 1; index >= 0; index -= 1) {
    const candidate = operationRows[index]

    if (failureModeGroupId) {
      if (!sameGroup(candidate.failure_mode_group_id, failureModeGroupId)) break
    } else if (normalizeProjectText(candidate.failure_mode) !== failureMode) {
      break
    }

    if (failureBlockGroupId && !sameGroup(candidate.failure_block_group_id, failureBlockGroupId)) break

    if (rowHasCurrentRiskBlock(candidate)) return candidate
  }

  return row
}

export async function fetchTaskActions(supabase: SupabaseClient, userId: string) {
  const userCtx = await fetchProjectsUserContext(supabase, userId)
  if (userCtx.isCustomer) {
    return {
      rows: [] as TaskActionRow[],
      summary: { closed: 0, inProgress: 0, openActions: 0, openProjects: 0, overdue: 0, total: 0, withoutOwner: 0 },
      userCtx,
    }
  }

  const [projects, siteDeptData] = await Promise.all([
    fetchProjectsWithRevision(supabase, userCtx.orgId),
    fetchProjectSiteDepartments(supabase, userCtx.orgId),
  ])
  const [riskMatrixConfig, riskMatrixCells] = await Promise.all([
    fetchRiskMatrixConfig(supabase, userCtx.orgId),
    fetchRiskMatrixCells(supabase, { orgId: userCtx.orgId }),
  ])
  const openProjects = projects.filter((project) => normalizeProjectText(project.status).toUpperCase() === 'OPEN')
  const projectByRevision = new Map(
    openProjects
      .map((project) => {
        const siteDept = project.site_department_id ? siteDeptData.siteDeptMap[project.site_department_id] : undefined
        const revisionId = getTaskProjectRevisionId(project)
        return [
          revisionId,
          {
            process: normalizeProjectText(project.name),
            site: normalizeProjectText(siteDept?.site) || '-',
          },
        ] as const
      })
      .filter(([revisionId]) => !!revisionId)
  )
  const revisionIds = Array.from(projectByRevision.keys())

  if (!revisionIds.length) {
    return {
      rows: [] as TaskActionRow[],
      summary: { closed: 0, inProgress: 0, openActions: 0, openProjects: openProjects.length, overdue: 0, total: 0, withoutOwner: 0 },
      userCtx,
    }
  }

  const { data, error } = await supabase
    .from('pfmea_rows')
    .select(
      'id,revision_id,operation_id,row_no,failure_mode_group_id,failure_block_group_id,action_plan_group_id,failure_mode,effect,cause,severity,occurrence,detection,current_prevention,current_detection,rpn,rpn_current,recommended_action,responsible,target_date,action_status,occurrence2,detection2,rpn2,created_at,operations!inner(id,operation_number,name,operation,project_id,active)'
    )
    .in('revision_id', revisionIds)
    .eq('operations.active', true)
    .order('operation_number', { foreignTable: 'operations', ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  const allRows = ((data ?? []) as PfmeaTaskRow[]).sort((left, right) => {
    const leftOperation = Number(left.operations?.operation_number ?? 0)
    const rightOperation = Number(right.operations?.operation_number ?? 0)
    if (leftOperation !== rightOperation) return leftOperation - rightOperation
    return rowCreatedAtTime(left) - rowCreatedAtTime(right)
  })

  const rowsByOperation = new Map<string, PfmeaTaskRow[]>()
  for (const row of allRows) {
    const key = operationKey(row)
    if (!key) continue
    const bucket = rowsByOperation.get(key) ?? []
    bucket.push(row)
    rowsByOperation.set(key, bucket)
  }

  const rows = allRows
    .map((row): TaskActionRow | null => {
      const recommendedAction = normalizeProjectText(row.recommended_action)
      if (!recommendedAction) return null

      const revisionId = normalizeProjectText(row.revision_id)
      const projectMeta = projectByRevision.get(revisionId)
      const sourceRow = findCurrentRiskSourceRow(row, rowsByOperation.get(operationKey(row)) ?? [])
      const currentRpn = calcRpn(sourceRow.severity, sourceRow.occurrence, sourceRow.detection)
      const rpnAfter = calcRpn(sourceRow.severity, row.occurrence2, row.detection2)
      const currentDoValue = calcDoValue(sourceRow.occurrence, sourceRow.detection)
      const afterDoValue = calcDoValue(row.occurrence2, row.detection2)
      const rpnColor = getRiskColorFor(
        asInt1to10(sourceRow.severity),
        currentDoValue,
        riskMatrixConfig.mode,
        riskMatrixConfig.thresholds,
        riskMatrixCells
      )
      const rpnAfterColor = getRiskColorFor(
        asInt1to10(sourceRow.severity),
        afterDoValue,
        riskMatrixConfig.mode,
        riskMatrixConfig.thresholds,
        riskMatrixCells
      )
      return {
        cause: normalizeProjectText(row.cause) || '-',
        effect: normalizeProjectText(row.effect) || '-',
        failureMode: normalizeProjectText(row.failure_mode) || '-',
        id: normalizeProjectText(row.id) || `${revisionId}:${recommendedAction}`,
        process: projectMeta?.process ?? '-',
        processStep: formatProcessStep(row.operations),
        recommendedAction,
        responsible: normalizeProjectText(row.responsible) || '-',
        rpn: currentRpn ?? toNumber(row.rpn_current) ?? toNumber(row.rpn),
        rpnAfter: rpnAfter ?? toNumber(row.rpn2),
        rpnAfterColor,
        rpnColor,
        site: projectMeta?.site ?? '-',
        status: normalizeTaskStatus(row.action_status),
        targetDate: row.target_date ?? null,
      }
    })
    .filter((row): row is TaskActionRow => !!row)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdue = rows.filter((row) => {
    if (!row.targetDate) return false
    const parsed = new Date(row.targetDate)
    if (Number.isNaN(parsed.getTime())) return false
    return parsed < today && !isTerminalTaskStatus(row.status)
  }).length

  return {
    rows,
    summary: {
      closed: rows.filter((row) => normalizeTaskStatus(row.status) === 'CLOSED').length,
      inProgress: rows.filter((row) => normalizeTaskStatus(row.status) === 'IN PROGRESS').length,
      openActions: rows.filter((row) => normalizeTaskStatus(row.status) === 'OPEN').length,
      openProjects: openProjects.length,
      overdue,
      total: rows.length,
      withoutOwner: rows.filter((row) => row.responsible === '-').length,
    },
    userCtx,
  }
}

export async function updateTaskActionStatus(
  supabase: SupabaseClient,
  params: {
    rowId: string
    status: string
  }
) {
  const rowId = normalizeProjectText(params.rowId)
  const status = normalizeProjectText(params.status).toUpperCase()

  if (!rowId) throw new Error('Task row id is required.')
  if (!['OPEN', 'IN PROGRESS', 'CLOSED', 'CANCELED'].includes(status)) {
    throw new Error('Invalid task status.')
  }

  const { error } = await supabase
    .from('pfmea_rows')
    .update({ action_status: status, updated_at: new Date().toISOString() })
    .eq('id', rowId)

  if (error) {
    if (error.message.toLowerCase().includes('updated_at')) {
      const retry = await supabase.from('pfmea_rows').update({ action_status: status }).eq('id', rowId)
      if (retry.error) throw retry.error
      return
    }

    throw error
  }
}

export async function updateTaskActionDetails(
  supabase: SupabaseClient,
  params: {
    responsible?: string | null
    rowId: string
    targetDate?: string | null
  }
) {
  const rowId = normalizeProjectText(params.rowId)
  if (!rowId) throw new Error('Task row id is required.')

  const patch: Record<string, string | null> = {}

  if (params.responsible !== undefined) {
    const responsible = normalizeProjectText(params.responsible)
    patch.responsible = responsible || null
  }

  if (params.targetDate !== undefined) {
    const targetDate = normalizeProjectText(params.targetDate)
    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      throw new Error('Invalid target date.')
    }
    patch.target_date = targetDate || null
  }

  if (Object.keys(patch).length === 0) return

  const update = { ...patch, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('pfmea_rows').update(update).eq('id', rowId)

  if (error) {
    if (error.message.toLowerCase().includes('updated_at')) {
      const retry = await supabase.from('pfmea_rows').update(patch).eq('id', rowId)
      if (retry.error) throw retry.error
      return
    }

    throw error
  }
}
