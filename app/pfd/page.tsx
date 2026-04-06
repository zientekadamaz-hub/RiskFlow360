'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import ReactFlow, {
  addEdge,
  Background,
  MiniMap,
  MarkerType,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge as ReactFlowEdge,
  type Node,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { supabase } from '../lib/supabaseBrowser'

// ✅ biblioteka symboli obok route
import { nodeTypes, type PfdData } from './_lib/nodes'
import OrthEdge from './_lib/edges/OrthEdge'
import { UI_FONT, S, OP_WIDTH, OP_HEIGHT, DEC_H, DEC_W, CIRCLE_D, HIT, START_W, START_H, TRI_W, TRI_H } from './_lib/ui/const'

/**
 * PFD + PFMEA mini panel (Supabase)
 */

type OperationRow = {
  id: string
  project_id: string
  operation_number: number | null
  name: string
  machine: string | null
  operation: string | null
  active: boolean
}

type PfmeaMiniRow = {
  id: string
  operation_id: string
  failure_mode: string
  effect: string
  cause: string
  severity: number | null
  occurrence: number | null
  detection: number | null
  rpn: number | null
  oxd: number | null
  created_at: string
}

type Edge = ReactFlowEdge & {
  pathOptions?: {
    borderRadius?: number
    offset?: number
  }
}

type ColKey = 'failure_mode' | 'effect' | 'cause' | 'severity' | 'occurrence' | 'detection'
type PfdHistoryEntry = {
  id: string
  at: string
  revision: number
  revisionLabel: string
  author: string
  description: string
  nodeCount: number
  edgeCount: number
}

type PfdEditSession = {
  projectId: string
  lockedBy: string
  startedAt: string
  lastActivityAt: string
  lockedByName: string
}

type ProjectProcessOptionRow = {
  name?: string | null
}

const EDIT_LOCK_HOURS = 48
const EDIT_LOCK_MS = EDIT_LOCK_HOURS * 60 * 60 * 1000
const SURFACE_RADIUS = 8
const SURFACE_BG = 'rgba(255,255,255,0.08)'
const SURFACE_BG_STRONG = 'rgba(255,255,255,0.12)'
const SURFACE_BORDER = 'rgba(255,255,255,0.16)'
const SURFACE_PANEL_BG = 'rgb(40, 39, 47)'
const SURFACE_TEXT = '#f8fafc'
const SURFACE_MUTED = 'rgba(255,255,255,0.72)'
const PFMEA_CELL_TEXT = '#d7dbe3'
const PFMEA_ACCENT = '#d9a86c'

/* ===================== PFMEA helpers (mini) ===================== */

function isInt1to10(n: any): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 10
}
function safeMul(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null
  const x = a * b
  if (!Number.isFinite(x)) return null
  return Math.trunc(x)
}
function safeRpn(sev: number | null, oxd: number | null): number | null {
  if (sev == null || oxd == null) return null
  const x = sev * oxd
  if (!Number.isFinite(x)) return null
  return Math.trunc(x)
}
function computeMiniDerived(row: PfmeaMiniRow): Pick<PfmeaMiniRow, 'oxd' | 'rpn'> {
  const sev = isInt1to10(row.severity) ? row.severity : null
  const occ = isInt1to10(row.occurrence) ? row.occurrence : null
  const det = isInt1to10(row.detection) ? row.detection : null
  const oxd = safeMul(occ, det)
  const rpn = safeRpn(sev, oxd)
  return { oxd, rpn }
}
function clamp10(n: number) {
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(10, Math.round(n)))
}

/* ===================== Layout ===================== */

const OPS_X = 170
const OPS_Y0 = 170
const MAGNET_GAP = Math.round(80 * S)
const OPS_GAP = OP_HEIGHT + MAGNET_GAP
const EDGE_MARKER = {
  type: MarkerType.ArrowClosed as const,
  width: 26 * S,
  height: 18 * S,
  color: '#dbe7f5',
}
const ZOOM_BASE = 0.6


/* ===================== HELPERS ===================== */

function isOperation(n: Node<PfdData>) {
  return n.data.kind === 'operation'
}
function isLinearStepNode(n: Node<PfdData>) {
  return n.data.kind === 'operation' || n.data.kind === 'processref'
}
function sortOpsByNumber(nodes: Node<PfdData>[]) {
  return [...nodes].sort((a, b) => (a.data.opNo ?? 0) - (b.data.opNo ?? 0))
}
function sortLinearSteps(nodes: Node<PfdData>[]) {
  return [...nodes].sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x))
}
function findLinearTail(nodes: Node<PfdData>[], edges: Edge[]) {
  const linearSteps = sortLinearSteps(nodes.filter(isLinearStepNode))
  if (linearSteps.length === 0) return null

  const linearIds = new Set(linearSteps.map((n) => n.id))
  const tails = linearSteps.filter(
    (node) => !edges.some((edge) => edge.source === node.id && linearIds.has(edge.target))
  )

  return tails.at(-1) ?? linearSteps.at(-1) ?? null
}
function findSmallestFree10(existing: number[]) {
  const set = new Set(existing)
  for (let x = 10; x <= 10000; x += 10) if (!set.has(x)) return x
  return (existing.length ? Math.max(...existing) : 0) + 10
}
function isOperationId(id: string) {
  return typeof id === 'string' && !id.startsWith('dec-') && !id.startsWith('cir-')
}

function nodeRect(n: Node<PfdData>) {
  if (n.data.kind === 'operation') return { w: OP_WIDTH, h: OP_HEIGHT }
  if (n.data.kind === 'processref') return { w: OP_WIDTH, h: OP_HEIGHT }
  if (n.data.kind === 'decision') return { w: DEC_W, h: DEC_H }
  if (n.data.kind === 'circle') return { w: CIRCLE_D, h: CIRCLE_D }
  if (n.data.kind === 'startstop') {
    return { w: START_W, h: START_H }
  }
  if (n.data.kind === 'triangle') {
    return { w: TRI_W, h: TRI_H }
  }
  if (n.data.kind === 'frame') {
    return { w: n.data.frameW ?? 360, h: n.data.frameH ?? 220 }
  }
  return { w: 0, h: 0 }
}

function overlapRatio(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
  const len = Math.min(aEnd - aStart, bEnd - bStart)
  if (len <= 0) return 0
  return overlap / len
}

 

function sanitizeNodes(nodes: Node<PfdData>[]): Node<PfdData>[] {
  return nodes.map((n) => {
    if (n.data.kind === 'frame') {
      return {
        ...n,
        selected: false,
        draggable: true,
        selectable: true,
        connectable: false,
        dragHandle: '.frame-drag-handle',
        style: { ...(n.style ?? {}), zIndex: -1, pointerEvents: 'none' as const },
      }
    }
    return { ...n, selected: false }
  })
}

function sanitizeEdges(edges: Edge[]) {
  return edges.map((e) => {
    if (!e.data || typeof e.data !== 'object') {
      return { ...e, selected: false }
    }

    const raw = e.data as Record<string, unknown>
    const routeV = raw.routeV
    const keepCenter = routeV === 2

    const nextData: Record<string, unknown> = { ...raw }
    delete nextData.cpX
    delete nextData.cpY
    if (!keepCenter) {
      delete nextData.centerX
      delete nextData.centerY
    }

    return { ...e, data: nextData, selected: false }
  })
}

/* ===================== Symbol Palette (miniaturki) ===================== */

function PaletteButton({
  title,
  subtitle,
  onClick,
  disabled,
  children,
}: {
  title: string
  subtitle?: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: 8,
        borderRadius: SURFACE_RADIUS,
        border: `1px solid ${SURFACE_BORDER}`,
        background: disabled ? 'rgba(255,255,255,0.05)' : SURFACE_BG_STRONG,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 18px 40px rgba(0,0,0,0.18)',
        transition: 'transform .10s ease, box-shadow .15s ease, border-color .15s ease',
        fontFamily: UI_FONT,
      }}
    >
      <div
        style={{
          width: 51,
          height: 41,
          borderRadius: SURFACE_RADIUS,
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {children}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: SURFACE_TEXT, lineHeight: 1.02 }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 10, color: SURFACE_MUTED, fontWeight: 600 }}>{subtitle}</div> : null}
      </div>
    </button>
  )
}

function PfdPageFallback() {
  return (
    <div style={{ padding: 24, color: '#666', fontSize: 14, fontWeight: 700 }}>
      Loading PFD...
    </div>
  )
}

function ThumbOperation() {
  // mini prostokąt jak operation
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <rect
        x="4"
        y="4"
        width="38"
        height="26"
        rx="6"
        fill="rgba(232,243,237,0.96)"
        stroke="rgba(107,145,125,0.42)"
        strokeWidth="1.2"
      />
    </svg>
  )
}

function ThumbDecision() {
  // mini romb (bez zaokrągleń w mini)
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <path
        d="M23 2 L44 17 L23 32 L2 17 Z"
        fill="rgba(232,243,237,0.96)"
        stroke="rgba(107,145,125,0.42)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ThumbCircle() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <circle cx="23" cy="17" r="13" fill="rgba(232,243,237,0.96)" stroke="rgba(107,145,125,0.42)" strokeWidth="1.2" />
    </svg>
  )
}

function ThumbFrame() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <rect x="4" y="4" width="38" height="26" fill="transparent" stroke="rgba(107,145,125,0.42)" strokeWidth="1.2" strokeDasharray="4 3" />
    </svg>
  )
}

function ThumbStartStop() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <rect
        x="4"
        y="8"
        width="38"
        height="18"
        rx="9"
        fill="rgba(232,243,237,0.96)"
        stroke="rgba(107,145,125,0.42)"
        strokeWidth="1.2"
      />
    </svg>
  )
}

function ThumbTriangle() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <path d="M23 5 L40 29 L6 29 Z" fill="rgba(232,243,237,0.96)" stroke="rgba(107,145,125,0.42)" strokeWidth="1.2" />
    </svg>
  )
}

function ThumbSubProcess() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <rect x="4" y="4" width="38" height="26" rx="6" fill="rgba(232,243,237,0.96)" stroke="rgba(107,145,125,0.42)" strokeWidth="1.2" />
      <line x1="11" y1="4" x2="11" y2="30" stroke="rgba(107,145,125,0.42)" strokeWidth="1.4" />
      <line x1="35" y1="4" x2="35" y2="30" stroke="rgba(107,145,125,0.42)" strokeWidth="1.4" />
    </svg>
  )
}

const edgeTypes = { smoothedit: OrthEdge }

/* ===================== PAGE ===================== */

export default function Page() {
  return (
    <Suspense fallback={<PfdPageFallback />}>
      <PfdPageContent />
    </Suspense>
  )
}

