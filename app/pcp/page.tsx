
'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
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
  characteristic: string
  control_method: string | null
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

type PfmeaClassSeedRow = {
  id: string
  operation_id: string
  class: string | null
  created_at?: string | null
  operations?: Operation | Operation[] | null
}

type PcpColumnId =
  | 'id'
  | 'station'
  | 'operation'
  | 'process_step'
  | 'characteristic'
  | 'control_method'
  | 'frequency'
  | 'reaction_plan'
  | 'source'
  | 'status'
  | 'updated'
  | 'delete'

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

const SOURCE_OPTIONS = ['MANUAL', 'AUTO']
const STATUS_OPTIONS = ['OPEN', 'REVIEW_REQUIRED', 'CLOSED', 'CANCELED']
const PCP_PLACEHOLDER_PREFIX = '__pcp_placeholder__:'

const PCP_COLUMNS: Array<{ id: PcpColumnId; label: string; width: number }> = [
  { id: 'id', label: 'ID#', width: 60 },
  { id: 'station', label: 'STATION', width: 120 },
  { id: 'operation', label: 'OPERATION', width: 140 },
  { id: 'process_step', label: 'PROCESS STEP', width: 170 },
  { id: 'characteristic', label: 'CHARACTERISTIC', width: 220 },
  { id: 'control_method', label: 'CONTROL METHOD', width: 200 },
  { id: 'frequency', label: 'FREQUENCY', width: 120 },
  { id: 'reaction_plan', label: 'REACTION PLAN', width: 220 },
  { id: 'source', label: 'SOURCE', width: 100 },
  { id: 'status', label: 'STATUS', width: 130 },
  { id: 'updated', label: 'UPDATED', width: 120 },
  { id: 'delete', label: 'DELETE', width: 55 },
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
  { title: 'Control Definition', ids: ['characteristic', 'control_method', 'frequency', 'reaction_plan'] },
  { title: 'Execution', ids: ['source', 'status', 'updated'] },
]

const DEFAULT_VISIBLE_COLUMNS: Record<PcpColumnId, boolean> = {
  id: true,
  station: true,
  operation: true,
  process_step: true,
  characteristic: true,
  control_method: true,
  frequency: true,
  reaction_plan: true,
  source: true,
  status: true,
  updated: true,
  delete: true,
}

function normalizeText(v: unknown) {
  return String(v ?? '').trim()
}

