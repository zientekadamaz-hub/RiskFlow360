
'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@app/lib/supabaseBrowser'

type ProjectView = {
  id: string
  name: string
  status: 'DRAFT' | 'OPEN' | 'OBSOLETE'
  current_open_revision_id: string | null
  current_draft_revision_id: string | null
  open_revision_label: string | null
  draft_revision_label: string | null
}

type Operation = {
  id: string
  project_id: string
  operation_number: number | null
  name: string
  machine: string | null
  operation: string | null
  active?: boolean
}

type PcpRow = {
  id: string
  revision_id?: string | null
  operation_id: string
  pfmea_row_id?: string | null
  failure_mode: string | null
  characteristic: string
  class: string | null
  severity?: number | string | null
  rpn?: number | null
  current_prevention: string | null
  current_detection: string | null
  control_method: string | null
  sample_size: string | null
  frequency: string | null
  reaction_plan: string | null
  source: string
  status: string
  created_at: string
  updated_at: string
  operations?: Operation | null
  __placeholder?: boolean
  __sortIndex?: number
}

type PcpHistoryEntry = {
  id: string
  at: string
  revisionLabel: string
  author: string
  controlCount: number | null
  description: string
}

type PcpEditSession = {
  projectId: string
  lockedBy: string
  startedAt: string
  lastActivityAt: string
}

type PfmeaPcpSeedRow = {
  id: string
  operation_id: string
  pcp: boolean | null
  failure_mode: string | null
  class: string | null
  characteristic: string | null
  severity: number | string | null
  rpn: number | null
  current_prevention: string | null
  current_detection: string | null
  created_at?: string | null
  operations?: Operation | Operation[] | null
}

type PcpColumnId =
  | 'id'
  | 'station'
  | 'operation'
  | 'process_step'
  | 'failure_mode'
  | 'characteristic'
  | 'class'
  | 'severity'
  | 'rpn'
  | 'current_prevention'
  | 'current_detection'
  | 'control_method'
  | 'sample_size'
  | 'frequency'
  | 'reaction_plan'

const PCP_VISIBLE_COLUMNS_KEY_PREFIX = '__PCP_VISIBLE_COLUMNS__'
const EDIT_LOCK_HOURS = 48
const EDIT_LOCK_MS = EDIT_LOCK_HOURS * 60 * 60 * 1000
const SURFACE_RADIUS = 8
const SURFACE_BG = 'rgba(255,255,255,0.08)'
const SURFACE_BG_STRONG = 'rgba(255,255,255,0.12)'
const SURFACE_BORDER = 'rgba(255,255,255,0.16)'
const SURFACE_BORDER_STRONG = 'rgba(255,255,255,0.22)'
const SURFACE_PANEL_BG = 'rgb(40, 39, 47)'
const SURFACE_TEXT = '#f8fafc'
const SURFACE_MUTED = 'rgba(255,255,255,0.72)'

const PCP_PLACEHOLDER_PREFIX = '__pcp_placeholder__:'
const PCP_CLASS_OPTIONS = ['', 'SC', 'CC']
const CLASS_OPTION_DETAILS: Record<string, { title: string; description: string[] }> = {
  SC: {
    title: 'SC - Special Characteristic',
    description: [
      'A product characteristic or process parameter that requires special control because deviation may affect function, quality, compliance, performance, assembly, or downstream processing.',
      'This characteristic should be clearly identified and included in process controls, for example in the PCP.',
    ],
  },
  CC: {
    title: 'CC - Critical Characteristic',
    description: [
      'A critical characteristic, which is a specific subset of SC, where deviation may cause the most severe consequences.',
      'Examples include safety risk, non-compliance with legal requirements, or loss of a critical function.',
    ],
  },
}

const PCP_COLUMNS: Array<{ id: PcpColumnId; label: string; width: number }> = [
  { id: 'id', label: 'ID#', width: 60 },
  { id: 'station', label: 'STATION', width: 120 },
  { id: 'operation', label: 'OPERATION', width: 140 },
  { id: 'process_step', label: 'PROCESS STEP', width: 180 },
  { id: 'failure_mode', label: 'FAILURE MODE', width: 180 },
  { id: 'characteristic', label: 'CHARACTERISTIC', width: 120 },
  { id: 'class', label: 'CLASS', width: 60 },
  { id: 'severity', label: 'SEV', width: 60 },
  { id: 'rpn', label: 'RPN', width: 60 },
  { id: 'current_prevention', label: 'CURRENT CONTROLS (PREV)', width: 180 },
  { id: 'current_detection', label: 'CURRENT CONTROLS (DET)', width: 180 },
  { id: 'control_method', label: 'CONTROL METHOD', width: 180 },
  { id: 'sample_size', label: 'SAMPLE SIZE', width: 100 },
  { id: 'frequency', label: 'FREQUENCY', width: 100 },
  { id: 'reaction_plan', label: 'REACTION PLAN', width: 180 },
]

const PCP_COLUMNS_BY_ID: Record<PcpColumnId, { id: PcpColumnId; label: string; width: number }> = PCP_COLUMNS.reduce(
  (acc, col) => {
    acc[col.id] = col
    return acc
  },
  {} as Record<PcpColumnId, { id: PcpColumnId; label: string; width: number }>
)

const PCP_COLUMN_FILTER_GROUPS: Array<{ title: string; ids: PcpColumnId[] }> = [
  { title: 'Process Context', ids: ['id', 'station', 'operation', 'process_step'] },
  { title: 'PFMEA Link', ids: ['failure_mode', 'characteristic', 'class', 'severity', 'rpn', 'current_prevention', 'current_detection'] },
  { title: 'Control Definition', ids: ['control_method', 'sample_size', 'frequency', 'reaction_plan'] },
]

const DEFAULT_VISIBLE_COLUMNS: Record<PcpColumnId, boolean> = {
  id: true,
  station: true,
  operation: true,
  process_step: true,
  failure_mode: true,
  characteristic: true,
  class: true,
  severity: true,
  rpn: true,
  current_prevention: true,
  current_detection: true,
  control_method: true,
  sample_size: true,
  frequency: true,
  reaction_plan: true,
}

function normalizeText(v: unknown) {
  return String(v ?? '').trim()
}

function normalizePcpFlag(v: unknown): boolean | null {
  if (v == null) return null
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : null
  const source = String(v).trim().toLowerCase()
  if (!source) return null
  if (source === 'true' || source === 't' || source === '1' || source === 'yes') return true
  if (source === 'false' || source === 'f' || source === '0' || source === 'no') return false
  return null
}

function normalizeClassValue(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const source = String(raw).trim()
  if (!source) return null
  const upper = source.toUpperCase()
  const token = upper.split(/[\s-]/)[0] ?? ''
  if (token === 'SC' || upper.includes('SPECIAL CHARACTERISTIC')) return 'SC'
  if (token === 'CC' || upper.includes('CRITICAL CHARACTERISTIC')) return 'CC'
  return null
}

function asInt1to10(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  if (!Number.isFinite(n)) return null
  const i = Math.trunc(n)
  if (i < 1 || i > 10) return null
  return i
}

function isPfmeaSeedSelectedForPcp(row: Pick<PfmeaPcpSeedRow, 'pcp' | 'class' | 'severity' | 'rpn'>, yellowMax: number) {
  const override = normalizePcpFlag(row.pcp)
  if (override != null) return override
  if (normalizeClassValue(row.class)) return true
  const severity = asInt1to10(row.severity)
  if (severity != null && severity >= 9) return true
  const rpn = typeof row.rpn === 'number' && Number.isFinite(row.rpn) ? row.rpn : null
  return rpn != null && rpn > yellowMax
}