function PfdPageContent() {
  const sp = useSearchParams()
  const projectId = sp.get('project') ?? ''

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [nodes, setNodes, onNodesChangeRaw] = useNodesState<PfdData>([])
  const [edges, setEdges, onEdgesChangeRaw] = useEdgesState<Edge>([])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [zoomPct, setZoomPct] = useState(100)
  const viewportRef = useRef({ x: 0, y: 0, zoom: 1 })
  const flowWrapRef = useRef<HTMLDivElement | null>(null)

  const getFlowCenter = useCallback(() => {
    const el = flowWrapRef.current
    const vp = viewportRef.current
    const zoom = vp.zoom || 1
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return {
      x: (rect.width / 2 - vp.x) / zoom,
      y: (rect.height / 2 - vp.y) / zoom,
    }
  }, [])
  

  const [pfmeaOpenOperationId, setPfmeaOpenOperationId] = useState<string | null>(null)
  const [pfmeaMiniRows, setPfmeaMiniRows] = useState<PfmeaMiniRow[]>([])
  const [edit, setEdit] = useState<{ rowId: string; col: ColKey } | null>(null)
  const editRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const stopEdit = useCallback(() => setEdit(null), [])

  const rfRef = useRef<ReactFlowInstance | null>(null)
  const recentConnectKeys = useRef<Map<string, number>>(new Map())
  const triggerCenterView = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rfRef.current?.fitView?.({ padding: 0.28, duration: 220, includeHiddenNodes: true, maxZoom: ZOOM_BASE * 3 })
      })
    })
  }, [])

  const [lassoEnabled, setLassoEnabled] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveDesc, setSaveDesc] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<PfdHistoryEntry[]>([])
  const [historyAuthor, setHistoryAuthor] = useState('Unknown user')
  const [currentRevisionLabel, setCurrentRevisionLabel] = useState('0.0.0')
  const [processOptions, setProcessOptions] = useState<string[]>([])
  const [organizationName, setOrganizationName] = useState('Unknown organization')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isChampion, setIsChampion] = useState(false)
  const [editSession, setEditSession] = useState<PfdEditSession | null>(null)
  const [sessionMsg, setSessionMsg] = useState('')
  const [sessionBusy, setSessionBusy] = useState(false)
  const [sessionNow, setSessionNow] = useState(() => Date.now())
  const draftLoadedFor = useRef<string>('')
  const [confirmDialog, setConfirmDialog] = useState<null | {
    title: string
    body: string
    dangerNote?: string
    onConfirm: () => Promise<boolean | void> | boolean | void
  }>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [decisionConnectDialog, setDecisionConnectDialog] = useState<null | {
    params: Connection
    key: string
    value: string
  }>(null)

  const canWork = !!projectId
  const revisionAuthor = historyEntries[0]?.author ?? 'Unknown user'
  const sessionExpired = useMemo(() => {
    if (!editSession) return false
    const last = new Date(editSession.lastActivityAt).getTime()
    if (!Number.isFinite(last)) return true
    return Date.now() - last >= EDIT_LOCK_MS
  }, [editSession])
  const isEditOwner = !!currentUserId && !!editSession && editSession.lockedBy === currentUserId && !sessionExpired
  const isLockedByOther = !!editSession && !isEditOwner && !sessionExpired
  const isReadOnly = !isEditOwner
  const lockRemainingText = useMemo(() => {
    if (!editSession || !isLockedByOther) return ''
    const last = new Date(editSession.lastActivityAt).getTime()
    const left = Math.max(0, EDIT_LOCK_MS - (sessionNow - last))
    const h = Math.floor(left / 3_600_000)
    const m = Math.floor((left % 3_600_000) / 60_000)
    return `${h}h ${m}m`
  }, [editSession, isLockedByOther, sessionNow])

  const loadHistoryAuthor = useCallback(async () => {
    try {
      const authRes = await supabase.auth.getUser()
      const u = authRes.data.user
      if (!u) return

      const profRes = await supabase
        .from('profiles')
        .select('first_name,last_name')
        .eq('id', u.id)
        .maybeSingle()

      const prof = (profRes.data ?? null) as { first_name?: string | null; last_name?: string | null } | null
      const profFirst = prof?.first_name
      const profLast = prof?.last_name
      const profileFull = `${(profFirst ?? '').trim()} ${(profLast ?? '').trim()}`.trim()
      if (profileFull) {
        setHistoryAuthor(profileFull)
        return
      }

      const metaFirst = (u.user_metadata?.first_name as string | undefined) ?? ''
      const metaLast = (u.user_metadata?.last_name as string | undefined) ?? ''
      const metaFull = `${metaFirst.trim()} ${metaLast.trim()}`.trim()
      if (metaFull) {
        setHistoryAuthor(metaFull)
        return
      }

      setHistoryAuthor('Unknown user')
    } catch {}
  }, [])

  const loadUserContext = useCallback(async () => {
    if (!projectId) return
    try {
      const authRes = await supabase.auth.getUser()
      const u = authRes.data.user
      if (!u) {
        setCurrentUserId(null)
        setHistoryAuthor('Unknown user')
        setIsChampion(false)
        return
      }
      setCurrentUserId(u.id)

      const profRes = await supabase
        .from('profiles')
        .select('first_name,last_name')
        .eq('id', u.id)
        .maybeSingle()
      const prof = (profRes.data ?? null) as { first_name?: string | null; last_name?: string | null } | null
      const profileFull = `${(prof?.first_name ?? '').trim()} ${(prof?.last_name ?? '').trim()}`.trim()
      if (profileFull) setHistoryAuthor(profileFull)

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
        .eq('user_id', u.id)
        .maybeSingle()
      const role = ((memberRes.data as { role?: string | null } | null)?.role ?? '').toLowerCase()
      setIsChampion(role === 'champion' || role === 'admin')
    } catch {}
  }, [projectId])

  const loadEditSession = useCallback(async () => {
    if (!projectId) {
      setEditSession(null)
      return
    }
    try {
      const res = await supabase
        .from('pfd_edit_sessions')
        .select('project_id,locked_by,started_at,last_activity_at')
        .eq('project_id', projectId)
        .maybeSingle()
      if (res.error || !res.data) {
        setEditSession(null)
        return
      }
      const row = res.data as {
        project_id?: string | null
        locked_by?: string | null
        started_at?: string | null
        last_activity_at?: string | null
      }
      if (!row.locked_by) {
        setEditSession(null)
        return
      }
      let lockedByName = 'Unknown user'
      const profRes = await supabase
        .from('profiles')
        .select('first_name,last_name')
        .eq('id', row.locked_by)
        .maybeSingle()
      if (!profRes.error && profRes.data) {
        const p = profRes.data as { first_name?: string | null; last_name?: string | null }
        const full = `${(p.first_name ?? '').trim()} ${(p.last_name ?? '').trim()}`.trim()
        if (full) lockedByName = full
      }
      setEditSession({
        projectId: row.project_id ?? projectId,
        lockedBy: row.locked_by,
        startedAt: row.started_at ?? new Date().toISOString(),
        lastActivityAt: row.last_activity_at ?? row.started_at ?? new Date().toISOString(),
        lockedByName,
      })
    } catch {
      setEditSession(null)
    }
  }, [projectId])

  const loadSessionNotice = useCallback(async () => {
    if (!projectId || !currentUserId) return
    try {
      const res = await supabase
        .from('pfd_session_events')
        .select('id,message')
        .eq('project_id', projectId)
        .eq('user_id', currentUserId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (res.error || !res.data) return
      const event = res.data as { id: string; message?: string | null }
      setSessionMsg((event.message ?? '').trim() || 'Your draft session is no longer available.')
      await supabase.from('pfd_session_events').update({ read_at: new Date().toISOString() }).eq('id', event.id)
    } catch {}
  }, [projectId, currentUserId])

  const loadRevisionLabel = useCallback(async () => {
    if (!projectId) {
      setCurrentRevisionLabel('0.0.0')
      return
    }
    try {
      const res = await supabase
        .from('projects_with_revision')
        .select('open_revision_label,draft_revision_label')
        .eq('id', projectId)
        .maybeSingle()
      if (res.error) return
      const row = (res.data ?? null) as { open_revision_label?: string | null; draft_revision_label?: string | null } | null
      const label = (row?.draft_revision_label ?? row?.open_revision_label ?? '0.0.0').toString()
      setCurrentRevisionLabel(label || '0.0.0')
    } catch {}
  }, [projectId])

  const loadOrganizationName = useCallback(async () => {
    if (!projectId) {
      setOrganizationName('Unknown organization')
      return
    }
    try {
      const projRes = await supabase.from('projects').select('organization_id').eq('id', projectId).maybeSingle()
      const orgId = (projRes.data as { organization_id?: string | null } | null)?.organization_id ?? null
      if (!orgId) {
        setOrganizationName('Unknown organization')
        return
      }
      const orgRes = await supabase.from('organizations').select('name').eq('id', orgId).maybeSingle()
      const name = ((orgRes.data as { name?: string | null } | null)?.name ?? '').trim()
      setOrganizationName(name || 'Unknown organization')
    } catch {
      setOrganizationName('Unknown organization')
    }
  }, [projectId])

  const loadProcessOptions = useCallback(async () => {
    if (!projectId) {
      setProcessOptions([])
      return
    }
    try {
      const projectRes = await supabase
        .from('projects')
        .select('organization_id,site_department_id,name')
        .eq('id', projectId)
        .maybeSingle()
      const projectRow = (projectRes.data as { organization_id?: string | null; site_department_id?: string | null; name?: string | null } | null) ?? null
      const organizationId = projectRow?.organization_id ?? null
      const siteDepartmentId = projectRow?.site_department_id ?? null
      if (!organizationId) {
        setProcessOptions([])
        return
      }

      let query = supabase
        .from('projects')
        .select('name')
        .eq('organization_id', organizationId)
        .not('name', 'is', null)
        .order('name', { ascending: true })

      if (siteDepartmentId) query = query.eq('site_department_id', siteDepartmentId)

      const optionsRes = await query
      if (optionsRes.error) {
        setProcessOptions([])
        return
      }

      const values = Array.from(
        new Set(
          ((optionsRes.data ?? []) as ProjectProcessOptionRow[])
            .map((row) => (row.name ?? '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b))

      setProcessOptions(values)
    } catch {
      setProcessOptions([])
    }
  }, [projectId])

  const loadHistory = useCallback(async () => {
    if (!projectId) {
      setHistoryEntries([])
      return
    }
    try {
      const dbRes = await supabase
        .from('pfd_change_history')
        .select('id,created_at,revision_label,change_description,author_name,node_count,edge_count')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (!dbRes.error && (dbRes.data?.length ?? 0) > 0) {
        const rows = (dbRes.data ?? []) as Array<{
          id?: string | null
          created_at?: string | null
          revision_label?: string | null
          change_description?: string | null
          author_name?: string | null
          node_count?: number | null
          edge_count?: number | null
        }>
        const normalized: PfdHistoryEntry[] = rows.map((x, idx) => {
          const revisionLabel = (x.revision_label ?? '').toString() || '0.0.0'
          const revision = Number.parseInt(revisionLabel.split('.')[0] ?? '', 10)
          return {
            id: x.id ?? `pfd-h-db-${idx}`,
            at: x.created_at ?? new Date(0).toISOString(),
            revision: Number.isFinite(revision) ? revision : 0,
            revisionLabel,
            author: (x.author_name ?? '').trim() || 'Unknown user',
            description: x.change_description ?? '',
            nodeCount: Number.isFinite(x.node_count) ? Number(x.node_count) : 0,
            edgeCount: Number.isFinite(x.edge_count) ? Number(x.edge_count) : 0,
          }
        })
        setHistoryEntries(normalized)
        return
      }

      const fallbackRes = await supabase
        .from('process_module_revisions')
        .select('id,created_at,change_description,revision_label')
        .eq('project_id', projectId)
        .eq('module', 'PFD')
        .order('created_at', { ascending: false })
        .limit(200)
      if (fallbackRes.error) {
        setHistoryEntries([])
        return
      }
      const fallbackRows = (fallbackRes.data ?? []) as Array<{
        id?: string | null
        created_at?: string | null
        change_description?: string | null
        revision_label?: string | null
      }>
      setHistoryEntries(
        fallbackRows.map((x, idx) => {
          const revisionLabel = (x.revision_label ?? '').toString() || '0.0.0'
          const revision = Number.parseInt(revisionLabel.split('.')[0] ?? '', 10)
          return {
            id: x.id ?? `pfd-h-fb-${idx}`,
            at: x.created_at ?? new Date(0).toISOString(),
            revision: Number.isFinite(revision) ? revision : 0,
            revisionLabel,
            author: 'Unknown user',
            description: x.change_description ?? '',
            nodeCount: 0,
            edgeCount: 0,
          }
        })
      )
    } catch {
      setHistoryEntries([])
    }
  }, [projectId])

  const savePfdWithDescription = useCallback(async () => {
    if (!projectId || !currentUserId || !isEditOwner) return
    const description = saveDesc.trim()
    if (!description) return
    setSaveBusy(true)
    setErr('')
    try {
      const payload = {
        project_id: projectId,
        nodes,
        edges,
        updated_at: new Date().toISOString(),
      }
      const res = await supabase.from('pfd_diagrams').upsert([payload], { onConflict: 'project_id' })
      if (res.error) throw new Error(res.error.message)
      const pubRes = await supabase.rpc('publish_process_module_revision', {
        p_project_id: projectId,
        p_module: 'PFD',
        p_change_description: description,
        p_user_id: currentUserId,
      })
      if (pubRes.error) throw new Error(pubRes.error.message)

      const revRes = await supabase
        .from('process_module_revisions')
        .select('revision_label')
        .eq('project_id', projectId)
        .eq('module', 'PFD')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const revRow = (revRes.data ?? null) as { revision_label?: string | null } | null
      const revisionLabel = (revRow?.revision_label ?? '0.0.0').toString()
      await supabase.from('pfd_change_history').insert([
        {
          project_id: projectId,
          revision_label: revisionLabel || '0.0.0',
          change_description: description,
          author_id: currentUserId,
          author_name: historyAuthor || 'Unknown user',
          node_count: nodes.length,
          edge_count: edges.length,
          created_at: new Date().toISOString(),
        },
      ])

      await supabase.from('pfd_drafts').delete().eq('project_id', projectId).eq('user_id', currentUserId)
      await supabase.from('pfd_edit_sessions').delete().eq('project_id', projectId).eq('locked_by', currentUserId)

      await loadRevisionLabel()
      await loadHistory()
      await loadEditSession()
      setSaveDialogOpen(false)
      setSaveDesc('')
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSaveBusy(false)
    }
  }, [projectId, currentUserId, isEditOwner, saveDesc, nodes, edges, loadHistory, loadRevisionLabel, loadEditSession, historyAuthor])

  const startEditSession = useCallback(async () => {
    if (!projectId || !currentUserId) return
    setSessionBusy(true)
    setErr('')
    setSessionMsg('')
    try {
      const nowIso = new Date().toISOString()
      const res = await supabase
        .from('pfd_edit_sessions')
        .select('project_id,locked_by,last_activity_at')
        .eq('project_id', projectId)
        .maybeSingle()
      const row = (res.data ?? null) as { locked_by?: string | null; last_activity_at?: string | null } | null
      const otherOwner = row?.locked_by ?? null
      const last = row?.last_activity_at ? new Date(row.last_activity_at).getTime() : 0
      const hasActiveOther = !!otherOwner && otherOwner !== currentUserId && Date.now() - last < EDIT_LOCK_MS
      if (hasActiveOther) {
        setErr('This PFD is currently locked by another user.')
        return
      }

      if (otherOwner && otherOwner !== currentUserId) {
        await supabase.from('pfd_drafts').delete().eq('project_id', projectId).neq('user_id', currentUserId)
        const reason = Date.now() - last >= EDIT_LOCK_MS ? '48h inactivity timeout' : 'session takeover'
        await supabase.from('pfd_session_events').insert([
          {
            project_id: projectId,
            user_id: otherOwner,
            message: `Your PFD draft session was taken over by another user (${reason}).`,
          },
        ])
      }

      const upsertRes = await supabase.from('pfd_edit_sessions').upsert(
        [
          {
            project_id: projectId,
            locked_by: currentUserId,
            started_at: nowIso,
            last_activity_at: nowIso,
            updated_at: nowIso,
          },
        ],
        { onConflict: 'project_id' }
      )
      if (upsertRes.error) throw new Error(upsertRes.error.message)

      const ownDraftRes = await supabase
        .from('pfd_drafts')
        .select('project_id')
        .eq('project_id', projectId)
        .eq('user_id', currentUserId)
        .maybeSingle()
      if (!ownDraftRes.data) {
        await supabase.from('pfd_drafts').upsert(
          [
            {
              project_id: projectId,
              user_id: currentUserId,
              nodes,
              edges,
              updated_at: nowIso,
            },
          ],
          { onConflict: 'project_id,user_id' }
        )
      }

      await loadEditSession()
      draftLoadedFor.current = ''
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSessionBusy(false)
    }
  }, [projectId, currentUserId, nodes, edges, loadEditSession])

  const forceUnlockSession = useCallback(async () => {
    if (!projectId || !editSession || !isChampion) return
    setSessionBusy(true)
    setErr('')
    setSessionMsg('')
    try {
      if (editSession.lockedBy) {
        await supabase.from('pfd_session_events').insert([
          {
            project_id: projectId,
            user_id: editSession.lockedBy,
            message: 'Your PFD draft session was closed by Champion.',
          },
        ])
      }
      await supabase.from('pfd_drafts').delete().eq('project_id', projectId).eq('user_id', editSession.lockedBy)
      await supabase.from('pfd_edit_sessions').delete().eq('project_id', projectId)
      await loadEditSession()
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSessionBusy(false)
    }
  }, [projectId, editSession, isChampion, loadEditSession])

  const loadAll = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setErr('')

    const diagRes = await supabase
      .from('pfd_diagrams')
      .select('project_id,nodes,edges')
      .eq('project_id', projectId)
      .maybeSingle()

    if (diagRes.error) {
      setErr(diagRes.error.message)
      setLoading(false)
      return
    }

    const opsRes = await supabase
      .from('operations')
      .select('id,project_id,operation_number,name,machine,operation,active')
      .eq('project_id', projectId)
      .eq('active', true)
      .order('operation_number', { ascending: true })

    if (opsRes.error) {
      setErr(opsRes.error.message)
      setLoading(false)
      return
    }

    const ops = (opsRes.data ?? []) as OperationRow[]

    const d = diagRes.data as any
    if (d?.nodes && d?.edges) {
      const cleanNodes = sanitizeNodes(d.nodes as Node<PfdData>[])
      const nodeIds = new Set(cleanNodes.map((n) => n.id))
      setNodes(cleanNodes)
      setEdges(sanitizeEdges(d.edges as Edge[]).filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)))
      setLoading(false)
      triggerCenterView()
      return
    }

    if (ops.length === 0) {
      const ins = await supabase
        .from('operations')
        .insert([{ project_id: projectId, operation_number: 10, name: '', machine: '', operation: '', active: true }])
        .select('id,project_id,operation_number,name,machine,operation,active')
        .single()

      if (ins.error) {
        setErr(ins.error.message)
        setLoading(false)
        return
      }
      ops.push(ins.data as any)
    }

    const startNodes: Node<PfdData>[] = ops.map((o, idx) => ({
      id: o.id,
      type: 'operation',
      position: { x: OPS_X, y: OPS_Y0 + idx * OPS_GAP },
      data: {
        kind: 'operation',
        name: o.name ?? '',
        opNo: o.operation_number ?? 0,
        station: o.machine ?? '',
        operation: o.operation ?? '',
      },
    }))

    setNodes(sanitizeNodes(startNodes))
    setEdges([])
    setLoading(false)
    triggerCenterView()
  }, [projectId, setEdges, setNodes, triggerCenterView])

  const discardDraftAndCloseSession = useCallback(async () => {
    if (!projectId || !currentUserId || !isEditOwner) return
    setSessionBusy(true)
    setErr('')
    try {
      await supabase.from('pfd_drafts').delete().eq('project_id', projectId).eq('user_id', currentUserId)
      await supabase.from('pfd_edit_sessions').delete().eq('project_id', projectId).eq('locked_by', currentUserId)
      draftLoadedFor.current = ''
      await loadEditSession()
      await loadAll()
      setSessionMsg('Draft discarded. Session closed without publishing.')
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSessionBusy(false)
    }
  }, [projectId, currentUserId, isEditOwner, loadEditSession, loadAll])

  useEffect(() => {
    if (!projectId) return
    loadAll()
  }, [projectId, loadAll])

  useEffect(() => {
    if (!projectId) return
    void loadUserContext()
    void loadEditSession()
  }, [projectId, loadUserContext, loadEditSession])

  useEffect(() => {
    if (!projectId) return
    const timer = setInterval(() => {
      void loadEditSession()
    }, 30_000)
    return () => clearInterval(timer)
  }, [projectId, loadEditSession])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    loadHistoryAuthor()
  }, [loadHistoryAuthor])

  useEffect(() => {
    void loadRevisionLabel()
  }, [loadRevisionLabel])

  useEffect(() => {
    void loadOrganizationName()
  }, [loadOrganizationName])

  useEffect(() => {
    void loadProcessOptions()
  }, [loadProcessOptions])

  useEffect(() => {
    void loadSessionNotice()
  }, [loadSessionNotice])

  useEffect(() => {
    if (!projectId || !currentUserId || !isEditOwner || !nodes.length) return
    const key = `${projectId}:${currentUserId}:${editSession?.startedAt ?? ''}`
    if (draftLoadedFor.current === key) return
    draftLoadedFor.current = key
    void (async () => {
      const res = await supabase
        .from('pfd_drafts')
        .select('nodes,edges')
        .eq('project_id', projectId)
        .eq('user_id', currentUserId)
        .maybeSingle()
      if (res.error || !res.data) return
      const d = res.data as { nodes?: Node<PfdData>[]; edges?: Edge[] }
      if (!d.nodes || !d.edges) return
      const cleanNodes = sanitizeNodes(d.nodes as Node<PfdData>[])
      const nodeIds = new Set(cleanNodes.map((n) => n.id))
      setNodes(cleanNodes)
      setEdges(sanitizeEdges(d.edges as Edge[]).filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)))
      triggerCenterView()
    })()
  }, [projectId, currentUserId, isEditOwner, editSession?.startedAt, nodes.length, setEdges, setNodes, triggerCenterView])

  const prevOwnerRef = useRef(false)
  useEffect(() => {
    if (prevOwnerRef.current && !isEditOwner) {
      draftLoadedFor.current = ''
      void loadAll()
    }
    prevOwnerRef.current = isEditOwner
  }, [isEditOwner, loadAll])

  useEffect(() => {
    if (!projectId || !currentUserId || !isEditOwner) return
    const timer = setInterval(async () => {
      const nowIso = new Date().toISOString()
      await supabase
        .from('pfd_edit_sessions')
        .update({ last_activity_at: nowIso, updated_at: nowIso })
        .eq('project_id', projectId)
        .eq('locked_by', currentUserId)
    }, 60_000)
    return () => clearInterval(timer)
  }, [projectId, currentUserId, isEditOwner])

  useEffect(() => {
    const timer = setInterval(() => setSessionNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const saveTimer = useRef<any>(null)
  const scheduleSaveDiagram = useCallback(
    (nextNodes: Node<PfdData>[], nextEdges: Edge[]) => {
      if (!projectId || !currentUserId || !isEditOwner) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        const nowIso = new Date().toISOString()
        await supabase.from('pfd_drafts').upsert(
          [
            {
              project_id: projectId,
              user_id: currentUserId,
              nodes: nextNodes,
              edges: nextEdges,
              updated_at: nowIso,
            },
          ],
          { onConflict: 'project_id,user_id' }
        )
        await supabase
          .from('pfd_edit_sessions')
          .update({ last_activity_at: nowIso, updated_at: nowIso })
          .eq('project_id', projectId)
          .eq('locked_by', currentUserId)
      }, 450)
    },
    [projectId, currentUserId, isEditOwner]
  )

  useEffect(() => {
    if (!projectId || !isEditOwner) return
    scheduleSaveDiagram(nodes, edges)
  }, [nodes, edges, projectId, isEditOwner, scheduleSaveDiagram])

  const patchOperation = useCallback(
    async (operationId: string, patch: Partial<PfdData>) => {
      if (!isEditOwner) return
      setNodes((nds) => nds.map((n) => (n.id === operationId ? { ...n, data: { ...n.data, ...patch } } : n)))

      const upd: Partial<OperationRow> = {}
      if (typeof patch.opNo === 'number') upd.operation_number = patch.opNo
      if (typeof patch.name === 'string') upd.name = patch.name
      if (typeof patch.station === 'string') upd.machine = patch.station
      if (typeof patch.operation === 'string') upd.operation = patch.operation

      const res = await supabase.from('operations').update(upd).eq('id', operationId)
      if (res.error) setErr(res.error.message)
    },
    [setNodes, isEditOwner]
  )

  const patchFrame = useCallback((frameId: string, patch: Partial<PfdData>) => {
    if (!isEditOwner) return
    setNodes((nds) => nds.map((n) => (n.id === frameId ? { ...n, data: { ...n.data, ...patch } } : n)))
  }, [isEditOwner])

  const openPfmeaFor = useCallback(
    async (operationId: string) => {
      setPfmeaOpenOperationId(operationId)
      setSelectedNodeId(operationId)
      setSelectedEdgeId(null)
      stopEdit()

      const res = await supabase
        .from('pfmea_rows')
        .select('id,operation_id,failure_mode,effect,cause,severity,occurrence,detection,rpn,oxd,created_at')
        .eq('operation_id', operationId)
        .order('created_at', { ascending: true })

      if (res.error) {
        setErr(res.error.message)
        setPfmeaMiniRows([])
        return
      }
      setPfmeaMiniRows((res.data ?? []) as PfmeaMiniRow[])
    },
    [stopEdit]
  )

  useEffect(() => {
    if (!pfmeaOpenOperationId) return
    const inst = rfRef.current
    const n = nodes.find((x) => x.id === pfmeaOpenOperationId)
    if (!inst || !n) return

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const zoom = inst.getZoom()
        inst.setCenter(n.position.x + OP_WIDTH / 2, n.position.y + OP_HEIGHT / 2, { zoom, duration: 250 })
      })
    })
  }, [pfmeaOpenOperationId, nodes])

        const selectedIsOperation = useMemo(() => {
         if (!selectedNodeId) return false
         return nodes.find((n) => n.id === selectedNodeId)?.data.kind === 'operation'
          }, [nodes, selectedNodeId])


  

  const nodesWithHandlers = useMemo(() => {
    const mapped: Node<PfdData>[] = nodes.map((n) => {
      if (n.data.kind === 'operation') {
        return { ...n, data: { ...n.data, editable: isEditOwner, onOpenPfmea: openPfmeaFor, onPatch: patchOperation } }
      }
      if (n.data.kind === 'processref') {
        return { ...n, data: { ...n.data, editable: isEditOwner, onPatch: patchFrame, processOptions } }
      }
      if (n.data.kind === 'frame') {
        return {
          ...n,
          draggable: true,
          selectable: true,
          connectable: false,
          dragHandle: '.frame-drag-handle',
          style: { ...(n.style ?? {}), zIndex: -1, pointerEvents: 'none' as const },
          data: { ...n.data, editable: isEditOwner, onPatch: patchFrame },
        }
      }
      if (n.data.kind === 'circle' || n.data.kind === 'decision' || n.data.kind === 'startstop' || n.data.kind === 'triangle') {
        return { ...n, data: { ...n.data, editable: isEditOwner, onPatch: patchFrame } }
      }
      return n
    })
    return mapped.sort((a, b) => (a.data.kind === 'frame' ? -1 : b.data.kind === 'frame' ? 1 : 0))
  }, [nodes, openPfmeaFor, patchFrame, patchOperation, isEditOwner, processOptions])

  const selectedOperationLabel = useMemo(() => {
    if (!pfmeaOpenOperationId) return ''
    const n = nodes.find((x) => x.id === pfmeaOpenOperationId)
    if (!n) return pfmeaOpenOperationId
    const step = (n.data.name || '—').replace(/\s+/g, ' ').trim()
    return `${n.data.opNo ?? ''} – ${step} | Station: ${n.data.station || '—'} | Operation: ${n.data.operation || '—'}`
  }, [nodes, pfmeaOpenOperationId])

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothedit' as const,
      pathOptions: { borderRadius: Math.max(8, Math.round(14 * S)), offset: Math.round(15 * S) },
      markerEnd: EDGE_MARKER,
      style: { strokeWidth: 1 * S, stroke: '#dbe7f5' },
      labelStyle: { fontWeight: 600, fontSize: 14 * S, fill: '#444', fontFamily: UI_FONT },
      labelBgStyle: { fill: 'white' },
      labelBgPadding: [6 * S, 4 * S] as any,
      labelBgBorderRadius: 6 * S,
    }),
    []
  )

  const edgesStyled = useMemo(() => {
    return edges.map((e) => {
      const isSel = e.id === selectedEdgeId || !!e.selected

      return {
        ...e,
        type: 'smoothedit',
        pathOptions: { borderRadius: Math.max(8, Math.round(14 * S)), offset: Math.round(15 * S) },
        markerEnd: EDGE_MARKER,
        style: {
          ...(e.style ?? {}),
          stroke: isSel ? '#f8fbff' : '#dbe7f5',
          strokeWidth: isSel ? 2 * S : 1 * S,
          filter: isSel ? `drop-shadow(0px 8px 18px rgba(219,231,245,0.28))` : undefined,
        },
        data: { ...(e.data ?? {}), editable: isEditOwner },
        labelStyle: { ...(e.labelStyle ?? {}), fontFamily: UI_FONT, fontWeight: 700 },
      }
    })
  }, [edges, isEditOwner, selectedEdgeId])

  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node<PfdData>[]; edges: Edge[] }) => {
      if (!isEditOwner || !lassoEnabled) return

      const selectedNodeIds = new Set(selNodes.map((n) => n.id))
      const selectedEdgeIds = new Set(selEdges.map((e) => e.id))

      setEdges((eds) => {
        let changed = false
        const next = eds.map((e) => {
          const shouldSelect =
            selectedEdgeIds.has(e.id) ||
            (selectedNodeIds.size > 0 && selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target))
          if (!!e.selected === shouldSelect) return e
          changed = true
          return { ...e, selected: shouldSelect }
        })
        return changed ? next : eds
      })
    },
    [isEditOwner, lassoEnabled, setEdges]
  )

  const onEdgeUpdateEnd = useCallback(
  (_e: any, edge: Edge) => {
    // jeśli po update edge nie ma source/target → usuń
    if (!edge.source || !edge.target) {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id))
    }
  },
  [setEdges]
)


  const onEdgeUpdate = useCallback(
  (oldEdge: Edge, newConnection: Connection) => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === oldEdge.id
          ? {
              ...e,
              source: newConnection.source ?? e.source,
              sourceHandle: newConnection.sourceHandle ?? e.sourceHandle,
              target: newConnection.target ?? e.target,
              targetHandle: newConnection.targetHandle ?? e.targetHandle,
            }
          : e
      )
    )
  },
  [setEdges]
)



  const commitConnection = useCallback(
    (params: Connection, key: string, label?: string) => {
      if (!isEditOwner) return
      if (!params.source || !params.target) return
      const source = params.source
      const target = params.target
      const now = Date.now()
      for (const [k, t] of recentConnectKeys.current.entries()) {
        if (now - t > 10000) recentConnectKeys.current.delete(k)
      }
      if (recentConnectKeys.current.has(key)) return
      recentConnectKeys.current.set(key, now)

      setEdges((eds) => {
        const edge: Edge = {
          ...params,
          source,
          target,
          id: `e-${source}-${params.sourceHandle ?? 's'}-${target}-${params.targetHandle ?? 't'}-${Date.now()}`,
          type: 'smoothedit',
          pathOptions: { borderRadius: Math.max(8, Math.round(14 * S)), offset: Math.round(15 * S) },
          label,
          markerEnd: EDGE_MARKER,
          style: { strokeWidth: 1 * S, stroke: '#dbe7f5' },
        }
        return addEdge(edge, eds)
      })
    },
    [setEdges, isEditOwner]
  )

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      if (!isEditOwner) return
      const key = `${params.source}|${params.sourceHandle}|${params.target}|${params.targetHandle}`
      const sourceNode = nodes.find((n) => n.id === params.source)
      const isDecisionSource = sourceNode?.data.kind === 'decision'

      if (isDecisionSource) {
        setDecisionConnectDialog({ params, key, value: '' })
        return
      }

      commitConnection(params, key)
    },
    [commitConnection, nodes, isEditOwner]
  )

  const addOperationAtEnd = useCallback(async () => {
    if (!projectId || !isEditOwner) return
    setErr('')

    const opsSorted = sortOpsByNumber(nodes.filter(isOperation))
    const last = opsSorted.at(-1) ?? null
    const anchor = findLinearTail(nodes, edges) ?? last

    const opNos = opsSorted.map((n) => n.data.opNo ?? 0)
    const newOpNo = findSmallestFree10(opNos)

    const prevStation = last?.data.station ?? ''
    const prevOperation = last?.data.operation ?? ''

    const ins = await supabase
      .from('operations')
      .insert([
        {
          project_id: projectId,
          operation_number: newOpNo,
          name: '',
          machine: prevStation,
          operation: prevOperation,
          active: true,
        },
      ])
      .select('id')
      .single()

    if (ins.error) {
      setErr(ins.error.message)
      return
    }

    const newId = ins.data.id as string
    const x = anchor ? anchor.position.x : OPS_X
    const y = anchor ? anchor.position.y + OPS_GAP : OPS_Y0

    const newNode: Node<PfdData> = {
      id: newId,
      type: 'operation',
      position: { x, y },
      data: { kind: 'operation', name: '', opNo: newOpNo, station: prevStation, operation: prevOperation },
    }

    setNodes((nds) => [...nds, newNode])

    if (anchor) {
      const newEdge: Edge = {
        id: `e-${anchor.id}-bottom-${newId}-top-${Date.now()}`,
        source: anchor.id,
        sourceHandle: 'bottom-s',
        target: newId,
        targetHandle: 'top-t',
        type: 'smoothedit',
        pathOptions: { borderRadius: Math.max(8, Math.round(14 * S)), offset: Math.round(15 * S) },
        markerEnd: EDGE_MARKER,
        style: { strokeWidth: 1 * S, stroke: '#dbe7f5' },
      }
      setEdges((eds) => [...eds, newEdge])
    }
  }, [nodes, edges, projectId, setNodes, setEdges, isEditOwner])

  const addOperationAfterSelected = useCallback(async () => {
    if (!projectId || !isEditOwner) return
    setErr('')

    const sel = nodes.find((n) => n.id === selectedNodeId)
    if (!sel || sel.data.kind !== 'operation') return

    const opsSorted = sortOpsByNumber(nodes.filter(isOperation))
    const idx = opsSorted.findIndex((n) => n.id === sel.id)
    if (idx < 0) return

    const baseNo = sel.data.opNo ?? 0
    const insertedNo = baseNo + 10

    const after = opsSorted.slice(idx + 1)
    const next = after.length ? after[0] : null

    const renumberMap = new Map<string, number>()
    let expected = insertedNo
    for (const n of after) {
      const no = n.data.opNo ?? 0
      if (no === expected) {
        renumberMap.set(n.id, no + 10)
        expected += 10
        continue
      }
      break
    }

    if (renumberMap.size) {
      await Promise.all(
        [...renumberMap.entries()].map(([id, newNo]) =>
          supabase.from('operations').update({ operation_number: newNo }).eq('id', id)
        )
      )
    }

    setNodes((nds) =>
      nds.map((n) => {
        if (n.data.kind !== 'operation') return n
        const no = n.data.opNo ?? 0
        if (no > baseNo) {
          const bumpedNo = renumberMap.get(n.id)
          return {
            ...n,
            position: { x: n.position.x, y: n.position.y + OPS_GAP },
            data: { ...n.data, ...(bumpedNo != null ? { opNo: bumpedNo } : null) },
          }
        }
        return n
      })
    )

    const station = sel.data.station ?? ''
    const operation = sel.data.operation ?? ''

    const ins = await supabase
      .from('operations')
      .insert([
        {
          project_id: projectId,
          operation_number: insertedNo,
          name: '',
          machine: station,
          operation: operation,
          active: true,
        },
      ])
      .select('id')
      .single()

    if (ins.error) {
      setErr(ins.error.message)
      return
    }

    const newId = ins.data.id as string

    const newNode: Node<PfdData> = {
      id: newId,
      type: 'operation',
      position: { x: sel.position.x, y: sel.position.y + OPS_GAP },
      data: { kind: 'operation', name: '', opNo: insertedNo, station, operation },
    }

    setNodes((nds) => [...nds, newNode])

    setEdges((eds) => {
      const cleaned = next ? eds.filter((e) => !(e.source === sel.id && e.target === next.id)) : eds

      const e1: Edge = {
        id: `e-${sel.id}-bottom-${newId}-top-${Date.now()}`,
        source: sel.id,
        sourceHandle: 'bottom-s',
        target: newId,
        targetHandle: 'top-t',
        type: 'smoothedit',
        pathOptions: { borderRadius: Math.max(8, Math.round(14 * S)), offset: Math.round(15 * S) },
        markerEnd: EDGE_MARKER,
        style: { strokeWidth: 1 * S, stroke: '#dbe7f5' },
      }

      const e2: Edge | null = next
        ? {
            id: `e-${newId}-bottom-${next.id}-top-${Date.now() + 1}`,
            source: newId,
            sourceHandle: 'bottom-s',
            target: next.id,
            targetHandle: 'top-t',
            type: 'smoothedit',
            pathOptions: { borderRadius: Math.max(8, Math.round(14 * S)), offset: Math.round(15 * S) },
            markerEnd: EDGE_MARKER,
            style: { strokeWidth: 1 * S, stroke: '#dbe7f5' },
          }
        : null

      return e2 ? [...cleaned, e1, e2] : [...cleaned, e1]
    })
  }, [nodes, selectedNodeId, projectId, setNodes, setEdges, isEditOwner])

  const makeLocalNodeId = useCallback((prefix: string, nds: Node<PfdData>[]) => {
    let id = ''
    do {
      id = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    } while (nds.some((n) => n.id === id))
    return id
  }, [])

  const decIdCounter = useRef(0)
  const addDecisionNearSelected = useCallback(() => {
    if (!isEditOwner) return
    const center = getFlowCenter()
    setNodes((nds) => {
      decIdCounter.current += 1
      const id = makeLocalNodeId('dec', nds)
      const w = DEC_W
      const h = DEC_H
      return [
        ...nds,
        {
          id,
          type: 'decision',
          position: { x: center.x - w / 2, y: center.y - h / 2 },
          data: { kind: 'decision', name: `Decision ${decIdCounter.current}` },
        },
      ]
    })
  }, [getFlowCenter, makeLocalNodeId, setNodes, isEditOwner])

  const ssIdCounter = useRef(0)
  const addStartStopNearSelected = useCallback(() => {
    if (!isEditOwner) return
    const center = getFlowCenter()
    setNodes((nds) => {
      ssIdCounter.current += 1
      const id = makeLocalNodeId('ss', nds)
      const h = START_H
      const w = START_W
      return [
        ...nds,
        {
          id,
          type: 'startstop',
          position: { x: center.x - w / 2, y: center.y - h / 2 },
          data: { kind: 'startstop', name: ssIdCounter.current === 1 ? 'START' : `STOP ${ssIdCounter.current}` },
        },
      ]
    })
  }, [getFlowCenter, makeLocalNodeId, setNodes, isEditOwner])


  const circleIdCounter = useRef(0)
  const addCircleNearSelected = useCallback(() => {
    if (!isEditOwner) return
    const center = getFlowCenter()
    setNodes((nds) => {
      circleIdCounter.current += 1
      const id = makeLocalNodeId('cir', nds)
      const d = CIRCLE_D
      return [
        ...nds,
        {
          id,
          type: 'circle',
          position: { x: center.x - d / 2, y: center.y - d / 2 },
          data: { kind: 'circle', name: '00' },
        },
      ]
    })
  }, [getFlowCenter, makeLocalNodeId, setNodes, isEditOwner])

  const triangleIdCounter = useRef(0)
  const addTriangleNearSelected = useCallback(() => {
    if (!isEditOwner) return
    const center = getFlowCenter()
    setNodes((nds) => {
      triangleIdCounter.current += 1
      const id = makeLocalNodeId('tri', nds)
      return [
        ...nds,
        {
          id,
          type: 'triangle',
          position: { x: center.x - TRI_W / 2, y: center.y - TRI_H / 2 },
          data: { kind: 'triangle', name: `Storage ${triangleIdCounter.current}` },
        },
      ]
    })
  }, [getFlowCenter, makeLocalNodeId, setNodes, isEditOwner])

  const frameIdCounter = useRef(0)
  const addFrameNearSelected = useCallback(() => {
    if (!isEditOwner) return
    const center = getFlowCenter()
    setNodes((nds) => {
      frameIdCounter.current += 1
      const id = makeLocalNodeId('frame', nds)
      const w = 360
      const h = 220
      return [
        ...nds,
        {
          id,
          type: 'frame',
          position: { x: center.x - w / 2, y: center.y - h / 2 },
          data: { kind: 'frame', name: 'Frame', frameW: w, frameH: h, frameLabel: '' },
          draggable: true,
          selectable: true,
          connectable: false,
          dragHandle: '.frame-drag-handle',
          style: { zIndex: -1, pointerEvents: 'none' as const },
        } as Node<PfdData>,
      ]
    })
  }, [getFlowCenter, makeLocalNodeId, setNodes, isEditOwner])

  const addProcessRefNearSelected = useCallback(() => {
    if (!isEditOwner) return

    const linearSteps = sortLinearSteps(nodes.filter(isLinearStepNode))
    const anchor = findLinearTail(nodes, edges) ?? linearSteps.at(-1) ?? null
    const newId = makeLocalNodeId('prc', nodes)

    setNodes((nds) => {
      const x = anchor ? anchor.position.x : OPS_X
      const y = anchor ? anchor.position.y + OPS_GAP : (linearSteps.at(-1)?.position.y ?? (OPS_Y0 - OPS_GAP)) + OPS_GAP

      return [
        ...nds,
        {
          id: newId,
          type: 'processref',
          position: { x, y },
          data: { kind: 'processref', name: '', processOptions },
        },
      ]
    })

    if (anchor) {
      setEdges((eds) => {
        const e1: Edge = {
          id: `e-${anchor.id}-bottom-${newId}-top-${Date.now()}`,
          source: anchor.id,
          sourceHandle: 'bottom-s',
          target: newId,
          targetHandle: 'top-t',
          type: 'smoothedit',
          pathOptions: { borderRadius: Math.max(8, Math.round(14 * S)), offset: Math.round(15 * S) },
          markerEnd: EDGE_MARKER,
          style: { strokeWidth: 1 * S, stroke: '#dbe7f5' },
        }

        return [...eds, e1]
      })
      return
    }
  }, [isEditOwner, makeLocalNodeId, nodes, edges, processOptions, setEdges, setNodes])

  

  const deleteSelected = useCallback(() => {
    if (!isEditOwner) return
    stopEdit()

    const selNodes = nodes.filter((n) => (n as any).selected)
    const selEdges = edges.filter((e) => (e as any).selected)

    const nodesToDelete = selNodes.length ? selNodes : selectedNodeId ? nodes.filter((n) => n.id === selectedNodeId) : []
    const edgesToDelete = selEdges.length ? selEdges : selectedEdgeId ? edges.filter((e) => e.id === selectedEdgeId) : []

    if (nodesToDelete.length === 0 && edgesToDelete.length === 0) return

    const opNodes = nodesToDelete.filter((n) => n.data.kind === 'operation')
    const edgesOnly = edgesToDelete.length > 0 && nodesToDelete.length === 0

    const title = edgesOnly ? 'Delete connection' : 'Delete object'
    const body = edgesOnly
      ? edgesToDelete.length === 1
        ? 'Are you sure you want to delete this connection?'
        : `Are you sure you want to delete ${edgesToDelete.length} connections?`
      : opNodes.length > 0
        ? opNodes.length === 1
          ? 'Are you sure you want to delete this operation? All linked PFMEA risks for this step will also be deleted.'
          : `Are you sure you want to delete ${opNodes.length} operations? All linked PFMEA risks for these steps will also be deleted.`
        : nodesToDelete.length === 1
          ? 'Are you sure you want to delete this object?'
          : `Are you sure you want to delete ${nodesToDelete.length} objects?`

    const runDelete = async () => {
      if (edgesOnly) {
        const ids = new Set(edgesToDelete.map((e) => e.id))
        setEdges((eds) => eds.filter((e) => !ids.has(e.id)))
        setSelectedEdgeId(null)
        return
      }

      if (nodesToDelete.length === 0) return

      if (opNodes.length > 0) {
        await Promise.all(opNodes.map((n) => supabase.from('pfmea_rows').delete().eq('operation_id', n.id)))
        await Promise.all(opNodes.map((n) => supabase.from('operations').update({ active: false }).eq('id', n.id)))
      }

      const ids = new Set(nodesToDelete.map((n) => n.id))
      setPfmeaOpenOperationId((cur) => (cur && ids.has(cur) ? null : cur))
      setNodes((nds) => nds.filter((n) => !ids.has(n.id)))
      setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)))
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
    }

    if (opNodes.length > 0) {
      setConfirmDialog({
        title,
        body,
        dangerNote: 'DATA WILL BE PERMANENTLY LOST',
        onConfirm: async () => {
          setConfirmDialog({
            title: 'Final confirmation',
            body: 'Are you absolutely sure you want to proceed?',
            dangerNote: 'DATA WILL BE PERMANENTLY LOST',
            onConfirm: async () => {
              await runDelete()
              return true
            },
          })
          return false
        },
      })
      return
    }

    setConfirmDialog({
      title,
      body,
      onConfirm: async () => {
        await runDelete()
        return true
      },
    })
  }, [nodes, edges, selectedNodeId, selectedEdgeId, setNodes, setEdges, stopEdit, isEditOwner])

  const resequenceOperations = useCallback(async () => {
    if (!isEditOwner) return
    const ops = sortOpsByNumber(nodes.filter(isOperation))
    const map = new Map<string, number>()
    ops.forEach((n, idx) => map.set(n.id, (idx + 1) * 10))

    await Promise.all(ops.map((n) => supabase.from('operations').update({ operation_number: map.get(n.id) }).eq('id', n.id)))
    setNodes((nds) =>
      nds.map((n) => (n.data.kind === 'operation' ? { ...n, data: { ...n.data, opNo: map.get(n.id) } } : n))
    )
  }, [nodes, setNodes, isEditOwner])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (confirmDialog || decisionConnectDialog || saveDialogOpen || historyOpen) {
        if (e.key === 'Escape') {
          if (!confirmBusy) setConfirmDialog(null)
          setDecisionConnectDialog(null)
          if (!saveBusy) setSaveDialogOpen(false)
          setHistoryOpen(false)
        }
        return
      }
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      if (e.key === 'Delete' && isEditOwner) {
        e.preventDefault()
        deleteSelected()
      }
      if (e.key === 'Escape') stopEdit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmBusy, confirmDialog, decisionConnectDialog, deleteSelected, historyOpen, saveBusy, saveDialogOpen, stopEdit, isEditOwner])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setPfmeaOpenOperationId(null)
    stopEdit()
  }, [stopEdit])

  const onNodeClick = useCallback(
    (_e: any, n: Node<PfdData>) => {
      setSelectedNodeId(n.id)
      setSelectedEdgeId(null)
      stopEdit()
    },
    [stopEdit]
  )

  const onEdgeClick = useCallback(
    (_e: any, e: Edge) => {
      setSelectedEdgeId(e.id)
      setSelectedNodeId(null)
      stopEdit()
    },
    [stopEdit]
  )

  const onNodeDrag = useCallback(
    (_e: any, n: Node<PfdData>) => {
      if (!isEditOwner) return
      if (n.data.kind === 'frame') return
      const SNAP_DIST = 24
      const GAP = MAGNET_GAP
      const r = nodeRect(n)
      if (r.w <= 0 || r.h <= 0) return
      const offA = { x: 0, y: 0 }

      let bestDx = 0
      let bestDy = 0
      let bestDxDist = Infinity
      let bestDyDist = Infinity

      const aLeft = n.position.x + offA.x
      const aTop = n.position.y + offA.y
      const aRight = n.position.x + r.w + offA.x
      const aBottom = n.position.y + r.h + offA.y
      const aCenterX = n.position.x + r.w / 2 + offA.x
      const aCenterY = n.position.y + r.h / 2 + offA.y

      const considerDx = (dx: number) => {
        const d = Math.abs(dx)
        if (d < bestDxDist && d <= SNAP_DIST) {
          bestDxDist = d
          bestDx = dx
        }
      }
      const considerDy = (dy: number) => {
        const d = Math.abs(dy)
        if (d < bestDyDist && d <= SNAP_DIST) {
          bestDyDist = d
          bestDy = dy
        }
      }

      nodes.forEach((other) => {
        if (other.id === n.id) return
        if (other.data.kind === 'frame') return
        const or = nodeRect(other)
        if (or.w <= 0 || or.h <= 0) return
        const offB = { x: 0, y: 0 }

        const bLeft = other.position.x + offB.x
        const bTop = other.position.y + offB.y
        const bRight = other.position.x + or.w + offB.x
        const bBottom = other.position.y + or.h + offB.y
        const bCenterX = other.position.x + or.w / 2 + offB.x
        const bCenterY = other.position.y + or.h / 2 + offB.y

        // Existing center-to-center magnet
        considerDx(bCenterX - aCenterX)
        considerDy(bCenterY - aCenterY)

        // New gap magnet: keep the same gap as default Operation spacing, for all node types except frame.
        const vertOverlap = overlapRatio(aTop, aBottom, bTop, bBottom)
        if (vertOverlap > 0.12) {
          // A to the right of B => A.left = B.right + GAP
          considerDx(bRight + GAP - aLeft)
          // A to the left of B => A.right = B.left - GAP
          considerDx(bLeft - GAP - aRight)
        }

        const horOverlap = overlapRatio(aLeft, aRight, bLeft, bRight)
        if (horOverlap > 0.12) {
          // A below B => A.top = B.bottom + GAP
          considerDy(bBottom + GAP - aTop)
          // A above B => A.bottom = B.top - GAP
          considerDy(bTop - GAP - aBottom)
        }
      })

      if (bestDxDist !== Infinity || bestDyDist !== Infinity) {
        setNodes((nds) =>
          nds.map((node) =>
            node.id === n.id ? { ...node, position: { x: n.position.x + bestDx, y: n.position.y + bestDy } } : node
          )
        )
      }
    },
    [nodes, setNodes, isEditOwner]
  )

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (!isEditOwner) return
      onNodesChangeRaw(changes)
      const selected = nodes.find((n) => (n as any).selected)
      if (selected && isOperationId(selected.id) && selected.id !== selectedNodeId) setSelectedNodeId(selected.id)
    },
    [onNodesChangeRaw, nodes, selectedNodeId, isEditOwner]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (!isEditOwner) return
      onEdgesChangeRaw(changes)
    },
    [onEdgesChangeRaw, isEditOwner]
  )

  const onViewportMove = useCallback((_e: any, vp: { x: number; y: number; zoom: number }) => {
    viewportRef.current = vp
    const next = Math.round(((vp.zoom ?? ZOOM_BASE) / ZOOM_BASE) * 100)
    setZoomPct((prev) => (prev === next ? prev : next))
  }, [])

  const onWheelZoom = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!rfRef.current) return
      e.preventDefault()
      const dir = e.deltaY < 0 ? 1 : -1
      const minZoom = 0.35
      const maxZoom = 3
      const curZoom = viewportRef.current.zoom ?? rfRef.current.getZoom?.() ?? ZOOM_BASE
      const curPct = Math.round((curZoom / ZOOM_BASE) * 100)
      const minPct = Math.round((minZoom / ZOOM_BASE) * 100)
      const maxPct = Math.round((maxZoom / ZOOM_BASE) * 100)
      const nextPct = Math.max(minPct, Math.min(maxPct, curPct + dir * 10))
      const nextZoom = (nextPct / 100) * ZOOM_BASE
      const vp = viewportRef.current
      rfRef.current.setViewport?.({ x: vp.x, y: vp.y, zoom: nextZoom }, { duration: 0 })
    },
    []
  )

  const setZoomByStep = useCallback((dir: -1 | 1) => {
    if (!rfRef.current) return
    const minZoom = 0.35
    const maxZoom = 3
    const curZoom = viewportRef.current.zoom ?? rfRef.current.getZoom?.() ?? ZOOM_BASE
    const curPct = Math.round((curZoom / ZOOM_BASE) * 100)
    const minPct = Math.round((minZoom / ZOOM_BASE) * 100)
    const maxPct = Math.round((maxZoom / ZOOM_BASE) * 100)
    const nextPct = Math.max(minPct, Math.min(maxPct, curPct + dir * 10))
    const nextZoom = (nextPct / 100) * ZOOM_BASE
    const vp = viewportRef.current
    rfRef.current.setViewport?.({ x: vp.x, y: vp.y, zoom: nextZoom }, { duration: 120 })
  }, [])

  const centerAll = useCallback(() => {
    triggerCenterView()
  }, [triggerCenterView])

  

  const reloadMini = useCallback(async () => {
    if (!pfmeaOpenOperationId) return
    const res = await supabase
      .from('pfmea_rows')
      .select('id,operation_id,failure_mode,effect,cause,severity,occurrence,detection,rpn,oxd,created_at')
      .eq('operation_id', pfmeaOpenOperationId)
      .order('created_at', { ascending: true })

    if (res.error) {
      setErr(res.error.message)
      return
    }
    setPfmeaMiniRows((res.data ?? []) as PfmeaMiniRow[])
  }, [pfmeaOpenOperationId])

  const addMiniRow = useCallback(async () => {
    if (!pfmeaOpenOperationId) return
    setErr('')

    const payload = {
      operation_id: pfmeaOpenOperationId,
      failure_mode: '',
      effect: '',
      cause: '',
      severity: null,
      occurrence: null,
      detection: null,
      oxd: null,
      rpn: null,

      class: null,
      current_prevention: '',
      current_detection: '',
      recommended_action: '',
      responsible: '',
      target_date: null,
      action_status: 'OPEN',
      occurrence2: null,
      detection2: null,
      rpn2: null,
      oxd2: null,
      rpn_current: null,
      oxd_current: null,
    }

    const ins = await supabase.from('pfmea_rows').insert([payload])
    if (ins.error) {
      setErr(ins.error.message)
      return
    }
    await reloadMini()
  }, [pfmeaOpenOperationId, reloadMini])


  const updateMiniCell = useCallback(async (row: PfmeaMiniRow, patch: Partial<PfmeaMiniRow>) => {
    setErr('')

    const guarded: any = { ...patch }
    ;(['severity', 'occurrence', 'detection'] as (keyof PfmeaMiniRow)[]).forEach((k) => {
      if (k in guarded) {
        const v = guarded[k]
        if (v === null) return
        if (!isInt1to10(v)) guarded[k] = null
      }
    })

    const merged: PfmeaMiniRow = { ...row, ...(guarded as any) }
    const derived = computeMiniDerived(merged)

    const res = await supabase.from('pfmea_rows').update({ ...guarded, ...derived }).eq('id', row.id)
    if (res.error) {
      setErr(res.error.message)
      return
    }

    setPfmeaMiniRows((rows) => rows.map((r) => (r.id === row.id ? ({ ...r, ...(guarded as any), ...derived } as any) : r)))
  }, [])

  const colOrder: ColKey[] = ['failure_mode', 'effect', 'cause', 'severity', 'occurrence', 'detection']
  const colIndex = (c: ColKey) => colOrder.indexOf(c)

  const startEdit = useCallback((rowId: string, col: ColKey) => setEdit({ rowId, col }), [])
  useEffect(() => {
    if (!edit) return
    setTimeout(() => editRef.current?.focus(), 0)
  }, [edit])

  function nextCell(rowIndex: number, colIdx: number) {
    let c = colIdx + 1
    let r = rowIndex
    if (c >= colOrder.length) {
      c = 0
      r = Math.min(rowIndex + 1, Math.max(0, pfmeaMiniRows.length - 1))
    }
    return { r, c }
  }
  function prevCell(rowIndex: number, colIdx: number) {
    let c = colIdx - 1
    let r = rowIndex
    if (c < 0) {
      c = colOrder.length - 1
      r = Math.max(rowIndex - 1, 0)
    }
    return { r, c }
  }

  const handleCellKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
      rowIndex: number,
      colIdx: number,
      allowEnterNewline: boolean
    ) => {
      if (e.key === 'Enter' && allowEnterNewline) return

      if (e.key === 'Tab') {
        e.preventDefault()
        const pos = e.shiftKey ? prevCell(rowIndex, colIdx) : nextCell(rowIndex, colIdx)
        const nextRow = pfmeaMiniRows[pos.r]
        if (!nextRow) return
        setEdit({ rowId: nextRow.id, col: colOrder[pos.c] })
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        stopEdit()
        return
      }
    },
    [pfmeaMiniRows, stopEdit]
  )

  const pfmeaOpen = Boolean(pfmeaOpenOperationId)
  const flowHeight = pfmeaOpen ? '75vh' : '100vh'
  const panelHeight = pfmeaOpen ? '25vh' : '0px'

  if (!canWork) {
    return (
      <div style={{ padding: 18, fontFamily: UI_FONT }}>
        <Link href="/projects" style={{ textDecoration: 'none' }}>
          ← Back to projects
        </Link>
        <h2 style={{ marginTop: 12 }}>PFD</h2>
        <div style={{ color: 'crimson', fontWeight: 800 }}>Missing project id in URL (use /pfd?project=...)</div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden', position: 'relative', userSelect: 'none', fontFamily: UI_FONT, background: '#171f33' }}>
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
      {sessionMsg ? (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            width: 'min(720px, calc(100vw - 32px))',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textAlign: 'center',
              padding: '10px 14px',
              borderRadius: SURFACE_RADIUS,
              background: 'rgba(69, 47, 28, 0.88)',
              color: '#fdba74',
              border: '1px solid rgba(253,186,116,0.42)',
              boxShadow: '0 10px 24px rgba(15,23,42,0.22)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            {sessionMsg}
          </div>
        </div>
      ) : null}
      {/* LEFT RAIL */}
      <div
        style={{
          position: 'absolute',
          zIndex: 30,
          top: 12,
          left: 12,
          width: 198,
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingRight: 2,
        }}
      >
        <div
          style={{
            padding: 10,
            borderRadius: SURFACE_RADIUS,
            background: 'rgba(255,255,255,0.08)',
            border: `1px solid ${SURFACE_BORDER}`,
            boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className={`btn ${isEditOwner ? 'dangerBtn' : 'btnGreen'}`}
              style={{
                ...baseBtn,
                width: '100%',
                ...(
                  sessionBusy || (!isEditOwner && (isLockedByOther || !currentUserId))
                    ? baseBtnDisabled
                    : null
                ),
              }}
              onClick={
                isEditOwner
                  ? () =>
                      setConfirmDialog({
                        title: 'Discard draft and close session',
                        body: 'Are you sure? All unsaved draft changes will be permanently lost.',
                        dangerNote: 'DRAFT CHANGES WILL BE LOST',
                        onConfirm: async () => {
                          await discardDraftAndCloseSession()
                          return true
                        },
                      })
                  : startEditSession
              }
              disabled={sessionBusy || (!isEditOwner && (isLockedByOther || !currentUserId))}
            >
              {sessionBusy ? 'Please wait...' : isEditOwner ? 'Discard draft' : 'Edit PFD'}
            </button>
            {isEditOwner ? (
              <button className="btn btnGreen" style={{ ...baseBtn, width: '100%' }} onClick={() => setSaveDialogOpen(true)} disabled={!projectId}>
                Save PFD
              </button>
            ) : null}
            <button className="btn btnGreen" style={{ ...baseBtn, width: '100%' }} onClick={() => setHistoryOpen(true)} disabled={!projectId}>
              PFD history
            </button>
          </div>
          {err ? <div style={{ fontSize: 12, padding: '8px 10px', borderRadius: SURFACE_RADIUS, background: 'rgba(127,29,29,0.42)', color: '#fee2e2', border: '1px solid rgba(248,113,113,0.4)' }}><b>Error:</b> {err}</div> : null}
        </div>

        {isEditOwner && (
          <div
            style={{
              padding: 9,
              borderRadius: SURFACE_RADIUS,
              background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${SURFACE_BORDER}`,
              boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}
          >
            <PaletteButton title="Start/Stop" subtitle="Center" onClick={addStartStopNearSelected} disabled={loading || !nodes.length || isReadOnly}><ThumbStartStop /></PaletteButton>
            <PaletteButton title="Process Step" subtitle="Adds at end" onClick={addOperationAtEnd} disabled={loading || isReadOnly}><ThumbOperation /></PaletteButton>
            <PaletteButton title="Process Step" subtitle="Insert after" onClick={addOperationAfterSelected} disabled={loading || !selectedIsOperation || isReadOnly}><ThumbOperation /></PaletteButton>
            <PaletteButton title="Decision" subtitle="Center" onClick={addDecisionNearSelected} disabled={loading || !nodes.length || isReadOnly}><ThumbDecision /></PaletteButton>
            <PaletteButton title="Connector" subtitle="Center" onClick={addCircleNearSelected} disabled={loading || !nodes.length || isReadOnly}><ThumbCircle /></PaletteButton>
            <PaletteButton title="Storage" subtitle="Center" onClick={addTriangleNearSelected} disabled={loading || !nodes.length || isReadOnly}><ThumbTriangle /></PaletteButton>
            <PaletteButton title="Frame" subtitle="Center" onClick={addFrameNearSelected} disabled={loading || isReadOnly}><ThumbFrame /></PaletteButton>
            <PaletteButton title="Sub - Process" subtitle="Select process" onClick={addProcessRefNearSelected} disabled={loading || isReadOnly}><ThumbSubProcess /></PaletteButton>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />
            <button className="btn btnGreen" style={{ ...baseBtn, width: '100%', ...(isReadOnly ? baseBtnDisabled : null) }} onClick={resequenceOperations} disabled={isReadOnly}>Resequence</button>
            <button className="btn btnGreen" style={{ ...baseBtn, width: '100%', ...(isReadOnly ? baseBtnDisabled : null), ...(lassoEnabled ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)' } : null) }} onClick={() => setLassoEnabled((v) => !v)} disabled={isReadOnly}>{lassoEnabled ? 'Lasso: ON' : 'Lasso: OFF'}</button>
          </div>
        )}

        <div
          style={{
            padding: 12,
            borderRadius: SURFACE_RADIUS,
            background: 'rgba(255,255,255,0.08)',
            border: `1px solid ${SURFACE_BORDER}`,
            boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setZoomByStep(-1)}
              style={{ ...baseBtn, height: 29, width: 29, padding: 0, background: SURFACE_BG }}
              title="Zoom out"
            >
              -
            </button>
            <div
              style={{
                minWidth: 52,
                height: 29,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 800,
                color: SURFACE_TEXT,
                borderRadius: SURFACE_RADIUS,
                border: `1px solid ${SURFACE_BORDER}`,
                background: SURFACE_BG,
              }}
            >
              {zoomPct}%
            </div>
            <button
              type="button"
              onClick={() => setZoomByStep(1)}
              style={{ ...baseBtn, height: 29, width: 29, padding: 0, background: SURFACE_BG }}
              title="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={centerAll}
              style={{ ...baseBtn, height: 29, padding: '0 10px', background: SURFACE_BG, flex: 1 }}
              title="Center all objects"
            >
              Center
            </button>
          </div>
        </div>
      </div>
{/* FLOW */}
      <div
        style={{ width: '100%', height: flowHeight, transition: 'height 180ms ease', position: 'relative' }}
        ref={flowWrapRef}
        onWheel={onWheelZoom}
      >
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: 12,
            zIndex: 25,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${SURFACE_BORDER}`,
              borderRadius: SURFACE_RADIUS,
              padding: 10,
              boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Link
              href={`/pfmea?project=${projectId}`}
              className="btn btnGreen"
              style={{ ...baseBtn, width: 180 }}
            >
              PFMEA
            </Link>
            <Link
              href="/pcp"
              className="btn btnGreen"
              style={{ ...baseBtn, width: 180 }}
            >
              PCP
            </Link>
          </div>
        </div>
        <ReactFlow
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          nodes={nodesWithHandlers}
          edges={edgesStyled}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          connectOnClick={isEditOwner}
          connectionRadius={Math.round(HIT * 1.6)}
          onNodeDrag={onNodeDrag}
          onEdgeUpdate={onEdgeUpdate}
          onEdgeUpdateEnd={onEdgeUpdateEnd}
          edgeUpdaterRadius={isEditOwner ? 18 : 0}  

          onPaneClick={onPaneClick}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onSelectionChange={onSelectionChange}
          onInit={(inst) => {
            rfRef.current = inst
            inst.setViewport?.({ x: 0, y: 0, zoom: ZOOM_BASE }, { duration: 0 })
            viewportRef.current = { x: 0, y: 0, zoom: ZOOM_BASE }
            setZoomPct(100)
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                centerAll()
              })
            })
          }}
          onMove={onViewportMove}
          minZoom={0.35}
          maxZoom={3}
          zoomOnScroll={false}
          nodesDraggable={isEditOwner}
          elementsSelectable
          selectNodesOnDrag={lassoEnabled && isEditOwner}
          selectionOnDrag={lassoEnabled && isEditOwner}
          panOnDrag={[2]}
        >
          <MiniMap />
          <Background />
        </ReactFlow>
      </div>

      {/* PFMEA MINI PANEL */}
      <div
        style={{
          width: '100%',
          height: panelHeight,
          transition: 'height 180ms ease',
          overflow: 'hidden',
          background: pfmeaOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
          borderTop: pfmeaOpen ? `1px solid ${SURFACE_BORDER}` : 'none',
          boxShadow: pfmeaOpen ? '0 -10px 30px rgba(0,0,0,0.22)' : 'none',
          backdropFilter: pfmeaOpen ? 'blur(12px)' : undefined,
          WebkitBackdropFilter: pfmeaOpen ? 'blur(12px)' : undefined,
        }}
      >
        {pfmeaOpen && (
          <div style={{ height: '100%', padding: 14, display: 'flex', flexDirection: 'column', color: SURFACE_TEXT }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: SURFACE_MUTED, fontWeight: 700 }}>PFMEA</div>
                <h3 style={{ margin: 0, fontSize: 16, color: SURFACE_TEXT }}>{selectedOperationLabel}</h3>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btnGreen" style={baseBtn} onClick={addMiniRow}>
                  + Add row
                </button>
                <Link href={`/pfmea?project=${projectId}&op=${pfmeaOpenOperationId}`} className="btn btnGreen" style={baseBtn}>
                  Open full PFMEA →
                </Link>
                <button className="btn btnGreen" style={baseBtn} onClick={() => setPfmeaOpenOperationId(null)}>
                  Close
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, flex: 1, overflow: 'auto', border: `1px solid ${SURFACE_BORDER}`, borderRadius: 12, background: SURFACE_PANEL_BG }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', background: SURFACE_PANEL_BG }}>
                <thead>
                  <tr>
                    <th style={th({ width: 260 })}>Failure mode</th>
                    <th style={th({ width: 260 })}>Effect</th>
                    <th style={th({ width: 260 })}>Cause</th>
                    <th style={th({ width: 56, textAlign: 'center' })}>S</th>
                    <th style={th({ width: 56, textAlign: 'center' })}>O</th>
                    <th style={th({ width: 56, textAlign: 'center' })}>D</th>
                    <th style={th({ width: 72, textAlign: 'center' })}>RPN</th>
                  </tr>
                </thead>

                <tbody>
                  {pfmeaMiniRows.map((row, rowIndex) => (
                    <tr key={row.id}>
                      <td style={td()}>
                        <ExcelTextCell
                          value={row.failure_mode}
                          editing={edit?.rowId === row.id && edit?.col === 'failure_mode'}
                          onStart={() => startEdit(row.id, 'failure_mode')}
                          onChange={(v) => updateMiniCell(row, { failure_mode: v })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex('failure_mode'), true)}
                          onBlur={stopEdit}
                          editorRef={editRef}
                        />
                      </td>

                      <td style={td()}>
                        <ExcelTextCell
                          value={row.effect}
                          editing={edit?.rowId === row.id && edit?.col === 'effect'}
                          onStart={() => startEdit(row.id, 'effect')}
                          onChange={(v) => updateMiniCell(row, { effect: v })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex('effect'), true)}
                          onBlur={stopEdit}
                          editorRef={editRef}
                        />
                      </td>

                      <td style={td()}>
                        <ExcelTextCell
                          value={row.cause}
                          editing={edit?.rowId === row.id && edit?.col === 'cause'}
                          onStart={() => startEdit(row.id, 'cause')}
                          onChange={(v) => updateMiniCell(row, { cause: v })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex('cause'), true)}
                          onBlur={stopEdit}
                          editorRef={editRef}
                        />
                      </td>

                      <td style={td({ textAlign: 'center' })}>
                        <ExcelNumberCell
                          value={row.severity ?? 1}
                          editing={edit?.rowId === row.id && edit?.col === 'severity'}
                          onStart={() => startEdit(row.id, 'severity')}
                          onChange={(v) => updateMiniCell(row, { severity: clamp10(v) })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex('severity'), false)}
                          onBlur={stopEdit}
                          editorRef={editRef}
                        />
                      </td>

                      <td style={td({ textAlign: 'center' })}>
                        <ExcelNumberCell
                          value={row.occurrence ?? 1}
                          editing={edit?.rowId === row.id && edit?.col === 'occurrence'}
                          onStart={() => startEdit(row.id, 'occurrence')}
                          onChange={(v) => updateMiniCell(row, { occurrence: clamp10(v) })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex('occurrence'), false)}
                          onBlur={stopEdit}
                          editorRef={editRef}
                        />
                      </td>

                      <td style={td({ textAlign: 'center' })}>
                        <ExcelNumberCell
                          value={row.detection ?? 1}
                          editing={edit?.rowId === row.id && edit?.col === 'detection'}
                          onStart={() => startEdit(row.id, 'detection')}
                          onChange={(v) => updateMiniCell(row, { detection: clamp10(v) })}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex('detection'), false)}
                          onBlur={stopEdit}
                          editorRef={editRef}
                        />
                      </td>

                      <td
                        style={td({
                          textAlign: 'center',
                          fontWeight: 900,
                          background: 'rgba(255,255,255,0.08)',
                          color: PFMEA_ACCENT,
                          fontSize: 15,
                        })}
                      >
                        {row.rpn ?? computeMiniDerived(row).rpn ?? ''}
                      </td>
                    </tr>
                  ))}

                  {pfmeaMiniRows.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 16, color: PFMEA_CELL_TEXT }}>
                        No PFMEA rows yet. Click <b>+ Add row</b>.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {confirmDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 80,
          }}
          onClick={() => (confirmBusy ? null : setConfirmDialog(null))}
        >
          <div
            style={{
              width: 520,
              maxWidth: '92vw',
              background: SURFACE_PANEL_BG,
              borderRadius: SURFACE_RADIUS,
              border: `1px solid ${SURFACE_BORDER}`,
              boxShadow: '0 16px 36px rgba(0,0,0,0.2)',
              padding: 20,
              color: SURFACE_TEXT,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>{confirmDialog.title}</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 10 }}>{confirmDialog.body}</div>
            {confirmDialog.dangerNote ? (
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: '#ef4444', marginBottom: 16 }}>
                {confirmDialog.dangerNote}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => (confirmBusy ? null : setConfirmDialog(null))}
                disabled={confirmBusy}
                style={{ ...baseBtn, height: 28, padding: '0 12px' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (confirmBusy) return
                  setConfirmBusy(true)
                  try {
                    const shouldClose = await confirmDialog.onConfirm()
                    if (shouldClose !== false) setConfirmDialog(null)
                  } catch (e: any) {
                    setErr(e?.message ?? String(e))
                  } finally {
                    setConfirmBusy(false)
                  }
                }}
                disabled={confirmBusy}
                style={{ ...baseBtn, height: 28, padding: '0 12px' }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {decisionConnectDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 80,
          }}
          onClick={() => setDecisionConnectDialog(null)}
        >
          <div
            style={{
              width: 520,
              maxWidth: '92vw',
              background: SURFACE_PANEL_BG,
              borderRadius: SURFACE_RADIUS,
              border: `1px solid ${SURFACE_BORDER}`,
              boxShadow: '0 16px 36px rgba(0,0,0,0.2)',
              padding: 20,
              color: SURFACE_TEXT,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>Decision output label</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 12 }}>
              Enter a label for this decision path.
            </div>
            <input
              autoFocus
              value={decisionConnectDialog.value}
              onChange={(e) =>
                setDecisionConnectDialog((cur) => (cur ? { ...cur, value: e.target.value } : cur))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const label = decisionConnectDialog.value.trim()
                  commitConnection(
                    decisionConnectDialog.params,
                    decisionConnectDialog.key,
                    label ? label : undefined
                  )
                  setDecisionConnectDialog(null)
                }
              }}
              placeholder="e.g. OK / NOK"
              style={{
                width: '100%',
                height: 40,
                borderRadius: SURFACE_RADIUS,
                border: `1px solid ${SURFACE_BORDER}`,
                padding: '0 12px',
                fontSize: 14,
                fontFamily: UI_FONT,
                marginBottom: 16,
                background: SURFACE_BG,
                color: SURFACE_TEXT,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDecisionConnectDialog(null)}
                style={{ ...baseBtn, height: 28, padding: '0 12px' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const label = decisionConnectDialog.value.trim()
                  commitConnection(
                    decisionConnectDialog.params,
                    decisionConnectDialog.key,
                    label ? label : undefined
                  )
                  setDecisionConnectDialog(null)
                }}
                style={{ ...baseBtn, height: 28, padding: '0 12px' }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {saveDialogOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 80,
          }}
          onClick={() => (saveBusy ? null : setSaveDialogOpen(false))}
        >
          <div
            style={{
              width: 560,
              maxWidth: '92vw',
              background: SURFACE_PANEL_BG,
              borderRadius: SURFACE_RADIUS,
              border: `1px solid ${SURFACE_BORDER}`,
              boxShadow: '0 16px 36px rgba(0,0,0,0.2)',
              padding: 20,
              color: SURFACE_TEXT,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>Save PFD</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 12 }}>
              Describe what you changed.
            </div>
            <textarea
              autoFocus
              value={saveDesc}
              onChange={(e) => setSaveDesc(e.target.value)}
              placeholder="Describe changes (required)"
              style={{
                width: '100%',
                minHeight: 90,
                borderRadius: SURFACE_RADIUS,
                border: `1px solid ${SURFACE_BORDER}`,
                padding: '10px 12px',
                fontSize: 14,
                fontFamily: UI_FONT,
                resize: 'vertical',
                marginBottom: 14,
                background: SURFACE_BG,
                color: SURFACE_TEXT,
              }}
            />
            <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 6 }}>
              Next revision: <b>{(() => {
                const parts = (currentRevisionLabel || '0.0.0').split('.')
                const major = Number.parseInt(parts[0] ?? '0', 10)
                const safeMajor = Number.isFinite(major) ? major : 0
                const rest = parts.length > 1 ? parts.slice(1).join('.') : '0.0'
                return `${safeMajor + 1}.${rest}`
              })()}</b>
            </div>
            <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 6 }}>
              Author: <b>{historyAuthor}</b>
            </div>
            <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 14 }}>
              Current diagram: <b>{nodes.length}</b> objects, <b>{edges.length}</b> connections
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => (saveBusy ? null : setSaveDialogOpen(false))}
                disabled={saveBusy}
                style={{ ...baseBtn, height: 28, padding: '0 12px' }}
              >
                Cancel
              </button>
              <button
                onClick={savePfdWithDescription}
                disabled={saveBusy || !saveDesc.trim()}
                style={{ ...baseBtn, height: 28, padding: '0 12px' }}
              >
                {saveBusy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 80,
          }}
          onClick={() => setHistoryOpen(false)}
        >
          <div
            style={{
              width: 864,
              maxWidth: '94vw',
              maxHeight: '80vh',
              overflow: 'auto',
              background: SURFACE_PANEL_BG,
              borderRadius: SURFACE_RADIUS,
              border: `1px solid ${SURFACE_BORDER}`,
              boxShadow: '0 16px 36px rgba(0,0,0,0.2)',
              padding: 20,
              color: SURFACE_TEXT,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>PFD change history</div>
            {historyEntries.length === 0 ? (
              <div style={{ fontSize: 14, color: SURFACE_MUTED, padding: '10px 0' }}>No saved history yet.</div>
            ) : (
              <div
                style={{
                  overflowX: 'auto',
                  overflowY: 'auto',
                  maxHeight: 260, // ~5 rows, then vertical scrollbar
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: SURFACE_RADIUS }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>Revision</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>Date</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>Author</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>Description</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>Objects</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>Connections</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyEntries.map((h) => (
                      <tr key={h.id}>
                        <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 15, color: SURFACE_TEXT, borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700 }}>{h.revision}</td>
                          <td style={{ padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{new Date(h.at).toLocaleString()}</td>
                          <td style={{ padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h.author}</td>
                          <td style={{ padding: '8px 10px', fontSize: 15, color: SURFACE_TEXT, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h.description}</td>
                          <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h.nodeCount}</td>
                          <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h.edgeCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                onClick={() => setHistoryOpen(false)}
                style={{ ...baseBtn, height: 28, padding: '0 12px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        html,
        body {
          overflow: hidden;
        }
        .react-flow__pane {
          cursor: default !important;
        }
        .react-flow__node.dragging,
        .react-flow__node.dragging * {
          cursor: grabbing !important;
        }
        .pfd-dot {
          opacity: 0;
          transform: scale(0.9);
          transition: opacity 120ms ease, transform 120ms ease;
          box-shadow: none;
        }
        .pfd-dot.is-active {
          opacity: 1;
          transform: scale(1);
        }
        .react-flow.react-flow--connecting .pfd-dot {
          opacity: 1;
          transform: scale(1);
        }

        .btnGreen:hover {
          background: rgba(59, 130, 246, 0.18) !important;
          border-color: rgba(96, 165, 250, 0.45) !important;
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.2) !important;
          transform: translateY(-1px);
        }

        .dangerBtn:hover {
          background: rgba(59, 130, 246, 0.18) !important;
          border-color: rgba(96, 165, 250, 0.45) !important;
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.2) !important;
          transform: translateY(-1px);
        }

        button:disabled:hover {
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.08) !important;
          box-shadow: none !important;
          transform: none !important;
          cursor: not-allowed !important;
        }
      `}</style>
    </div>
  )
}

/* ===================== BUTTONS ===================== */

const baseBtn: React.CSSProperties = {
  height: 29,
  padding: '0 14px',
  borderRadius: SURFACE_RADIUS,
  border: `1px solid ${SURFACE_BORDER}`,
  background: SURFACE_BG,
  fontSize: 13,
  fontWeight: 600,
  color: SURFACE_TEXT,
  cursor: 'pointer',
  transition: 'background .15s ease, box-shadow .15s ease, transform .10s ease, border-color .15s ease, color .15s ease',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: UI_FONT,
}

const baseBtnDisabled: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.35)',
  border: '1px solid rgba(255,255,255,0.08)',
}

/* ===================== TABLE HELPERS (mini PFMEA) ===================== */

function th(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    position: 'sticky',
    top: 0,
    background: SURFACE_PANEL_BG,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    padding: '10px 10px',
    textAlign: 'left',
    fontWeight: 800,
    color: PFMEA_ACCENT,
    zIndex: 1,
    ...extra,
  }
}

function td(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    padding: 0,
    verticalAlign: 'top',
    color: PFMEA_CELL_TEXT,
    ...extra,
  }
}

function ExcelView({ value, onStart, align = 'left' }: { value: string; onStart: () => void; align?: 'left' | 'center' }) {
  return (
    <div
      onClick={onStart}
      style={{
        padding: '8px 10px',
        minHeight: 44,
        cursor: 'text',
        textAlign: align,
        fontWeight: 500,
        color: align === 'center' ? PFMEA_ACCENT : PFMEA_CELL_TEXT,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        lineHeight: 1.25,
      }}
    >
      {value ? value : <span style={{ color: '#aaa', fontWeight: 600 }}>—</span>}
    </div>
  )
}

function ExcelTextCell({
  value,
  editing,
  onStart,
  onChange,
  onKeyDown,
  onBlur,
  editorRef,
}: {
  value: string
  editing: boolean
  onStart: () => void
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onBlur: () => void
  editorRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>
}) {
  if (!editing) return <ExcelView value={value} onStart={onStart} />

  return (
    <textarea
      ref={editorRef as any}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      style={{
        width: '100%',
        minHeight: 44,
        resize: 'vertical',
        border: 0,
        outline: 0,
        boxShadow: 'none',
        padding: '8px 10px',
        borderRadius: 0,
        fontFamily: UI_FONT,
        fontWeight: 500,
        color: PFMEA_CELL_TEXT,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        lineHeight: 1.25,
        background: 'transparent',
      }}
    />
  )
}

function ExcelNumberCell({
  value,
  editing,
  onStart,
  onChange,
  onKeyDown,
  onBlur,
  editorRef,
}: {
  value: number
  editing: boolean
  onStart: () => void
  onChange: (v: number) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onBlur: () => void
  editorRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>
}) {
  if (!editing) return <ExcelView value={String(value)} onStart={onStart} align="center" />

  return (
    <input
      ref={editorRef as any}
      type="number"
      min={1}
      max={10}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      style={{
        width: '100%',
        border: 0,
        outline: 0,
        boxShadow: 'none',
        padding: '8px 10px',
        borderRadius: 0,
        fontFamily: UI_FONT,
        fontWeight: 700,
        textAlign: 'center',
        color: PFMEA_ACCENT,
        background: 'transparent',
        minHeight: 44,
      }}
    />
  )
}