function formatDateOnly(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' })
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

function isPlaceholderPcpRowId(id: string | null | undefined) {
  return String(id ?? '').startsWith(PCP_PLACEHOLDER_PREFIX)
}

function makePcpPlaceholderRow(op: Operation, revisionId: string | null, seedKey: string, sortIndex: number): PcpRow {
  return {
    id: `${PCP_PLACEHOLDER_PREFIX}${seedKey}`,
    revision_id: revisionId,
    operation_id: op.id,
    characteristic: '',
    control_method: null,
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
      if (id === 'delete') return isEditOwner
      return visibleColumns[id] !== false
    },
    [visibleColumns, isEditOwner]
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

  const summary = useMemo(() => {
    let open = 0
    let review = 0
    let closed = 0
    let canceled = 0
    for (const r of rowsSorted) {
      const s = normalizeText(r.status).toUpperCase()
      if (s === 'OPEN') open += 1
      else if (s === 'REVIEW_REQUIRED') review += 1
      else if (s === 'CLOSED') closed += 1
      else if (s === 'CANCELED') canceled += 1
    }
    return { total: rowsSorted.length, open, review, closed, canceled }
  }, [rowsSorted])

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
    if (draftRevisionIdOverride) return draftRevisionIdOverride
    if (project?.current_draft_revision_id) return project.current_draft_revision_id
    if ((project?.status ?? 'DRAFT') === 'OBSOLETE') throw new Error('Process is OBSOLETE (read-only).')

    const { data, error } = await supabase.rpc('ensure_process_draft', {
      p_project_id: projectId,
      p_user_id: userId,
    })
    if (error) throw error

    const pv = await loadProjectView()
    const ensured = pv.current_draft_revision_id ?? (data as string | null) ?? null
    if (ensured) setDraftRevisionIdOverride(ensured)
    return ensured
  }, [projectId, userId, isEditOwner, draftRevisionIdOverride, project?.current_draft_revision_id, project?.status, loadProjectView])

  const loadAll = useCallback(async (forceRevisionId?: string | null) => {
    if (!projectId) return
    setLoading(true)
    setErr('')
    try {
      const pv = await loadProjectView()
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
        .select('id,revision_id,operation_id,characteristic,control_method,frequency,reaction_plan,source,status,created_at,updated_at,operations!inner(id,project_id,operation_number,name,machine,operation,active)')
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
          .select('id,operation_id,class,created_at,operations!inner(id,project_id,operation_number,name,machine,operation,active)')
          .eq('operations.project_id', projectId)
          .eq('revision_id', seedRevisionId)
          .order('operation_number', { foreignTable: 'operations', ascending: true })
          .order('created_at', { ascending: true })
        if (res.error) throw res.error
        return ((res.data ?? []) as Array<PfmeaClassSeedRow>).map((row) => ({
          ...row,
          operations: Array.isArray(row.operations) ? (row.operations[0] ?? null) : (row.operations ?? null),
        }))
      }

      let pfmeaSeedRows = revId ? await loadPfmeaSeeds(revId) : []
      if (pfmeaSeedRows.filter((row) => normalizeText(row.class)).length === 0 && pv.current_draft_revision_id && revId === pv.current_draft_revision_id && pv.current_open_revision_id && pv.current_open_revision_id !== revId) {
        pfmeaSeedRows = await loadPfmeaSeeds(pv.current_open_revision_id)
      }

      const requiredCounts: Record<string, number> = {}
      const seedRowsFiltered = pfmeaSeedRows.filter((row) => normalizeText(row.class))
      for (const row of seedRowsFiltered) {
        requiredCounts[row.operation_id] = (requiredCounts[row.operation_id] ?? 0) + 1
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
      let sortIndex = 0
      for (const op of operations) {
        const existing = existingByOperation.get(op.id) ?? []
        existing.forEach((row) => mergedRows.push({ ...row, __sortIndex: sortIndex++ }))
        const missing = Math.max(0, (requiredCounts[op.id] ?? 0) - existing.length)
        for (let i = 0; i < missing; i += 1) {
          mergedRows.push(makePcpPlaceholderRow(op, revId, `${op.id}:${i}`, sortIndex++))
        }
      }
      setRows(mergedRows)

      setLoading(false)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setLoading(false)
    }
  }, [projectId, loadProjectView, draftRevisionIdOverride, isEditOwner])
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
      if (isPlaceholderPcpRowId(row.id) || row.__placeholder) {
        const insertPayload = {
          operation_id: row.operation_id,
          revision_id: finalRev,
          characteristic: payload.characteristic ?? row.characteristic ?? '',
          control_method: payload.control_method ?? row.control_method ?? '',
          frequency: payload.frequency ?? row.frequency ?? '',
          reaction_plan: payload.reaction_plan ?? row.reaction_plan ?? '',
          source: payload.source ?? row.source ?? 'MANUAL',
          status: payload.status ?? row.status ?? 'OPEN',
        }
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
        const res = await supabase.from('control_plan_rows').update(payload).eq('id', row.id)
        if (res.error) throw res.error
        markDirty(row.id)
        setRows((prev) => prev.map((x) => (x.id === row.id ? ({ ...x, ...payload } as PcpRow) : x)))
      }
      if (!hadDraftBeforeEdit) await loadAll(finalRev)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }, [readOnly, ensureDraftIfNeeded, project?.current_draft_revision_id, workingRevisionId, markDirty, loadAll])

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
          characteristic: '',
          control_method: '',
          frequency: '',
          reaction_plan: '',
          source: 'MANUAL',
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
  const frame: React.CSSProperties = { width: '94%', marginLeft: 'auto', marginRight: 'auto' }
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
        }
        .pfmeaTable textarea.pfmeaEditor {
          white-space: pre-wrap !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          resize: none !important;
          overflow: hidden !important;
          min-height: 18px !important;
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
          <div style={{ width: '100%', maxWidth: 1180, marginLeft: 'auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) repeat(8, minmax(0, 1fr))', gap: 10, alignSelf: 'flex-start' }}>
            <SummaryCard title="Process" value={project?.name ? 1 : 0} displayValue={project?.name ?? '-'} bg="rgba(255,255,255,0.12)" bd="rgba(255,255,255,0.22)" fg="#f8fafc" style={summaryTile} valueStyle={{ ...summaryValue, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} />
            <SummaryCard title="Revision" value={0} displayValue={(workingRevisionLabel ?? '-').split('.').at(-1) ?? '-'} bg="rgba(255,255,255,0.12)" bd="rgba(255,255,255,0.22)" fg="#f8fafc" style={summaryTile} valueStyle={summaryValue} />
            <SummaryCard title="Operations" value={ops.length} bg="rgba(255,255,255,0.12)" bd="rgba(255,255,255,0.22)" fg="#f8fafc" style={summaryTile} valueStyle={summaryValue} />
            <SummaryCard title="PCP rows" value={rowsSorted.length} bg="rgba(255,255,255,0.12)" bd="rgba(255,255,255,0.22)" fg="#f8fafc" style={summaryTile} valueStyle={summaryValue} />
            <SummaryCard title="Open" value={summary.open} bg="rgba(251,146,60,0.18)" bd="rgba(251,146,60,0.45)" fg="#f8fafc" style={summaryTile} valueStyle={summaryValue} />
            <SummaryCard title="Review required" value={summary.review} bg="rgba(239,68,68,0.12)" bd="rgba(239,68,68,0.35)" fg="#f8fafc" style={summaryTile} valueStyle={summaryValue} />
            <SummaryCard title="Closed" value={summary.closed} bg="rgba(34,197,94,0.18)" bd="rgba(34,197,94,0.45)" fg="#f8fafc" style={summaryTile} valueStyle={summaryValue} />
            <div />
            <div />
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
          <button className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }} onClick={() => setColumnFiltersOpen((v) => !v)}>{columnFiltersOpen ? 'Hide columns' : 'Set columns'}</button>
          {isEditOwner ? <button className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }} onClick={() => { setSaveDescription(''); setShowSave(true) }} disabled={readOnly || !isDirty}>Save PCP</button> : null}
          <button className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }} onClick={() => void loadRevisionHistory().then(() => setHistoryOpen(true))} disabled={!projectId}>Revision History</button>
          <button className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29, opacity: sessionBusy ? 0.6 : 1 }} onClick={() => void (isEditOwner ? discardDraftAndCloseSession() : startEditSession())} disabled={sessionBusy || isObsolete || (!isEditOwner && isLockedByOther && !isChampion)}>{sessionBusy ? 'Please wait...' : isEditOwner ? 'Discard draft' : isLockedByOther ? (isChampion ? 'Take over PCP' : 'PCP locked') : 'Edit PCP'}</button>
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
            <thead><tr>{isColumnVisible('id') ? <Th w={widthOf('id')}>ID#</Th> : null}{isColumnVisible('station') ? <Th w={widthOf('station')}>STATION</Th> : null}{isColumnVisible('operation') ? <Th w={widthOf('operation')}>OPERATION</Th> : null}{isColumnVisible('process_step') ? <Th w={widthOf('process_step')}>PROCESS STEP</Th> : null}{isColumnVisible('characteristic') ? <Th w={widthOf('characteristic')}>CHARACTERISTIC</Th> : null}{isColumnVisible('control_method') ? <Th w={widthOf('control_method')}>CONTROL METHOD</Th> : null}{isColumnVisible('frequency') ? <Th w={widthOf('frequency')}>FREQUENCY</Th> : null}{isColumnVisible('reaction_plan') ? <Th w={widthOf('reaction_plan')}>REACTION PLAN</Th> : null}{isColumnVisible('source') ? <Th w={widthOf('source')}>SOURCE</Th> : null}{isColumnVisible('status') ? <Th w={widthOf('status')}>STATUS</Th> : null}{isColumnVisible('updated') ? <Th w={widthOf('updated')}>UPDATED</Th> : null}{isColumnVisible('delete') ? <Th w={widthOf('delete')} /> : null}</tr></thead>
            <tbody>
              {rowsSorted.map((r) => (
                <tr key={r.id} className="pfmeaRow">
                  {isColumnVisible('id') ? <TdRead value={String(r.operations?.operation_number ?? '-')} className="pfmeaTd center gray singleLine" /> : null}
                  {isColumnVisible('station') ? <TdRead value={r.operations?.machine ?? ''} className="pfmeaTd singleLine" /> : null}
                  {isColumnVisible('operation') ? <TdRead value={r.operations?.operation ?? ''} className="pfmeaTd singleLine" /> : null}
                  {isColumnVisible('process_step') ? <TdRead value={r.operations?.name ?? ''} className="pfmeaTd singleLine" /> : null}
                  {isColumnVisible('characteristic') ? <TdText value={r.characteristic} editing={edit?.rowId === r.id && edit?.col === 'characteristic'} onStart={() => setEdit({ rowId: r.id, col: 'characteristic' })} onCommit={(v) => void updateRow(r, { characteristic: v })} onCancel={() => setEdit(null)} disabled={readOnly} /> : null}
                  {isColumnVisible('control_method') ? <TdText value={r.control_method} editing={edit?.rowId === r.id && edit?.col === 'control_method'} onStart={() => setEdit({ rowId: r.id, col: 'control_method' })} onCommit={(v) => void updateRow(r, { control_method: v })} onCancel={() => setEdit(null)} disabled={readOnly} /> : null}
                  {isColumnVisible('frequency') ? <TdText value={r.frequency} editing={edit?.rowId === r.id && edit?.col === 'frequency'} onStart={() => setEdit({ rowId: r.id, col: 'frequency' })} onCommit={(v) => void updateRow(r, { frequency: v })} onCancel={() => setEdit(null)} disabled={readOnly} singleLine /> : null}
                  {isColumnVisible('reaction_plan') ? <TdText value={r.reaction_plan} editing={edit?.rowId === r.id && edit?.col === 'reaction_plan'} onStart={() => setEdit({ rowId: r.id, col: 'reaction_plan' })} onCommit={(v) => void updateRow(r, { reaction_plan: v })} onCancel={() => setEdit(null)} disabled={readOnly} /> : null}
                  {isColumnVisible('source') ? <TdSelectPopup value={r.source} editing={edit?.rowId === r.id && edit?.col === 'source'} onStart={() => setEdit({ rowId: r.id, col: 'source' })} onCommit={(v) => void updateRow(r, { source: v })} onCancel={() => setEdit(null)} options={SOURCE_OPTIONS} disabled={readOnly} /> : null}
                  {isColumnVisible('status') ? <TdSelectPopup value={r.status} editing={edit?.rowId === r.id && edit?.col === 'status'} onStart={() => setEdit({ rowId: r.id, col: 'status' })} onCommit={(v) => void updateRow(r, { status: v })} onCancel={() => setEdit(null)} options={STATUS_OPTIONS} disabled={readOnly} /> : null}
                  {isColumnVisible('updated') ? <TdRead value={formatDateOnly(r.updated_at)} className="pfmeaTd center gray singleLine" /> : null}
                  {isColumnVisible('delete') ? <td className="pfmeaTd center"><button className="trashBtn" onClick={() => deleteRow(r.id)} disabled={readOnly || isPlaceholderPcpRowId(r.id)}>x</button></td> : null}
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

function TdRead(props: { value: string; className?: string }) {
  return <td className={props.className ?? 'pfmeaTd singleLine'}>{props.value ?? ''}</td>
}

function TdText(props: { value: string | null; editing: boolean; onStart: () => void; onCommit: (v: string) => void; onCancel: () => void; disabled?: boolean; singleLine?: boolean }) {
  const [val, setVal] = useState(props.value ?? '')
  useEffect(() => setVal(props.value ?? ''), [props.value])
  if (props.disabled) return <td className={`pfmeaTd ${props.singleLine ? 'singleLine' : ''}`}>{val || ''}</td>
  if (!props.editing) return <td className={`pfmeaTd editable ${props.singleLine ? 'singleLine' : ''}`} onClick={props.onStart}>{val || ''}</td>
  return <td className={`pfmeaTd editable ${props.singleLine ? 'singleLine' : ''}`}>{props.singleLine ? <input className="pfmeaEditor" value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => { props.onCancel(); if (val !== (props.value ?? '')) props.onCommit(val) }} /> : <textarea className="pfmeaEditor" value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => { props.onCancel(); if (val !== (props.value ?? '')) props.onCommit(val) }} />}</td>
}

function TdSelectPopup(props: { value: string | null; editing: boolean; onStart: () => void; onCommit: (v: string) => void; onCancel: () => void; options: string[]; disabled?: boolean }) {
  if (props.disabled) return <td className="pfmeaTd center gray singleLine">{props.value ?? ''}</td>
  if (!props.editing) return <td className="pfmeaTd editable center gray singleLine" onClick={props.onStart}>{props.value ?? ''}</td>
  return <td className="pfmeaTd editable center gray singleLine" style={{ position: 'relative' }}><button type="button" style={{ width: '100%', border: 0, background: 'transparent', fontWeight: 700, color: SURFACE_TEXT }}>{props.value ?? '-'}</button><div onMouseLeave={props.onCancel} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 120, width: 260, maxHeight: 240, overflowY: 'auto', borderRadius: SURFACE_RADIUS, border: `1px solid ${SURFACE_BORDER}`, background: 'rgb(52, 57, 69)', boxShadow: '0 14px 32px rgba(0,0,0,0.16)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>{props.options.map((opt) => <button key={opt} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { props.onCancel(); props.onCommit(opt) }} style={{ display: 'block', width: '100%', textAlign: 'left', border: '1px solid transparent', borderRadius: 8, background: opt === props.value ? 'rgba(255,255,255,0.12)' : 'transparent', color: SURFACE_TEXT, padding: '7px 8px', cursor: 'pointer', fontSize: 12 }}>{opt}</button>)}</div></td>
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