function formatDateTimePL(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const date = d.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${date} ${time}`
}

function nextPcpRevisionLabel(labelRaw: string | null | undefined) {
  const raw = (labelRaw ?? '0.0.0').toString().trim() || '0.0.0'
  const parts = raw.split('.')
  const pfd = Number.parseInt((parts[0] ?? '0').trim(), 10)
  const pfmea = Number.parseInt((parts[1] ?? '0').trim(), 10)
  const pcp = Number.parseInt((parts[2] ?? '0').trim(), 10)
  const a = Number.isFinite(pfd) ? pfd : 0
  const b = Number.isFinite(pfmea) ? pfmea : 0
  const c = Number.isFinite(pcp) ? pcp : 0
  return `${a}.${b}.${c + 1}`
}

function anchoredPopupStyle(anchorEl: HTMLElement, width: number, gap = 8, minViewportPadding = 24): React.CSSProperties {
  const rect = anchorEl.getBoundingClientRect()
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : rect.right + width
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : rect.bottom + 240
  const maxLeft = Math.max(minViewportPadding, viewportWidth - width - minViewportPadding)
  const left = Math.max(minViewportPadding, Math.min(rect.left, maxLeft))
  const estimatedHeight = 220
  const top = rect.bottom + gap + estimatedHeight <= viewportHeight - minViewportPadding
    ? rect.bottom + gap
    : Math.max(minViewportPadding, rect.top - gap - estimatedHeight)

  return {
    left,
    top,
    width,
    maxWidth: `calc(100vw - ${minViewportPadding * 2}px)`,
    maxHeight: `calc(100vh - ${minViewportPadding * 2}px)`,
  }
}

function isPlaceholderPcpRowId(id: string | null | undefined) {
  return String(id ?? '').startsWith(PCP_PLACEHOLDER_PREFIX)
}

function makePcpPlaceholderRow(op: Operation, revisionId: string | null, seedKey: string, seed?: Partial<PfmeaPcpSeedRow> | null, sortIndex = 0): PcpRow {
  return {
    id: `${PCP_PLACEHOLDER_PREFIX}${seedKey}`,
    revision_id: revisionId,
    operation_id: op.id,
    pfmea_row_id: seed?.id ?? null,
    failure_mode: normalizeText(seed?.failure_mode) || null,
    characteristic: normalizeText(seed?.characteristic),
    class: normalizeClassValue((seed?.class as string | null | undefined) ?? null),
    severity: asInt1to10(seed?.severity),
    rpn: typeof seed?.rpn === 'number' && Number.isFinite(seed.rpn) ? seed.rpn : null,
    current_prevention: normalizeText(seed?.current_prevention) || null,
    current_detection: normalizeText(seed?.current_detection) || null,
    control_method: null,
    sample_size: null,
    frequency: null,
    reaction_plan: null,
    source: 'MANUAL',
    status: 'OPEN',
    created_at: '',
    updated_at: '',
    operations: op,
    __placeholder: true,
    __sortIndex: sortIndex,
  }
}

function buildPcpRowPayload(row: Partial<PcpRow> & { operation_id: string; revision_id: string }) {
  return {
    operation_id: row.operation_id,
    revision_id: row.revision_id,
    pfmea_row_id: row.pfmea_row_id ?? null,
    failure_mode: row.failure_mode ?? '',
    characteristic: row.characteristic ?? '',
    class: normalizeClassValue((row.class as string | null | undefined) ?? null),
    current_prevention: row.current_prevention ?? '',
    current_detection: row.current_detection ?? '',
    control_method: row.control_method ?? '',
    sample_size: row.sample_size ?? '',
    frequency: row.frequency ?? '',
    reaction_plan: row.reaction_plan ?? '',
    source: normalizeText(row.source || 'MANUAL').toUpperCase(),
    status: normalizeText(row.status || 'OPEN').toUpperCase(),
  }
}

function isEquivalentPcpRow(a: Partial<PcpRow>, b: Partial<PcpRow>) {
  const pfmeaA = normalizeText(a.pfmea_row_id)
  const pfmeaB = normalizeText(b.pfmea_row_id)
  if (pfmeaA && pfmeaB) return pfmeaA === pfmeaB
  return (
    normalizeText(a.operation_id) === normalizeText(b.operation_id) &&
    normalizeText(a.failure_mode) === normalizeText(b.failure_mode) &&
    normalizeText(a.characteristic) === normalizeText(b.characteristic) &&
    normalizeClassValue((a.class as string | null | undefined) ?? null) === normalizeClassValue((b.class as string | null | undefined) ?? null) &&
    normalizeText(a.current_prevention) === normalizeText(b.current_prevention) &&
    normalizeText(a.current_detection) === normalizeText(b.current_detection)
  )
}

function getComparableTime(value: string | null | undefined) {
  const time = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(time) ? time : 0
}

export default function PcpPage() {
  return (
    <Suspense fallback={<PcpPageFallback />}>
      <PcpPageContent />
    </Suspense>
  )
}

function PcpPageContent() {
  const sp = useSearchParams()
  const projectId = sp.get('project') ?? ''
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [userId, setUserId] = useState<string | null>(null)
  const [currentAuthorName, setCurrentAuthorName] = useState('Unknown user')
  const [isChampion, setIsChampion] = useState(false)

  const [project, setProject] = useState<ProjectView | null>(null)
  const [draftRevisionIdOverride, setDraftRevisionIdOverride] = useState<string | null>(null)
  const [ops, setOps] = useState<Operation[]>([])
  const [rows, setRows] = useState<PcpRow[]>([])

  const [editSession, setEditSession] = useState<PcpEditSession | null>(null)
  const [sessionBusy, setSessionBusy] = useState(false)
  const [sessionMsg, setSessionMsg] = useState('')
  const [sessionNow, setSessionNow] = useState(() => Date.now())

  const [dirtyIds, setDirtyIds] = useState<string[]>([])
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [saveBusy, setSaveBusy] = useState(false)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<PcpHistoryEntry[]>([])
  const [showSave, setShowSave] = useState(false)
  const [saveDescription, setSaveDescription] = useState('')

  const [columnFiltersOpen, setColumnFiltersOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<PcpColumnId, boolean>>(DEFAULT_VISIBLE_COLUMNS)
  const [pcpYellowMax, setPcpYellowMax] = useState(168)

  const [edit, setEdit] = useState<{ rowId: string; col: keyof PcpRow } | null>(null)
  const [requiredRowCountByOperation, setRequiredRowCountByOperation] = useState<Record<string, number>>({})

  const isDirty = dirtyIds.length > 0 || deletedIds.length > 0
  const isObsolete = (project?.status ?? 'DRAFT') === 'OBSOLETE'

  const sessionExpired = useMemo(() => {
    if (!editSession) return false
    const last = new Date(editSession.lastActivityAt).getTime()
    if (!Number.isFinite(last)) return true
    return Date.now() - last >= EDIT_LOCK_MS
  }, [editSession])

  const isEditOwner = !!userId && !!editSession && editSession.lockedBy === userId && !sessionExpired
  const isLockedByOther = !!editSession && !isEditOwner && !sessionExpired
  const readOnly = isObsolete || !isEditOwner

  const lockRemainingText = useMemo(() => {
    if (!editSession || !isLockedByOther) return ''
    const last = new Date(editSession.lastActivityAt).getTime()
    const left = Math.max(0, EDIT_LOCK_MS - (sessionNow - last))
    const h = Math.floor(left / 3_600_000)
    const m = Math.floor((left % 3_600_000) / 60_000)
    return `${h}h ${m}m`
  }, [editSession, isLockedByOther, sessionNow])

  const markDirty = useCallback((id: string) => {
    setDirtyIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const workingRevisionId = draftRevisionIdOverride ?? project?.current_draft_revision_id ?? project?.current_open_revision_id ?? null
  const workingRevisionLabel = project?.current_draft_revision_id ? project?.draft_revision_label : project?.open_revision_label

  const isColumnVisible = useCallback(
    (id: PcpColumnId) => {
      return visibleColumns[id] !== false
    },
    [visibleColumns]
  )

  const toggleColumnVisibility = useCallback((id: PcpColumnId, checked: boolean) => {
    setVisibleColumns((prev) => ({ ...prev, [id]: checked }))
  }, [])

  const clearColumnGroup = useCallback((ids: PcpColumnId[]) => {
    setVisibleColumns((prev) => {
      const next = { ...prev }
      for (const id of ids) next[id] = true
      return next
    })
  }, [])

  const uncheckColumnGroup = useCallback((ids: PcpColumnId[]) => {
    setVisibleColumns((prev) => {
      const next = { ...prev }
      for (const id of ids) next[id] = false
      next.delete = true
      return next
    })
  }, [])

  const visibleColumnDefs = useMemo(() => PCP_COLUMNS.filter((col) => isColumnVisible(col.id)), [isColumnVisible])
  const visibleTableWidth = useMemo(() => visibleColumnDefs.reduce((acc, c) => acc + c.width, 0), [visibleColumnDefs])
  const widthOf = useCallback((id: PcpColumnId) => `${PCP_COLUMNS_BY_ID[id]?.width ?? 100}px`, [])

  const rowsSorted = useMemo(() => {
    const indexed = rows.map((row, index) => ({ row, index }))
    indexed.sort((a, b) => {
      const ao = a.row.operations?.operation_number ?? 0
      const bo = b.row.operations?.operation_number ?? 0
      if (ao !== bo) return ao - bo
      const as = a.row.__sortIndex ?? a.index
      const bs = b.row.__sortIndex ?? b.index
      return as - bs
    })
    return indexed.map((item) => item.row)
  }, [rows])

  const loadProjectView = useCallback(async () => {
    const pr = await supabase
      .from('projects_with_revision')
      .select('id,name,status,current_open_revision_id,current_draft_revision_id,open_revision_label,draft_revision_label')
      .eq('id', projectId)
      .single()
    if (pr.error) throw pr.error
    const view = pr.data as ProjectView
    setProject(view)
    if (view.current_draft_revision_id) setDraftRevisionIdOverride(view.current_draft_revision_id)
    return view
  }, [projectId])

  const loadEditSession = useCallback(async () => {
    if (!projectId) {
      setEditSession(null)
      return
    }
    const res = await supabase
      .from('pcp_edit_sessions')
      .select('project_id,locked_by,started_at,last_activity_at')
      .eq('project_id', projectId)
      .maybeSingle()
    if (res.error || !res.data) {
      setEditSession(null)
      return
    }
    const row = res.data as { project_id: string; locked_by: string; started_at: string; last_activity_at: string }
    setEditSession({ projectId: row.project_id, lockedBy: row.locked_by, startedAt: row.started_at, lastActivityAt: row.last_activity_at })
  }, [projectId])

  const loadPcpSelectionThreshold = useCallback(async () => {
    if (!projectId) return 168
    const globalProjectId = '00000000-0000-0000-0000-000000000000'
    const res = await supabase
      .from('risk_matrix_config')
      .select('project_id,rpn_yellow_max')
      .in('project_id', [projectId, globalProjectId])

    if (res.error) return 168
    const rows = (res.data ?? []) as Array<{ project_id?: string | null; rpn_yellow_max?: number | null }>
    const exact = rows.find((row) => row.project_id === projectId)
    const fallback = rows.find((row) => row.project_id === globalProjectId)
    const raw = exact?.rpn_yellow_max ?? fallback?.rpn_yellow_max ?? 168
    return typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : 168
  }, [projectId])

  const ensureDraftRowsHydrated = useCallback(async (draftRevisionId: string | null | undefined, sourceRevisionId: string | null | undefined) => {
    const draftId = normalizeText(draftRevisionId)
    const sourceId = normalizeText(sourceRevisionId)
    if (!draftId || !sourceId || draftId === sourceId) return

    const draftCountRes = await supabase
      .from('control_plan_rows')
      .select('id', { count: 'exact', head: true })
      .eq('revision_id', draftId)
    if ((draftCountRes.count ?? 0) > 0) return

    const sourceRes = await supabase
      .from('control_plan_rows')
      .select('operation_id,pfmea_row_id,failure_mode,characteristic,class,current_prevention,current_detection,control_method,sample_size,frequency,reaction_plan,source,status')
      .eq('revision_id', sourceId)
      .order('created_at', { ascending: true })
    if (sourceRes.error) throw sourceRes.error

    const sourceRows = (sourceRes.data ?? []) as Array<Partial<PcpRow> & { operation_id: string }>
    if (sourceRows.length === 0) return

    const insertPayload = sourceRows.map((row) => buildPcpRowPayload({ ...row, revision_id: draftId }))
    const insertRes = await supabase.from('control_plan_rows').insert(insertPayload)
    if (insertRes.error) throw insertRes.error
  }, [])

  const findEquivalentRowInRevision = useCallback(async (row: PcpRow, revisionId: string) => {
    const res = await supabase
      .from('control_plan_rows')
      .select('id,revision_id,operation_id,pfmea_row_id,failure_mode,characteristic,class,current_prevention,current_detection,control_method,sample_size,frequency,reaction_plan,source,status,created_at,updated_at,operations!inner(id,project_id,operation_number,name,machine,operation,active)')
      .eq('revision_id', revisionId)
      .eq('operation_id', row.operation_id)
      .order('created_at', { ascending: true })
    if (res.error) throw res.error
    const revisionRows = (res.data ?? []) as PcpRow[]
    return revisionRows.find((candidate) => isEquivalentPcpRow(candidate, row)) ?? null
  }, [])

  const loadUserContext = useCallback(async () => {
    if (!projectId || !userId) {
      setIsChampion(false)
      return
    }
    const projectRes = await supabase.from('projects').select('organization_id').eq('id', projectId).maybeSingle()
    const organizationId = (projectRes.data as { organization_id?: string | null } | null)?.organization_id ?? null
    if (!organizationId) {
      setIsChampion(false)
      return
    }
    const memberRes = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle()
    const role = ((memberRes.data as { role?: string | null } | null)?.role ?? '').toLowerCase()
    setIsChampion(role === 'champion' || role === 'admin')
  }, [projectId, userId])

  const ensureDraftIfNeeded = useCallback(async () => {
    if (!projectId) return null
    if (!userId) throw new Error('Not authenticated.')
    if (!isEditOwner) throw new Error('Click "Edit PCP" to start an edit session.')
    if (draftRevisionIdOverride) {
      await ensureDraftRowsHydrated(draftRevisionIdOverride, project?.current_open_revision_id ?? workingRevisionId)
      return draftRevisionIdOverride
    }
    if (project?.current_draft_revision_id) {
      await ensureDraftRowsHydrated(project.current_draft_revision_id, project.current_open_revision_id ?? workingRevisionId)
      return project.current_draft_revision_id
    }
    if ((project?.status ?? 'DRAFT') === 'OBSOLETE') throw new Error('Process is OBSOLETE (read-only).')

    const { data, error } = await supabase.rpc('ensure_process_draft', {
      p_project_id: projectId,
      p_user_id: userId,
    })
    if (error) throw error

    const pv = await loadProjectView()
    const ensured = pv.current_draft_revision_id ?? (data as string | null) ?? null
    if (ensured) setDraftRevisionIdOverride(ensured)
    await ensureDraftRowsHydrated(ensured, pv.current_open_revision_id ?? workingRevisionId)
    return ensured
  }, [projectId, userId, isEditOwner, draftRevisionIdOverride, project?.current_draft_revision_id, project?.current_open_revision_id, project?.status, loadProjectView, ensureDraftRowsHydrated, workingRevisionId])

  const loadAll = useCallback(async (forceRevisionId?: string | null) => {
    if (!projectId) return
    setLoading(true)
    setErr('')
    try {
      const pv = await loadProjectView()
      const pcpYellowMax = await loadPcpSelectionThreshold()
      setPcpYellowMax(pcpYellowMax)
      const opsRes = await supabase
        .from('operations')
        .select('id,project_id,operation_number,name,machine,operation,active')
        .eq('project_id', projectId)
        .eq('active', true)
        .order('operation_number', { ascending: true })
      if (opsRes.error) throw opsRes.error
      const operations = (opsRes.data ?? []) as Operation[]
      setOps(operations)

      const openRevId = pv.current_open_revision_id ?? null
      const draftRevId = draftRevisionIdOverride ?? pv.current_draft_revision_id ?? null
      let revId = forceRevisionId ?? null
      if (!revId) revId = isEditOwner ? draftRevId ?? openRevId : openRevId ?? draftRevId

      if (!revId) {
        setRows([])
        setLoading(false)
        return
      }

      const rowsRes = await supabase
        .from('control_plan_rows')
        .select('id,revision_id,operation_id,pfmea_row_id,failure_mode,characteristic,class,current_prevention,current_detection,control_method,sample_size,frequency,reaction_plan,source,status,created_at,updated_at,operations!inner(id,project_id,operation_number,name,machine,operation,active)')
        .eq('operations.project_id', projectId)
        .eq('revision_id', revId)
        .order('operation_number', { foreignTable: 'operations', ascending: true })
        .order('created_at', { ascending: true })
      if (rowsRes.error) throw rowsRes.error
      const normalizedRows = ((rowsRes.data ?? []) as Array<PcpRow & { operations?: Operation[] | Operation | null }>).map((row) => ({
        ...row,
        operations: Array.isArray(row.operations) ? (row.operations[0] ?? null) : (row.operations ?? null),
      }))
      const loadPfmeaSeeds = async (seedRevisionId: string) => {
        const res = await supabase
          .from('pfmea_rows')
          .select('id,operation_id,pcp,failure_mode,class,characteristic,severity,rpn,current_prevention,current_detection,created_at,operations!inner(id,project_id,operation_number,name,machine,operation,active)')
          .eq('operations.project_id', projectId)
          .eq('revision_id', seedRevisionId)
          .order('operation_number', { foreignTable: 'operations', ascending: true })
          .order('created_at', { ascending: true })
        if (res.error) throw res.error
        return ((res.data ?? []) as Array<PfmeaPcpSeedRow>).map((row) => ({
          ...row,
          operations: Array.isArray(row.operations) ? (row.operations[0] ?? null) : (row.operations ?? null),
        }))
      }

      const loadLatestPfmeaRevisionId = async () => {
        const res = await supabase
          .from('pfmea_rows')
          .select('revision_id,created_at,operations!inner(project_id)')
          .eq('operations.project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(200)

        if (res.error) throw res.error
        const rows = (res.data ?? []) as Array<{ revision_id?: string | null }>
        return rows.find((row) => normalizeText(row.revision_id))?.revision_id ?? null
      }

      let pfmeaSeedRows = revId ? await loadPfmeaSeeds(revId) : []
      if (pfmeaSeedRows.filter((row) => isPfmeaSeedSelectedForPcp(row, pcpYellowMax)).length === 0) {
        const fallbackRevisionIds = [
          pv.current_open_revision_id,
          await loadLatestPfmeaRevisionId(),
        ].filter((candidate, index, arr): candidate is string => !!candidate && arr.indexOf(candidate) === index && candidate !== revId)

        for (const fallbackRevisionId of fallbackRevisionIds) {
          pfmeaSeedRows = await loadPfmeaSeeds(fallbackRevisionId)
          if (pfmeaSeedRows.filter((row) => isPfmeaSeedSelectedForPcp(row, pcpYellowMax)).length > 0) break
        }
      }

      const requiredCounts: Record<string, number> = {}
      const seedRowsByOperation = new Map<string, PfmeaPcpSeedRow[]>()
      const seedRowsFiltered = pfmeaSeedRows.filter((row) => isPfmeaSeedSelectedForPcp(row, pcpYellowMax))
      for (const row of seedRowsFiltered) {
        const items = seedRowsByOperation.get(row.operation_id) ?? []
        items.push(row)
        seedRowsByOperation.set(row.operation_id, items)
        requiredCounts[row.operation_id] = items.length
      }
      setRequiredRowCountByOperation(requiredCounts)

      const existingByOperation = new Map<string, PcpRow[]>()
      for (const row of normalizedRows) {
        const key = row.operation_id
        const arr = existingByOperation.get(key) ?? []
        arr.push(row)
        existingByOperation.set(key, arr)
      }

      const mergedRows: PcpRow[] = []
      const pfmeaBackfillCandidates: Array<{
        id: string
        patch: Pick<PcpRow, 'pfmea_row_id' | 'failure_mode' | 'characteristic' | 'class' | 'current_prevention' | 'current_detection'>
      }> = []
      let sortIndex = 0
      for (const op of operations) {
        const existing = existingByOperation.get(op.id) ?? []
        const pfmeaSeeds = seedRowsByOperation.get(op.id) ?? []
        const pfmeaSeedById = new Map(pfmeaSeeds.map((seed) => [seed.id, seed] as const))
        const getSeedIndexForExistingRow = (row: PcpRow) => {
          if (row.pfmea_row_id) {
            const directIndex = pfmeaSeeds.findIndex((seed) => seed.id === row.pfmea_row_id)
            if (directIndex >= 0) return directIndex
          }
          return pfmeaSeeds.findIndex((seed) =>
            isEquivalentPcpRow(
              {
                operation_id: row.operation_id,
                pfmea_row_id: row.pfmea_row_id ?? null,
                failure_mode: row.failure_mode,
                characteristic: row.characteristic,
                class: row.class,
                current_prevention: row.current_prevention,
                current_detection: row.current_detection,
              },
              {
                operation_id: seed.operation_id,
                pfmea_row_id: seed.id,
                failure_mode: seed.failure_mode,
                characteristic: seed.characteristic,
                class: seed.class,
                current_prevention: seed.current_prevention,
                current_detection: seed.current_detection,
              }
            )
          )
        }
        const existingSorted = [...existing].sort((a, b) => {
          const aSeedIndex = getSeedIndexForExistingRow(a)
          const bSeedIndex = getSeedIndexForExistingRow(b)
          const aHasSeed = aSeedIndex >= 0
          const bHasSeed = bSeedIndex >= 0
          if (aHasSeed && bHasSeed && aSeedIndex !== bSeedIndex) return aSeedIndex - bSeedIndex
          if (aHasSeed !== bHasSeed) return aHasSeed ? -1 : 1
          const aTime = getComparableTime(a.created_at)
          const bTime = getComparableTime(b.created_at)
          if (aTime !== bTime) return aTime - bTime
          return normalizeText(a.id).localeCompare(normalizeText(b.id))
        })
        const usedSeedIds = new Set<string>()

        existingSorted.forEach((row, index) => {
          const linkedSeed =
            (row.pfmea_row_id ? pfmeaSeedById.get(row.pfmea_row_id) : null) ??
            (pfmeaSeeds[index] ?? null)

          if (linkedSeed?.id) usedSeedIds.add(linkedSeed.id)

          const mergedPatch = {
            pfmea_row_id: linkedSeed?.id ?? row.pfmea_row_id ?? null,
            failure_mode: normalizeText(row.failure_mode) || normalizeText(linkedSeed?.failure_mode) || null,
            characteristic: normalizeText(row.characteristic) || normalizeText(linkedSeed?.characteristic),
            class: normalizeClassValue(row.class) ?? normalizeClassValue(linkedSeed?.class) ?? null,
            severity: asInt1to10(row.severity) ?? asInt1to10(linkedSeed?.severity),
            rpn: typeof row.rpn === 'number' && Number.isFinite(row.rpn) ? row.rpn : (typeof linkedSeed?.rpn === 'number' && Number.isFinite(linkedSeed.rpn) ? linkedSeed.rpn : null),
            current_prevention: normalizeText(row.current_prevention) || normalizeText(linkedSeed?.current_prevention) || null,
            current_detection: normalizeText(row.current_detection) || normalizeText(linkedSeed?.current_detection) || null,
          }

          if (
            isEditOwner &&
            draftRevId &&
            revId === draftRevId &&
            !isPlaceholderPcpRowId(row.id) &&
            linkedSeed &&
            (
              row.pfmea_row_id !== linkedSeed.id ||
              normalizeText(row.failure_mode) !== (mergedPatch.failure_mode ?? '') ||
              normalizeText(row.characteristic) !== mergedPatch.characteristic ||
              normalizeClassValue(row.class) !== mergedPatch.class ||
              asInt1to10(row.severity) !== (mergedPatch.severity ?? null) ||
              (typeof row.rpn === 'number' && Number.isFinite(row.rpn) ? row.rpn : null) !== (mergedPatch.rpn ?? null) ||
              normalizeText(row.current_prevention) !== (mergedPatch.current_prevention ?? '') ||
              normalizeText(row.current_detection) !== (mergedPatch.current_detection ?? '')
            )
          ) {
            pfmeaBackfillCandidates.push({
              id: row.id,
              patch: {
                pfmea_row_id: mergedPatch.pfmea_row_id,
                failure_mode: mergedPatch.failure_mode,
                characteristic: mergedPatch.characteristic,
                class: mergedPatch.class,
                current_prevention: mergedPatch.current_prevention,
                current_detection: mergedPatch.current_detection,
              },
            })
          }

          mergedRows.push({ ...row, ...mergedPatch, __sortIndex: sortIndex++ })
        })

        for (const seed of pfmeaSeeds) {
          if (usedSeedIds.has(seed.id)) continue
          mergedRows.push(
            makePcpPlaceholderRow(
              op,
              revId,
              `${op.id}:${seed.id}`,
              seed,
              sortIndex++
            )
          )
        }
      }

      if (pfmeaBackfillCandidates.length > 0) {
        const updates = await Promise.all(
          pfmeaBackfillCandidates.map((candidate) =>
            supabase
              .from('control_plan_rows')
              .update(candidate.patch)
              .eq('id', candidate.id)
          )
        )

        const failedUpdate = updates.find((result) => result.error)
        if (failedUpdate?.error) throw failedUpdate.error

        setDirtyIds((prev) => {
          const next = new Set(prev)
          pfmeaBackfillCandidates.forEach((candidate) => next.add(candidate.id))
          return Array.from(next)
        })
      }

      setRows(mergedRows)

      setLoading(false)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setLoading(false)
    }
  }, [projectId, loadProjectView, loadPcpSelectionThreshold, draftRevisionIdOverride, isEditOwner])
  const loadRevisionHistory = useCallback(async () => {
    if (!projectId) {
      setHistoryEntries([])
      return
    }
    setHistoryLoading(true)
    try {
      const customRes = await supabase
        .from('pcp_change_history')
        .select('id,created_at,revision_label,change_description,author_name,control_count')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (!customRes.error && (customRes.data?.length ?? 0) > 0) {
        const rowsRaw = (customRes.data ?? []) as Array<{ id?: string | null; created_at?: string | null; revision_label?: string | null; change_description?: string | null; author_name?: string | null; control_count?: number | null }>
        setHistoryEntries(rowsRaw.map((x, idx) => ({
          id: x.id ?? `pcp-h-db-${idx}`,
          at: x.created_at ?? new Date(0).toISOString(),
          revisionLabel: (x.revision_label ?? '0.0.0').toString(),
          author: normalizeText(x.author_name) || 'Unknown user',
          controlCount: x.control_count ?? null,
          description: x.change_description ?? '',
        })))
        return
      }

      const fallbackRes = await supabase
        .from('process_module_revisions')
        .select('*')
        .eq('project_id', projectId)
        .eq('module', 'PCP')
        .order('created_at', { ascending: false })
        .limit(200)
      if (fallbackRes.error) throw fallbackRes.error

      const rowsRaw = (fallbackRes.data ?? []) as Array<Record<string, unknown>>
      setHistoryEntries(rowsRaw.map((x, idx) => ({
        id: normalizeText(x.id) || `pcp-h-fb-${idx}`,
        at: normalizeText(x.created_at) || new Date(0).toISOString(),
        revisionLabel: normalizeText(x.revision_label) || '0.0.0',
        author: normalizeText(x.author_name) || normalizeText(x.updated_by_name) || normalizeText(x.created_by_name) || normalizeText(x.user_name) || 'Unknown user',
        controlCount: null,
        description: normalizeText(x.change_description),
      })))
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setHistoryEntries([])
    } finally {
      setHistoryLoading(false)
    }
  }, [projectId])

  const startEditSession = useCallback(async () => {
    if (!projectId || !userId || isObsolete) return
    setSessionBusy(true)
    setErr('')
    setSessionMsg('')
    try {
      const nowIso = new Date().toISOString()
      const res = await supabase
        .from('pcp_edit_sessions')
        .select('project_id,locked_by,last_activity_at')
        .eq('project_id', projectId)
        .maybeSingle()
      const row = (res.data ?? null) as { locked_by?: string | null; last_activity_at?: string | null } | null
      const otherOwner = row?.locked_by ?? null
      const last = row?.last_activity_at ? new Date(row.last_activity_at).getTime() : 0
      const hasActiveOther = !!otherOwner && otherOwner !== userId && Date.now() - last < EDIT_LOCK_MS
      if (hasActiveOther && !isChampion) {
        setErr('This PCP is currently locked by another user.')
        return
      }

      if (otherOwner && otherOwner !== userId) {
        const projectRes = await supabase.from('projects_with_revision').select('current_draft_revision_id').eq('id', projectId).maybeSingle()
        const draftId = (projectRes.data?.current_draft_revision_id as string | null | undefined) ?? draftRevisionIdOverride
        if (draftId) {
          await supabase.from('control_plan_rows').delete().eq('revision_id', draftId)
          setDraftRevisionIdOverride(null)
          setDirtyIds([])
          setDeletedIds([])
        }
        const reason = Date.now() - last >= EDIT_LOCK_MS ? '48h inactivity timeout' : 'session takeover by Champion'
        setSessionMsg(`Previous PCP draft was discarded (${reason}).`)
      }

      const upsertRes = await supabase.from('pcp_edit_sessions').upsert([{ project_id: projectId, locked_by: userId, started_at: nowIso, last_activity_at: nowIso, updated_at: nowIso }], { onConflict: 'project_id' })
      if (upsertRes.error) throw new Error(upsertRes.error.message)
      await loadEditSession()
      await loadAll()
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSessionBusy(false)
    }
  }, [projectId, userId, isObsolete, isChampion, loadEditSession, draftRevisionIdOverride, loadAll])

  const discardDraftAndCloseSession = useCallback(async () => {
    if (!projectId || !userId || !isEditOwner) return
    setSessionBusy(true)
    setErr('')
    try {
      const projectRes = await supabase.from('projects_with_revision').select('current_draft_revision_id').eq('id', projectId).maybeSingle()
      const draftId = (projectRes.data?.current_draft_revision_id as string | null | undefined) ?? draftRevisionIdOverride
      if (draftId) await supabase.from('control_plan_rows').delete().eq('revision_id', draftId)
      await supabase.from('pcp_edit_sessions').delete().eq('project_id', projectId).eq('locked_by', userId)
      setDraftRevisionIdOverride(null)
      setDirtyIds([])
      setDeletedIds([])
      await loadEditSession()
      await loadAll()
      setSessionMsg('Draft discarded. Session closed without publishing.')
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSessionBusy(false)
    }
  }, [projectId, userId, isEditOwner, draftRevisionIdOverride, loadEditSession, loadAll])

  const updateRow = useCallback(async (row: PcpRow, patch: Partial<PcpRow>) => {
    if (readOnly) return
    try {
      const hadDraftBeforeEdit = !!project?.current_draft_revision_id
      const revId = await ensureDraftIfNeeded()
      const finalRev = revId ?? workingRevisionId
      if (!finalRev) throw new Error('No working revision found.')
      const payload: Partial<PcpRow> = { ...patch }
      if ('source' in payload) payload.source = normalizeText(payload.source || 'MANUAL').toUpperCase()
      if ('status' in payload) payload.status = normalizeText(payload.status || 'OPEN').toUpperCase()
      if ('class' in payload) payload.class = normalizeClassValue((payload.class as string | null | undefined) ?? null)
      let targetRow = row
      let requiresReload = !hadDraftBeforeEdit
      if (!isPlaceholderPcpRowId(row.id) && !row.__placeholder && row.revision_id !== finalRev) {
        await ensureDraftRowsHydrated(finalRev, row.revision_id ?? project?.current_open_revision_id ?? workingRevisionId)
        const mappedRow = await findEquivalentRowInRevision(row, finalRev)
        if (!mappedRow) throw new Error('Failed to map PCP row into the current draft revision.')
        targetRow = mappedRow
        requiresReload = true
        setEdit((prev) => (prev && prev.rowId === row.id ? { ...prev, rowId: mappedRow.id } : prev))
      }
      if (isPlaceholderPcpRowId(row.id) || row.__placeholder) {
        const insertPayload = buildPcpRowPayload({
          operation_id: row.operation_id,
          revision_id: finalRev,
          pfmea_row_id: row.pfmea_row_id ?? null,
          failure_mode: payload.failure_mode ?? row.failure_mode ?? '',
          characteristic: payload.characteristic ?? row.characteristic ?? '',
          class: normalizeClassValue((payload.class as string | null | undefined) ?? row.class ?? null),
          current_prevention: payload.current_prevention ?? row.current_prevention ?? '',
          current_detection: payload.current_detection ?? row.current_detection ?? '',
          control_method: payload.control_method ?? row.control_method ?? '',
          sample_size: payload.sample_size ?? row.sample_size ?? '',
          frequency: payload.frequency ?? row.frequency ?? '',
          reaction_plan: payload.reaction_plan ?? row.reaction_plan ?? '',
          source: payload.source ?? row.source ?? 'MANUAL',
          status: payload.status ?? row.status ?? 'OPEN',
        })
        const ins = await supabase.from('control_plan_rows').insert([insertPayload]).select('id,created_at,updated_at').single()
        if (ins.error) throw ins.error
        const newId = ins.data?.id
        if (!newId) throw new Error('Failed to create PCP row.')
        markDirty(newId)
        setRows((prev) =>
          prev.map((x) =>
            x.id === row.id
              ? ({
                  ...row,
                  ...insertPayload,
                  id: newId,
                  created_at: ins.data?.created_at ?? new Date().toISOString(),
                  updated_at: ins.data?.updated_at ?? new Date().toISOString(),
                  revision_id: finalRev,
                  __placeholder: false,
                } as PcpRow)
              : x
          )
        )
      } else {
        const res = await supabase.from('control_plan_rows').update(payload).eq('id', targetRow.id).eq('revision_id', finalRev)
        if (res.error) throw res.error
        markDirty(targetRow.id)
        if (requiresReload) {
          await loadAll(finalRev)
        } else {
          setRows((prev) => prev.map((x) => (x.id === targetRow.id ? ({ ...x, ...payload } as PcpRow) : x)))
        }
      }
      if (!hadDraftBeforeEdit && (isPlaceholderPcpRowId(row.id) || row.__placeholder)) await loadAll(finalRev)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }, [readOnly, ensureDraftIfNeeded, project?.current_draft_revision_id, project?.current_open_revision_id, workingRevisionId, markDirty, loadAll, ensureDraftRowsHydrated, findEquivalentRowInRevision])

  const deleteRow = useCallback(async (id: string) => {
    if (readOnly) return
    if (!window.confirm('Delete PCP row? This cannot be undone.')) return
    try {
      if (isPlaceholderPcpRowId(id)) return
      await ensureDraftIfNeeded()
      const currentRow = rows.find((row) => row.id === id)
      if (!currentRow) return
      const opId = currentRow.operation_id
      const currentRowsForOperation = rows.filter((row) => !isPlaceholderPcpRowId(row.id) && row.operation_id === opId)
      const requiredCount = requiredRowCountByOperation[opId] ?? 0
      if (currentRowsForOperation.length <= requiredCount) {
        const clearPayload = {
          control_method: '',
          sample_size: '',
          frequency: '',
          reaction_plan: '',
          source: currentRow.source || 'MANUAL',
          status: 'OPEN',
        }
        const res = await supabase.from('control_plan_rows').update(clearPayload).eq('id', id)
        if (res.error) throw res.error
        markDirty(id)
        setRows((prev) => prev.map((row) => (row.id === id ? ({ ...row, ...clearPayload } as PcpRow) : row)))
      } else {
        const res = await supabase.from('control_plan_rows').delete().eq('id', id)
        if (res.error) throw res.error
        setDeletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
        setDirtyIds((prev) => prev.filter((x) => x !== id))
        await loadAll()
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }, [readOnly, ensureDraftIfNeeded, rows, requiredRowCountByOperation, markDirty, loadAll])

  const handleSaveRevision = useCallback(async (descInput?: string) => {
    if (saveBusy) return
    if (!isDirty) {
      return
    }
    const desc = (descInput ?? '').trim()
    if (!desc) {
      setErr('Change description is required.')
      return
    }
    try {
      setSaveBusy(true)
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess?.session?.user?.id
      if (!uid) throw new Error('Not authenticated.')

      const { error } = await supabase.rpc('publish_process_module_revision', { p_project_id: projectId, p_module: 'PCP', p_change_description: desc, p_user_id: uid })
      if (error) throw error

      const revRes = await supabase.from('projects_with_revision').select('open_revision_label,draft_revision_label').eq('id', projectId).maybeSingle()
      const row = (revRes.data ?? null) as { open_revision_label?: string | null; draft_revision_label?: string | null } | null
      const revisionLabel = (row?.draft_revision_label ?? row?.open_revision_label ?? '0.0.0').toString()

      await supabase.from('pcp_change_history').insert([{ project_id: projectId, revision_label: revisionLabel || '0.0.0', change_description: desc, author_id: uid, author_name: currentAuthorName || 'Unknown user', control_count: rowsSorted.length, created_at: new Date().toISOString() }])

      setDirtyIds([])
      setDeletedIds([])
      setDraftRevisionIdOverride(null)
      if (projectId && userId) await supabase.from('pcp_edit_sessions').delete().eq('project_id', projectId).eq('locked_by', userId)
      await loadAll()
      await loadRevisionHistory()
      await loadEditSession()
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSaveBusy(false)
    }
  }, [saveBusy, isDirty, projectId, currentAuthorName, rowsSorted.length, userId, loadRevisionHistory, loadEditSession, loadAll])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!alive) return
      if (!data.session) {
        const next = window.location.pathname + window.location.search
        window.location.assign(`/login?next=${encodeURIComponent(next)}`)
        return
      }
      setUserId(data.session.user.id)
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    supabase.from('profiles').select('first_name,last_name').eq('id', userId).maybeSingle().then((res) => {
      const first = ((res.data as { first_name?: string | null } | null)?.first_name ?? '').trim()
      const last = ((res.data as { last_name?: string | null } | null)?.last_name ?? '').trim()
      const full = `${first} ${last}`.trim()
      setCurrentAuthorName(full || 'Unknown user')
    })
  }, [userId])

  useEffect(() => {
    if (!projectId || !userId) return
    void loadUserContext()
    void loadEditSession()
  }, [projectId, userId, loadUserContext, loadEditSession])

  useEffect(() => {
    if (!projectId) return
    loadAll()
  }, [projectId, isEditOwner, draftRevisionIdOverride, loadAll])

  useEffect(() => {
    if (!projectId) return
    const t = setInterval(() => {
      void loadEditSession()
      setSessionNow(Date.now())
    }, 30_000)
    return () => clearInterval(t)
  }, [projectId, loadEditSession])

  useEffect(() => {
    if (!projectId || !userId || !isEditOwner) return
    const beat = setInterval(() => {
      void supabase.from('pcp_edit_sessions').update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('project_id', projectId).eq('locked_by', userId)
    }, 30_000)
    return () => clearInterval(beat)
  }, [projectId, userId, isEditOwner])

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(`${PCP_VISIBLE_COLUMNS_KEY_PREFIX}:${userId}`)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<Record<PcpColumnId, boolean>>
      const next: Record<PcpColumnId, boolean> = { ...DEFAULT_VISIBLE_COLUMNS }
      for (const col of PCP_COLUMNS) {
        const value = parsed?.[col.id]
        if (typeof value === 'boolean') next[col.id] = value
      }
      next.delete = true
      setVisibleColumns(next)
    } catch {}
  }, [userId])

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(`${PCP_VISIBLE_COLUMNS_KEY_PREFIX}:${userId}`, JSON.stringify(visibleColumns))
    } catch {}
  }, [userId, visibleColumns])
  const card: React.CSSProperties = {
    background: SURFACE_BG,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    borderRadius: SURFACE_RADIUS,
    boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: SURFACE_TEXT,
  }
  const heroCard: React.CSSProperties = { ...card }
  const titleStyle: React.CSSProperties = { fontSize: 28, fontWeight: 600, letterSpacing: -0.3, color: SURFACE_TEXT }
  const subtitleStyle: React.CSSProperties = { marginTop: 4, fontSize: 13.5, color: 'rgba(255,255,255,0.78)' }
  const frame: React.CSSProperties = { width: '96%', marginLeft: 'auto', marginRight: 'auto' }
  const summaryTile: React.CSSProperties = {
    minHeight: 82,
    padding: '10px 12px',
    borderRadius: SURFACE_RADIUS,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    textAlign: 'center',
  }
  const summaryValue: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 800,
    lineHeight: 1,
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 18, position: 'relative', overflow: 'hidden', background: '#171f33' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: "url('/home-hero-bg.svg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(101, 69, 46, 0.58), rgba(23, 31, 51, 0.86))',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
      <style jsx global>{`
        .pfmeaTable ::selection,
        .pfmeaTable .pfmeaEditor::selection {
          background: rgba(148, 163, 184, 0.38);
          color: #f8fafc;
        }
        .pfmeaTable ::-moz-selection,
        .pfmeaTable .pfmeaEditor::-moz-selection {
          background: rgba(148, 163, 184, 0.38);
          color: #f8fafc;
        }
        .pfmeaTable .pfmeaEditor,
        .pfmeaTable .pfmeaEditor:focus {
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          width: 100% !important;
          font: inherit !important;
          color: inherit !important;
          padding: 0 !important;
          margin: 0 !important;
          display: block !important;
          line-height: inherit !important;
          text-align: inherit !important;
        }
        .pfmeaTable input.pfmeaEditor {
          height: 1.25em !important;
        }
        .pfmeaTable textarea.pfmeaEditor {
          white-space: pre-wrap !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          resize: none !important;
          overflow: hidden !important;
          min-height: 1.25em !important;
          height: 1.25em !important;
        }
        .pfmeaTd {
          padding: 10px 10px !important;
          vertical-align: middle;
          background: rgba(255,255,255,0.03);
          color: #e1e5ec;
          text-align: center;
          overflow: hidden;
          position: relative;
          font-weight: 500;
          font-size: 16px;
          line-height: 1.25;
          border: 0 !important;
        }
        .pfmeaTd.singleLine.editable {
          height: 45px;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
        }
        .pfmeaRow:not(:last-child) .pfmeaTd {
          border-bottom: 1px solid rgba(255,255,255,0.14) !important;
        }
        .pfmeaTd {
          border-right: 1px solid rgba(255,255,255,0.14) !important;
        }
        .pfmeaRow .pfmeaTd:last-child {
          border-right: 0 !important;
        }
        .pfmeaTd.singleLine { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pfmeaTd.center { text-align: center; }
        .pfmeaTd.gray { background: rgba(255,255,255,0.08); }
        .pfmeaTd.editable { cursor: text; position: relative; transition: box-shadow 0.14s ease, border-color 0.14s ease; }
        .pfmeaTd.editable:hover,
        .pfmeaTd.editable:focus-within { box-shadow: inset 0 0 0 1px rgba(96,165,250,0.45); border-radius: 0; }
        .pfmeaEditor { width: 100%; border: 0; outline: none; background: transparent; font: inherit; color: inherit; resize: vertical; min-height: 26px; }
        .rf-button { background: rgba(255,255,255,0.08); color: ${SURFACE_TEXT}; font-family: inherit; font-weight: 650; border: 1px solid rgba(255,255,255,0.18); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius: ${SURFACE_RADIUS}px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; min-height: 29px; padding: 0 12px; cursor: pointer; }
        .rf-button:hover { background: rgba(59,130,246,0.18) !important; border-color: rgba(96,165,250,0.45) !important; box-shadow: 0 10px 24px rgba(37,99,235,0.18) !important; }
        .rf-button:disabled { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.35); cursor: not-allowed; box-shadow: none !important; }
        .trashBtn {
          height: 29px;
          width: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255,255,255,0.08);
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease, transform 0.06s ease;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          color: rgba(255, 255, 255, 0.72);
        }
        .trashBtn:hover { background: rgba(239, 68, 68, 0.18); border-color: rgba(239, 68, 68, 0.4); color: rgba(239, 68, 68, 0.95); }
        .trashBtn:active { transform: translateY(1px); }
      `}</style>

      <div style={{ ...frame, marginTop: 20 }}>
      <div style={{ ...heroCard, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 360px', maxWidth: 520 }}>
            <div style={titleStyle}>PCP</div>
            <div style={subtitleStyle}>Manage the Production Control Plan for the selected process and publish PCP revisions.</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'grid', gridTemplateColumns: '174px 116px 116px', gap: 10, alignSelf: 'flex-start' }}>
            <SummaryCard title="Process" value={project?.name ? 1 : 0} displayValue={project?.name ?? '-'} bg="rgba(255,255,255,0.12)" bd="rgba(255,255,255,0.22)" fg="#f8fafc" style={summaryTile} valueStyle={{ ...summaryValue, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} />
            <SummaryCard title="Revision" value={0} displayValue={(workingRevisionLabel ?? '-').split('.').at(-1) ?? '-'} bg="rgba(255,255,255,0.12)" bd="rgba(255,255,255,0.22)" fg="#f8fafc" style={summaryTile} valueStyle={summaryValue} />
            <SummaryCard title="PCP rows" value={rowsSorted.length} bg="rgba(255,255,255,0.12)" bd="rgba(255,255,255,0.22)" fg="#f8fafc" style={summaryTile} valueStyle={summaryValue} />
          </div>
        </div>
      </div>
      </div>

      <div style={{ ...frame, marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/projects" className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }}>Project</Link>
          <Link href={`/pfd?project=${projectId}`} className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }}>PFD</Link>
          <Link href={`/pfmea?project=${projectId}`} className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }}>PFMEA</Link>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isEditOwner ? <button className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }} onClick={() => { setSaveDescription(''); setShowSave(true) }} disabled={readOnly || !isDirty}>Save PCP</button> : null}
          <button className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29, opacity: sessionBusy ? 0.6 : 1 }} onClick={() => void (isEditOwner ? discardDraftAndCloseSession() : startEditSession())} disabled={sessionBusy || isObsolete || (!isEditOwner && isLockedByOther && !isChampion)}>{sessionBusy ? 'Please wait...' : isEditOwner ? 'Discard draft' : isLockedByOther ? (isChampion ? 'Take over PCP' : 'PCP locked') : 'Edit PCP'}</button>
          <button className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }} onClick={() => void loadRevisionHistory().then(() => setHistoryOpen(true))} disabled={!projectId}>Revision History</button>
          <button className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }} onClick={() => setColumnFiltersOpen((v) => !v)}>{columnFiltersOpen ? 'Hide columns' : 'Set columns'}</button>
        </div>
      </div>

      {sessionMsg ? <div style={{ ...card, background: 'rgba(251,146,60,0.16)', borderColor: 'rgba(251,146,60,0.38)', padding: '8px 10px', marginBottom: 10, color: '#fde68a' }}>{sessionMsg}</div> : null}
      {isLockedByOther ? <div style={{ ...card, background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.28)', padding: '8px 10px', marginBottom: 8, color: '#fecaca' }}>PCP edit session is locked by another user{lockRemainingText ? ` (${lockRemainingText} left)` : ''}.</div> : null}
      {err ? <div style={{ ...card, background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.28)', padding: '8px 10px', marginBottom: 10, color: '#fecaca', fontWeight: 700 }}>{err}</div> : null}

      {columnFiltersOpen ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {PCP_COLUMN_FILTER_GROUPS.map((group) => (
              <div key={group.title} style={{ ...card, padding: '8px 12px', flex: 1, minWidth: 260 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong style={{ fontSize: 12, color: SURFACE_MUTED }}>{group.title}</strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="rf-button" style={smallBtn} onClick={() => uncheckColumnGroup(group.ids)}>Uncheck all</button>
                    <button className="rf-button" style={smallBtn} onClick={() => clearColumnGroup(group.ids)}>Clear</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {group.ids.map((id) => {
                    const checked = isColumnVisible(id)
                    const col = PCP_COLUMNS_BY_ID[id]
                    return (
                      <label key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 8px', borderRadius: 999, border: `1px solid ${SURFACE_BORDER}`, background: checked ? SURFACE_BG_STRONG : SURFACE_BG, color: SURFACE_TEXT }}>
                        <input type="checkbox" checked={checked} onChange={(e) => toggleColumnVisibility(id, e.target.checked)} />
                        <span>{col.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ ...card, padding: 0, borderRadius: SURFACE_RADIUS, overflow: 'visible' }}>
        <div className="pfmeaTable" style={{ maxHeight: 'calc(100vh - 280px)', overflowX: 'auto', overflowY: 'visible' }}>
          <table style={{ width: `${visibleTableWidth}px`, minWidth: `${visibleTableWidth}px`, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 16, fontFamily: 'Calibri, Arial, sans-serif' }}>
            <colgroup>{visibleColumnDefs.map((c) => <col key={c.id} style={{ width: widthOf(c.id) }} />)}</colgroup>
            <thead>
              <tr>
                {isColumnVisible('id') ? <Th w={widthOf('id')}>ID#</Th> : null}
                {isColumnVisible('station') ? <Th w={widthOf('station')}>STATION</Th> : null}
                {isColumnVisible('operation') ? <Th w={widthOf('operation')}>OPERATION</Th> : null}
                {isColumnVisible('process_step') ? <Th w={widthOf('process_step')}>PROCESS STEP</Th> : null}
                {isColumnVisible('failure_mode') ? <Th w={widthOf('failure_mode')}>FAILURE MODE</Th> : null}
                {isColumnVisible('characteristic') ? <Th w={widthOf('characteristic')}>CHARACTERISTIC</Th> : null}
                {isColumnVisible('class') ? <Th w={widthOf('class')}>CLASS</Th> : null}
                {isColumnVisible('severity') ? <Th w={widthOf('severity')}>SEV</Th> : null}
                {isColumnVisible('rpn') ? <Th w={widthOf('rpn')}>RPN</Th> : null}
                {isColumnVisible('current_prevention') ? <Th w={widthOf('current_prevention')}>CURRENT CONTROLS (PREV)</Th> : null}
                {isColumnVisible('current_detection') ? <Th w={widthOf('current_detection')}>CURRENT CONTROLS (DET)</Th> : null}
                {isColumnVisible('control_method') ? <Th w={widthOf('control_method')}>CONTROL METHOD</Th> : null}
                {isColumnVisible('sample_size') ? <Th w={widthOf('sample_size')}>SAMPLE SIZE</Th> : null}
                {isColumnVisible('frequency') ? <Th w={widthOf('frequency')}>FREQUENCY</Th> : null}
                {isColumnVisible('reaction_plan') ? <Th w={widthOf('reaction_plan')}>REACTION PLAN</Th> : null}
              </tr>
            </thead>
            <tbody>
              {rowsSorted.map((r) => (
                <tr key={r.id} className="pfmeaRow">
                  {(() => {
                    const severityValue = asInt1to10(r.severity)
                    const severityHighlighted = severityValue != null && severityValue >= 9
                    const rpnValue = typeof r.rpn === 'number' && Number.isFinite(r.rpn) ? r.rpn : null
                    const rpnHighlighted = rpnValue != null && rpnValue > pcpYellowMax
                    const highlightedMetricStyle: React.CSSProperties = {
                      color: '#d9a86c',
                    }
                    return (
                      <>
                  {isColumnVisible('id') ? <TdRead value={String(r.operations?.operation_number ?? '-')} className="pfmeaTd center gray singleLine" /> : null}
                  {isColumnVisible('station') ? <TdRead value={r.operations?.machine ?? ''} className="pfmeaTd gray singleLine" /> : null}
                  {isColumnVisible('operation') ? <TdRead value={r.operations?.operation ?? ''} className="pfmeaTd gray singleLine" /> : null}
                  {isColumnVisible('process_step') ? <TdRead value={r.operations?.name ?? ''} className="pfmeaTd gray singleLine" /> : null}
                  {isColumnVisible('failure_mode') ? <TdText value={r.failure_mode} editing={edit?.rowId === r.id && edit?.col === 'failure_mode'} onStart={() => setEdit({ rowId: r.id, col: 'failure_mode' })} onCommit={(v) => void updateRow(r, { failure_mode: v })} onCancel={() => setEdit(null)} disabled={readOnly} className="gray" /> : null}
                  {isColumnVisible('characteristic') ? <TdText value={r.characteristic} editing={edit?.rowId === r.id && edit?.col === 'characteristic'} onStart={() => setEdit({ rowId: r.id, col: 'characteristic' })} onCommit={(v) => void updateRow(r, { characteristic: v })} onCancel={() => setEdit(null)} disabled={readOnly} className="gray" /> : null}
                  {isColumnVisible('class') ? <TdClassPopup value={r.class} editing={edit?.rowId === r.id && edit?.col === 'class'} onStart={() => setEdit({ rowId: r.id, col: 'class' })} onCommit={(v) => void updateRow(r, { class: v || null })} onCancel={() => setEdit(null)} disabled={readOnly} /> : null}
                  {isColumnVisible('severity') ? <TdRead value={r.severity == null ? '' : String(r.severity)} className="pfmeaTd center gray singleLine" style={severityHighlighted ? highlightedMetricStyle : undefined} /> : null}
                  {isColumnVisible('rpn') ? <TdRead value={r.rpn == null ? '' : String(r.rpn)} className="pfmeaTd center gray singleLine" style={rpnHighlighted ? highlightedMetricStyle : undefined} /> : null}
                  {isColumnVisible('current_prevention') ? <TdText value={r.current_prevention} editing={edit?.rowId === r.id && edit?.col === 'current_prevention'} onStart={() => setEdit({ rowId: r.id, col: 'current_prevention' })} onCommit={(v) => void updateRow(r, { current_prevention: v })} onCancel={() => setEdit(null)} disabled={readOnly} className="gray" /> : null}
                  {isColumnVisible('current_detection') ? <TdText value={r.current_detection} editing={edit?.rowId === r.id && edit?.col === 'current_detection'} onStart={() => setEdit({ rowId: r.id, col: 'current_detection' })} onCommit={(v) => void updateRow(r, { current_detection: v })} onCancel={() => setEdit(null)} disabled={readOnly} className="gray" /> : null}
                  {isColumnVisible('control_method') ? <TdText value={r.control_method} editing={edit?.rowId === r.id && edit?.col === 'control_method'} onStart={() => setEdit({ rowId: r.id, col: 'control_method' })} onCommit={(v) => void updateRow(r, { control_method: v })} onCancel={() => setEdit(null)} disabled={readOnly} /> : null}
                  {isColumnVisible('sample_size') ? <TdText value={r.sample_size} editing={edit?.rowId === r.id && edit?.col === 'sample_size'} onStart={() => setEdit({ rowId: r.id, col: 'sample_size' })} onCommit={(v) => void updateRow(r, { sample_size: v })} onCancel={() => setEdit(null)} disabled={readOnly} singleLine /> : null}
                  {isColumnVisible('frequency') ? <TdText value={r.frequency} editing={edit?.rowId === r.id && edit?.col === 'frequency'} onStart={() => setEdit({ rowId: r.id, col: 'frequency' })} onCommit={(v) => void updateRow(r, { frequency: v })} onCancel={() => setEdit(null)} disabled={readOnly} singleLine /> : null}
                  {isColumnVisible('reaction_plan') ? <TdText value={r.reaction_plan} editing={edit?.rowId === r.id && edit?.col === 'reaction_plan'} onStart={() => setEdit({ rowId: r.id, col: 'reaction_plan' })} onCommit={(v) => void updateRow(r, { reaction_plan: v })} onCancel={() => setEdit(null)} disabled={readOnly} /> : null}
                      </>
                    )
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {showSave ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => !saveBusy && setShowSave(false)}>
          <div style={{ width: 560, maxWidth: '92vw', background: SURFACE_PANEL_BG, borderRadius: SURFACE_RADIUS, border: `1px solid ${SURFACE_BORDER}`, boxShadow: '0 16px 36px rgba(0,0,0,0.2)', padding: 20, color: SURFACE_TEXT }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>Save PCP</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 12 }}>Describe what you changed.</div>
            <textarea value={saveDescription} onChange={(e) => setSaveDescription(e.target.value)} rows={5} style={{ width: '100%', borderRadius: SURFACE_RADIUS, border: `1px solid ${SURFACE_BORDER}`, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', marginBottom: 14, background: SURFACE_BG, color: SURFACE_TEXT }} />
            <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 6 }}>Next revision: <b>{nextPcpRevisionLabel(workingRevisionLabel)}</b></div>
            <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 6 }}>Author: <b>{currentAuthorName}</b></div>
            <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 14 }}>Current PCP: <b>{rowsSorted.length}</b> controls</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }} onClick={() => setShowSave(false)} disabled={saveBusy}>Cancel</button>
              <button className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }} onClick={() => { void handleSaveRevision(saveDescription).then(() => { setShowSave(false); setSaveDescription('') }) }} disabled={saveBusy || !saveDescription.trim()}>{saveBusy ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {historyOpen ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1450, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setHistoryOpen(false)}>
          <div style={{ width: 920, maxWidth: '96vw', maxHeight: '80vh', overflow: 'auto', background: SURFACE_PANEL_BG, borderRadius: SURFACE_RADIUS, border: `1px solid ${SURFACE_BORDER}`, boxShadow: '0 16px 36px rgba(0,0,0,0.2)', padding: 20, color: SURFACE_TEXT }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 19 }}>PCP revision history</span>
              <button className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }} onClick={() => setHistoryOpen(false)}>Close</button>
            </div>
            {historyLoading ? (
              <div style={{ fontSize: 14, color: SURFACE_MUTED, padding: '10px 0' }}>Loading history...</div>
            ) : historyEntries.length === 0 ? (
              <div style={{ fontSize: 14, color: SURFACE_MUTED, padding: '10px 0' }}>No saved history yet.</div>
            ) : (
              <div style={{ maxHeight: 260, overflowX: 'auto', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: SURFACE_RADIUS }}>
                  <thead>
                    <tr>
                      <th style={thHistory}>Revision</th>
                      <th style={thHistory}>Date</th>
                      <th style={thHistory}>Author</th>
                      <th style={thHistory}>Description</th>
                      <th style={thHistory}>Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyEntries.map((h) => (
                      <tr key={h.id}>
                        <td style={{ ...tdHistory, textAlign: 'center', fontSize: 15, color: SURFACE_TEXT, fontWeight: 700 }}>{h.revisionLabel}</td>
                        <td style={tdHistory}>{formatDateTimePL(h.at)}</td>
                        <td style={tdHistory}>{h.author || '-'}</td>
                        <td style={{ ...tdHistory, fontSize: 15, color: SURFACE_TEXT }}>{h.description || '-'}</td>
                        <td style={{ ...tdHistory, textAlign: 'center' }}>{h.controlCount == null ? '-' : String(h.controlCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
      </div>
    </div>
  )
}

function SummaryCard(props: { title: string; value: number; displayValue?: React.ReactNode; bg: string; bd: string; fg: string; style?: React.CSSProperties; valueStyle?: React.CSSProperties }) {
  return <div style={{ ...props.style, border: `1px solid ${props.bd}`, background: props.bg }}><div style={{ color: props.fg, fontSize: 12, marginBottom: 8 }}>{props.title}</div><div style={{ color: props.fg, ...(props.valueStyle ?? { fontSize: 24, fontWeight: 800, lineHeight: 1 }) }}>{props.displayValue ?? props.value}</div></div>
}

function Th(props: { w: string; children?: React.ReactNode }) {
  return <th style={{ border: '1px solid rgba(255,255,255,0.14)', background: SURFACE_PANEL_BG, color: SURFACE_TEXT, textAlign: 'center', fontSize: 12, padding: '8px 10px', fontWeight: 800, width: props.w }}>{props.children}</th>
}

function TdRead(props: { value: string; className?: string; style?: React.CSSProperties }) {
  return <td className={props.className ?? 'pfmeaTd singleLine'} style={props.style}>{props.value ?? ''}</td>
}

function TdText(props: { value: string | null; editing: boolean; onStart: () => void; onCommit: (v: string) => void; onCancel: () => void; disabled?: boolean; singleLine?: boolean; className?: string; style?: React.CSSProperties }) {
  const [val, setVal] = useState(props.value ?? '')
  useEffect(() => setVal(props.value ?? ''), [props.value])
  const cellClassName = `pfmeaTd ${props.className ?? ''} ${props.singleLine ? 'singleLine' : ''}`.trim()
  const singleLineCellStyle: React.CSSProperties | undefined = props.singleLine ? {
    ...props.style,
    height: 45,
    paddingTop: 0,
    paddingBottom: 0,
    verticalAlign: 'middle',
  } : props.style
  const singleLineEditorStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    height: 45,
    lineHeight: '45px',
    boxSizing: 'border-box',
  }
  if (props.disabled) return <td className={cellClassName} style={singleLineCellStyle}>{val || ''}</td>
  if (!props.editing) return <td className={`${cellClassName} editable`.trim()} style={singleLineCellStyle} onClick={props.onStart}>{val || ''}</td>
  return <td className={`${cellClassName} editable`.trim()} style={singleLineCellStyle}>{props.singleLine ? <input autoFocus className="pfmeaEditor" style={singleLineEditorStyle} value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => { props.onCancel(); if (val !== (props.value ?? '')) props.onCommit(val) }} /> : <textarea autoFocus className="pfmeaEditor" rows={1} value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => { props.onCancel(); if (val !== (props.value ?? '')) props.onCommit(val) }} />}</td>
}

function TdClassPopup(props: { value: string | null; editing: boolean; onStart: () => void; onCommit: (v: string) => void; onCancel: () => void; disabled?: boolean }) {
  const [anchorEl, setAnchorEl] = useState<HTMLTableCellElement | null>(null)
  const [hoverOpen, setHoverOpen] = useState(false)
  const normalizedValue = normalizeClassValue(props.value)
  const details = normalizedValue ? CLASS_OPTION_DETAILS[normalizedValue] : null
  const setAnchorRef = useCallback((node: HTMLTableCellElement | null) => {
    setAnchorEl((current) => current === node ? current : node)
  }, [])
  const detailsPopup = hoverOpen && anchorEl && details && typeof document !== 'undefined'
    ? createPortal(
        <div
          data-pfmea-popup="true"
          style={{
            ...anchoredPopupStyle(anchorEl, 360),
            zIndex: 130,
            overflowY: 'auto',
            borderRadius: 10,
            border: `1px solid ${SURFACE_BORDER}`,
            background: 'rgb(52, 57, 69)',
            boxShadow: '0 14px 30px rgba(0,0,0,0.18)',
            padding: 10,
            textAlign: 'left',
            position: 'fixed',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#d9a86c', marginBottom: 6 }}>
            {details.title}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {details.description.map((line, idx) => (
              <div key={`${normalizedValue}-detail-${idx}`} style={{ fontSize: 12, color: '#d9a86c', lineHeight: 1.35, fontWeight: 400 }}>
                - {line}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )
    : null

  if (props.disabled) {
    return (
      <td
        ref={setAnchorRef}
        className="pfmeaTd center gray singleLine"
        style={{ color: '#d9a86c' }}
        onMouseEnter={() => details ? setHoverOpen(true) : null}
        onMouseLeave={() => setHoverOpen(false)}
      >
        {props.value ?? ''}
        {detailsPopup}
      </td>
    )
  }

  if (!props.editing) {
    return (
      <td
        ref={setAnchorRef}
        className="pfmeaTd editable center gray singleLine"
        style={{ color: '#d9a86c' }}
        onClick={props.onStart}
        onMouseEnter={() => details ? setHoverOpen(true) : null}
        onMouseLeave={() => setHoverOpen(false)}
      >
        {props.value ?? ''}
        {detailsPopup}
      </td>
    )
  }

  return <TdSelectPopup value={props.value} editing={props.editing} onStart={props.onStart} onCommit={props.onCommit} onCancel={props.onCancel} options={PCP_CLASS_OPTIONS} disabled={props.disabled} className="gray" textColor="#d9a86c" />
}

function TdSelectPopup(props: { value: string | null; editing: boolean; onStart: () => void; onCommit: (v: string) => void; onCancel: () => void; options: string[]; disabled?: boolean; className?: string; textColor?: string }) {
  const cellClassName = `pfmeaTd center singleLine ${props.className ?? ''}`.trim()
  const textColor = props.textColor ?? SURFACE_TEXT
  if (props.disabled) return <td className={cellClassName} style={{ color: textColor }}>{props.value ?? ''}</td>
  if (!props.editing) return <td className={`${cellClassName} editable`.trim()} style={{ color: textColor }} onClick={props.onStart}>{props.value ?? ''}</td>
  return <td className={`${cellClassName} editable`.trim()} style={{ position: 'relative', color: textColor }}><button type="button" style={{ width: '100%', border: 0, background: 'transparent', fontWeight: 700, color: textColor }}>{props.value ?? '-'}</button><div onMouseLeave={props.onCancel} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 120, width: 260, maxHeight: 240, overflowY: 'auto', borderRadius: SURFACE_RADIUS, border: `1px solid ${SURFACE_BORDER}`, background: 'rgb(52, 57, 69)', boxShadow: '0 14px 32px rgba(0,0,0,0.16)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>{props.options.map((opt) => <button key={opt} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { props.onCancel(); props.onCommit(opt) }} style={{ display: 'block', width: '100%', textAlign: 'left', border: '1px solid transparent', borderRadius: 8, background: opt === props.value ? 'rgba(255,255,255,0.12)' : 'transparent', color: textColor, padding: '7px 8px', cursor: 'pointer', fontSize: 12 }}>{opt}</button>)}</div></td>
}

const smallBtn: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, border: `1px solid ${SURFACE_BORDER}`, fontSize: 11, height: 24 }
const actionBtn: React.CSSProperties = { padding: '6px 10px', borderRadius: SURFACE_RADIUS, border: `1px solid ${SURFACE_BORDER}`, fontWeight: 650, fontSize: 12, color: SURFACE_TEXT, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', background: SURFACE_BG }
const thHistory: React.CSSProperties = { textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }
const tdHistory: React.CSSProperties = { padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.06)' }

function PcpPageFallback() {
  return (
    <div style={{ padding: 24, color: '#666', fontSize: 14, fontWeight: 700 }}>
      Loading PCP...
    </div>
  )
}

