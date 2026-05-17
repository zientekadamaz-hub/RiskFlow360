'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  MarkerType,
  useEdgesState,
  useNodesState,
  type Connection,
  type Node,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { supabase } from '../lib/supabaseBrowser'
import {
  appendConnectionEdge,
  applySelectionToEdges,
  pruneRecentConnectionKeys,
  removeDanglingUpdatedEdge,
  snapDraggedNode,
  updateEdgeConnection,
} from '@/features/pfd/pfd-editor-utils'
import {
  createCircleNode,
  createDecisionNode,
  createFrameNode,
  createLinearStepEdge,
  createProcessRefNode,
  createStartStopNode,
  createTriangleNode,
  makeLocalNodeId,
} from '@/features/pfd/pfd-node-factory'
import {
  findLinearTail,
  findSmallestFree10,
  isLinearStepNode,
  isOperationId,
  isOperationNode,
  sanitizeEdges,
  sanitizeNodes,
  sortLinearSteps,
  sortOperationsByNumber,
  type PfdFlowEdge,
} from '@/features/pfd/pfd-flow-utils'
import {
  createPfmeaMiniRow,
  fetchPfmeaMiniRows,
  updatePfmeaMiniRow,
} from '@/features/pfd/pfmea-mini-service'
import {
  archiveOperationsAndDeletePfmea,
  createOperationRecord,
  patchOperationRecord,
  renumberOperationRecords,
  resequenceOperationRecords,
} from '@/features/pfd/pfd-operations-service'
import {
  discardPfdDraftAndCloseSession,
  fetchPfdModuleAccess,
  fetchOwnPfdDraft,
  fetchPfdCanvasData,
  fetchPfdEditSession,
  fetchPfdHistory,
  fetchPfdProcessOptions,
  fetchPfdRevisionLabel,
  fetchPfdUserContext,
  fetchUnreadPfdSessionNotice,
  heartbeatPfdEditSession,
  publishPfdDiagram,
  savePfdDraft,
  startPfdEditSession,
} from '@/features/pfd/pfd-service'
import {
  SURFACE_RADIUS,
} from '@/features/pfd/pfd-page-styles'
import { PfdConfirmDialog, type PfdConfirmDialogConfig } from '@/features/pfd/pfd-confirm-dialog'
import {
  PfdDecisionConnectDialog,
  type PfdDecisionConnectDialogConfig,
} from '@/features/pfd/pfd-decision-connect-dialog'
import { PfdFlowCanvas } from '@/features/pfd/pfd-flow-canvas'
import { PfdHistoryDialog } from '@/features/pfd/pfd-history-dialog'
import { PfdLeftRail } from '@/features/pfd/pfd-left-rail'
import { PfdMiniPfmeaPanel } from '@/features/pfd/pfd-mini-panel'
import { PfdSaveDialog } from '@/features/pfd/pfd-save-dialog'
import type { PfdEditSession, PfdHistoryEntry, PfmeaMiniRow } from '@/features/pfd/types'

// ✅ biblioteka symboli obok route
import { nodeTypes, type PfdData } from './_lib/nodes'
import OrthEdge from './_lib/edges/OrthEdge'
import { UI_FONT, S, OP_WIDTH, OP_HEIGHT, DEC_H, DEC_W, CIRCLE_D, START_W, START_H, TRI_W, TRI_H } from './_lib/ui/const'

/**
 * PFD + PFMEA mini panel (Supabase)
 */

type Edge = PfdFlowEdge

type ColKey = 'failure_mode' | 'effect' | 'cause' | 'severity' | 'occurrence' | 'detection'
const EDIT_LOCK_HOURS = 48
const EDIT_LOCK_MS = EDIT_LOCK_HOURS * 60 * 60 * 1000

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


function PfdPageFallback() {
  return (
    <div style={{ padding: 24, color: '#666', fontSize: 14, fontWeight: 700 }}>
      Loading PFD...
    </div>
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [moduleAccessState, setModuleAccessState] = useState<'checking' | 'allowed' | 'denied'>('checking')
  const [canOpenPfmeaPanel, setCanOpenPfmeaPanel] = useState(true)
  const [editSession, setEditSession] = useState<PfdEditSession | null>(null)
  const [sessionNow, setSessionNow] = useState(() => Date.now())
  const [sessionMsg, setSessionMsg] = useState('')
  const [sessionBusy, setSessionBusy] = useState(false)
  const draftLoadedFor = useRef<string>('')
  const [confirmDialog, setConfirmDialog] = useState<PfdConfirmDialogConfig | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [decisionConnectDialog, setDecisionConnectDialog] = useState<PfdDecisionConnectDialogConfig | null>(null)

  const canWork = !!projectId
  const sessionExpired = useMemo(() => {
    if (!editSession) return false
    const last = new Date(editSession.lastActivityAt).getTime()
    if (!Number.isFinite(last)) return true
    return sessionNow - last >= EDIT_LOCK_MS
  }, [editSession, sessionNow])
  const isEditOwner = !!currentUserId && !!editSession && editSession.lockedBy === currentUserId && !sessionExpired
  const isLockedByOther = !!editSession && !isEditOwner && !sessionExpired
  const isReadOnly = !isEditOwner

  const loadHistoryAuthor = useCallback(async () => {
    try {
      const ctx = await fetchPfdUserContext(supabase)
      setHistoryAuthor(ctx.historyAuthor)
    } catch {}
  }, [])

  const loadUserContext = useCallback(async () => {
    if (!projectId) return
    try {
      const ctx = await fetchPfdUserContext(supabase)
      setCurrentUserId(ctx.currentUserId)
      setHistoryAuthor(ctx.historyAuthor)
    } catch {}
  }, [projectId])

  const loadEditSession = useCallback(async () => {
    try {
      const next = await fetchPfdEditSession(supabase, projectId)
      setEditSession(next)
    } catch {
      setEditSession(null)
    }
  }, [projectId])

  const loadSessionNotice = useCallback(async () => {
    try {
      if (!projectId || !currentUserId) return
      const message = await fetchUnreadPfdSessionNotice(supabase, projectId, currentUserId)
      if (message) setSessionMsg(message)
    } catch {}
  }, [projectId, currentUserId])

  const loadRevisionLabel = useCallback(async () => {
    try {
      const label = await fetchPfdRevisionLabel(supabase, projectId)
      setCurrentRevisionLabel(label)
    } catch {}
  }, [projectId])

  const loadProcessOptions = useCallback(async () => {
    try {
      const values = await fetchPfdProcessOptions(supabase, projectId)
      setProcessOptions(values)
    } catch {
      setProcessOptions([])
    }
  }, [projectId])

  const loadHistory = useCallback(async () => {
    try {
      const entries = await fetchPfdHistory(supabase, projectId)
      setHistoryEntries(entries)
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
      await publishPfdDiagram(supabase, {
        projectId,
        currentUserId,
        historyAuthor,
        description,
        nodes,
        edges,
      })

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
      const result = await startPfdEditSession(supabase, {
        projectId,
        currentUserId,
        nodes,
        edges,
        editLockMs: EDIT_LOCK_MS,
      })

      if (result.blocked) {
        setErr(result.message)
        return
      }

      await loadEditSession()
      draftLoadedFor.current = ''
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSessionBusy(false)
    }
  }, [projectId, currentUserId, nodes, edges, loadEditSession])

  const loadAll = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setErr('')
    try {
      const data = await fetchPfdCanvasData(supabase, projectId)
      if (data.diagram?.nodes && data.diagram?.edges) {
        const cleanNodes = sanitizeNodes(data.diagram.nodes as Node<PfdData>[])
        const nodeIds = new Set(cleanNodes.map((n) => n.id))
        setNodes(cleanNodes)
        setEdges(sanitizeEdges(data.diagram.edges as Edge[]).filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)))
        setLoading(false)
        triggerCenterView()
        return
      }

      const startNodes: Node<PfdData>[] = data.operations.map((operation, index) => ({
        id: operation.id,
        type: 'operation',
        position: { x: OPS_X, y: OPS_Y0 + index * OPS_GAP },
        data: {
          kind: 'operation',
          name: operation.name ?? '',
          opNo: operation.operation_number ?? 0,
          station: operation.machine ?? '',
          operation: operation.operation ?? '',
        },
      }))

      setNodes(sanitizeNodes(startNodes))
      setEdges([])
      setLoading(false)
      triggerCenterView()
    } catch (error: any) {
      setErr(error?.message ?? String(error))
      setLoading(false)
    }
  }, [projectId, setEdges, setNodes, triggerCenterView])

  const discardDraftAndCloseSession = useCallback(async () => {
    if (!projectId || !currentUserId || !isEditOwner) return
    setSessionBusy(true)
    setErr('')
    try {
      await discardPfdDraftAndCloseSession(supabase, { projectId, currentUserId })
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
    let alive = true

    void (async () => {
      if (!projectId) {
        if (alive) setModuleAccessState('denied')
        return
      }

      const access = await fetchPfdModuleAccess(supabase, projectId)
      if (!alive) return
      setCanOpenPfmeaPanel(access.canOpenPfmeaPanel)
      setModuleAccessState(access.state)
      if (access.redirectToProjects) {
        window.location.assign('/projects')
      }
    })()

    return () => {
      alive = false
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    if (moduleAccessState !== 'allowed') return
    loadAll()
  }, [projectId, loadAll, moduleAccessState])

  useEffect(() => {
    if (!projectId) return
    if (moduleAccessState !== 'allowed') return
    void loadUserContext()
    void loadEditSession()
  }, [projectId, loadUserContext, loadEditSession, moduleAccessState])

  useEffect(() => {
    if (!projectId) return
    if (moduleAccessState !== 'allowed') return
    const timer = setInterval(() => {
      void loadEditSession()
      setSessionNow(Date.now())
    }, 30_000)
    return () => clearInterval(timer)
  }, [projectId, loadEditSession, moduleAccessState])

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
      const draft = await fetchOwnPfdDraft(supabase, { projectId, currentUserId })
      if (!draft?.nodes || !draft?.edges) return
      const cleanNodes = sanitizeNodes(draft.nodes as Node<PfdData>[])
      const nodeIds = new Set(cleanNodes.map((n) => n.id))
      setNodes(cleanNodes)
      setEdges(sanitizeEdges(draft.edges as Edge[]).filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)))
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
      await heartbeatPfdEditSession(supabase, { projectId, currentUserId })
    }, 60_000)
    return () => clearInterval(timer)
  }, [projectId, currentUserId, isEditOwner])

  const saveTimer = useRef<any>(null)
  const scheduleSaveDiagram = useCallback(
    (nextNodes: Node<PfdData>[], nextEdges: Edge[]) => {
      if (!projectId || !currentUserId || !isEditOwner) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        await savePfdDraft(supabase, {
          projectId,
          currentUserId,
          nodes: nextNodes,
          edges: nextEdges,
        })
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

      const upd: {
        operationNumber?: number
        name?: string
        machine?: string
        operation?: string
      } = {}
      if (typeof patch.opNo === 'number') upd.operationNumber = patch.opNo
      if (typeof patch.name === 'string') upd.name = patch.name
      if (typeof patch.station === 'string') upd.machine = patch.station
      if (typeof patch.operation === 'string') upd.operation = patch.operation

      try {
        await patchOperationRecord(supabase, operationId, upd)
      } catch (error: any) {
        setErr(error?.message ?? String(error))
      }
    },
    [setNodes, isEditOwner]
  )

  const patchFrame = useCallback((frameId: string, patch: Partial<PfdData>) => {
    if (!isEditOwner) return
    setNodes((nds) => nds.map((n) => (n.id === frameId ? { ...n, data: { ...n.data, ...patch } } : n)))
  }, [setNodes, isEditOwner])

  const openPfmeaFor = useCallback(
    async (operationId: string) => {
      setPfmeaOpenOperationId(operationId)
      setSelectedNodeId(operationId)
      setSelectedEdgeId(null)
      stopEdit()

      try {
        const rows = await fetchPfmeaMiniRows(supabase, operationId)
        setPfmeaMiniRows(rows)
      } catch (error: any) {
        setErr(error?.message ?? String(error))
        setPfmeaMiniRows([])
      }
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
        return { ...n, data: { ...n.data, editable: isEditOwner, onOpenPfmea: canOpenPfmeaPanel ? openPfmeaFor : undefined, onPatch: patchOperation } }
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
  }, [nodes, openPfmeaFor, patchFrame, patchOperation, isEditOwner, processOptions, canOpenPfmeaPanel])

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
        const { changed, nextEdges } = applySelectionToEdges(eds, selectedNodeIds, selectedEdgeIds)
        return changed ? nextEdges : eds
      })
    },
    [isEditOwner, lassoEnabled, setEdges]
  )

  const onEdgeUpdateEnd = useCallback(
  (_e: any, edge: Edge) => {
    // jeśli po update edge nie ma source/target → usuń
    setEdges((eds) => removeDanglingUpdatedEdge(eds, edge))
  },
  [setEdges]
)


  const onEdgeUpdate = useCallback(
  (oldEdge: Edge, newConnection: Connection) => {
    setEdges((eds) => updateEdgeConnection(eds, oldEdge, newConnection))
  },
  [setEdges]
)



  const commitConnection = useCallback(
    (params: Connection, key: string, label?: string) => {
      if (!isEditOwner) return
      if (!params.source || !params.target) return
      const now = Date.now()
      pruneRecentConnectionKeys(recentConnectKeys.current, now, 10_000)
      if (recentConnectKeys.current.has(key)) return
      recentConnectKeys.current.set(key, now)

      setEdges((eds) =>
        appendConnectionEdge(eds, params, {
          pathOptions: { borderRadius: Math.max(8, Math.round(14 * S)), offset: Math.round(15 * S) },
          markerEnd: EDGE_MARKER,
          stroke: '#dbe7f5',
          strokeWidth: 1 * S,
          label,
        })
      )
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

    const opsSorted = sortOperationsByNumber(nodes.filter(isOperationNode))
    const last = opsSorted.at(-1) ?? null
    const anchor = findLinearTail(nodes, edges) ?? last

    const opNos = opsSorted.map((n) => n.data.opNo ?? 0)
    const newOpNo = findSmallestFree10(opNos)

    const prevStation = last?.data.station ?? ''
    const prevOperation = last?.data.operation ?? ''

    let inserted
    try {
      inserted = await createOperationRecord(supabase, {
        projectId,
        operationNumber: newOpNo,
        machine: prevStation,
        operation: prevOperation,
      })
    } catch (error: any) {
      setErr(error?.message ?? String(error))
      return
    }

    const newId = inserted.id
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

    const opsSorted = sortOperationsByNumber(nodes.filter(isOperationNode))
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
      try {
        await renumberOperationRecords(supabase, renumberMap)
      } catch (error: any) {
        setErr(error?.message ?? String(error))
        return
      }
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

    let inserted
    try {
      inserted = await createOperationRecord(supabase, {
        projectId,
        operationNumber: insertedNo,
        machine: station,
        operation,
      })
    } catch (error: any) {
      setErr(error?.message ?? String(error))
      return
    }

    const newId = inserted.id

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

  const decIdCounter = useRef(0)
  const addDecisionNearSelected = useCallback(() => {
    if (!isEditOwner) return
    const center = getFlowCenter()
    setNodes((nds) => {
      decIdCounter.current += 1
      const id = makeLocalNodeId('dec', nds)
      return [
        ...nds,
        createDecisionNode(id, { x: center.x - DEC_W / 2, y: center.y - DEC_H / 2 }, decIdCounter.current),
      ]
    })
  }, [getFlowCenter, setNodes, isEditOwner])

  const ssIdCounter = useRef(0)
  const addStartStopNearSelected = useCallback(() => {
    if (!isEditOwner) return
    const center = getFlowCenter()
    setNodes((nds) => {
      ssIdCounter.current += 1
      const id = makeLocalNodeId('ss', nds)
      return [
        ...nds,
        createStartStopNode(id, { x: center.x - START_W / 2, y: center.y - START_H / 2 }, ssIdCounter.current),
      ]
    })
  }, [getFlowCenter, setNodes, isEditOwner])


  const circleIdCounter = useRef(0)
  const addCircleNearSelected = useCallback(() => {
    if (!isEditOwner) return
    const center = getFlowCenter()
    setNodes((nds) => {
      circleIdCounter.current += 1
      const id = makeLocalNodeId('cir', nds)
      return [
        ...nds,
        createCircleNode(id, { x: center.x - CIRCLE_D / 2, y: center.y - CIRCLE_D / 2 }),
      ]
    })
  }, [getFlowCenter, setNodes, isEditOwner])

  const triangleIdCounter = useRef(0)
  const addTriangleNearSelected = useCallback(() => {
    if (!isEditOwner) return
    const center = getFlowCenter()
    setNodes((nds) => {
      triangleIdCounter.current += 1
      const id = makeLocalNodeId('tri', nds)
      return [
        ...nds,
        createTriangleNode(id, { x: center.x - TRI_W / 2, y: center.y - TRI_H / 2 }, triangleIdCounter.current),
      ]
    })
  }, [getFlowCenter, setNodes, isEditOwner])

  const frameIdCounter = useRef(0)
  const addFrameNearSelected = useCallback(() => {
    if (!isEditOwner) return
    const center = getFlowCenter()
    setNodes((nds) => {
      frameIdCounter.current += 1
      const id = makeLocalNodeId('frame', nds)
      return [
        ...nds,
        createFrameNode(id, { x: center.x - 180, y: center.y - 110 }, { w: 360, h: 220 }),
      ]
    })
  }, [getFlowCenter, setNodes, isEditOwner])

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
        createProcessRefNode(newId, { x, y }, processOptions),
      ]
    })

    if (anchor) {
      setEdges((eds) => {
        const e1: Edge = createLinearStepEdge(
          anchor.id,
          newId,
          { borderRadius: Math.max(8, Math.round(14 * S)), offset: Math.round(15 * S) },
          EDGE_MARKER,
          '#dbe7f5',
          1 * S
        )

        return [...eds, e1]
      })
      return
    }
  }, [isEditOwner, nodes, edges, processOptions, setEdges, setNodes])

  

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
        await archiveOperationsAndDeletePfmea(supabase, opNodes.map((n) => n.id))
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
    const ops = sortOperationsByNumber(nodes.filter(isOperationNode))
    let map: Map<string, number>
    try {
      map = await resequenceOperationRecords(supabase, ops.map((n) => n.id))
    } catch (error: any) {
      setErr(error?.message ?? String(error))
      return
    }
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
      const snapped = snapDraggedNode(nodes, n, { snapDistance: 24, gap: MAGNET_GAP })
      if (snapped) {
        setNodes((nds) =>
          nds.map((node) => (node.id === n.id ? { ...node, position: snapped } : node))
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
    try {
      const rows = await fetchPfmeaMiniRows(supabase, pfmeaOpenOperationId)
      setPfmeaMiniRows(rows)
    } catch (error: any) {
      setErr(error?.message ?? String(error))
      setPfmeaMiniRows([])
      return
    }
  }, [pfmeaOpenOperationId])

  const addMiniRow = useCallback(async () => {
    if (!pfmeaOpenOperationId) return
    setErr('')
    try {
      await createPfmeaMiniRow(supabase, pfmeaOpenOperationId)
      await reloadMini()
    } catch (error: any) {
      setErr(error?.message ?? String(error))
    }
  }, [pfmeaOpenOperationId, reloadMini])


  const updateMiniCell = useCallback(async (row: PfmeaMiniRow, patch: Partial<PfmeaMiniRow>) => {
    setErr('')
    try {
      const nextRow = await updatePfmeaMiniRow(supabase, row, patch)
      setPfmeaMiniRows((rows) => rows.map((current) => (current.id === row.id ? nextRow : current)))
    } catch (error: any) {
      setErr(error?.message ?? String(error))
    }
  }, [])

  const colOrder = useMemo<ColKey[]>(() => ['failure_mode', 'effect', 'cause', 'severity', 'occurrence', 'detection'], [])
  const colIndex = (c: ColKey) => colOrder.indexOf(c)

  const startEdit = useCallback((rowId: string, col: ColKey) => setEdit({ rowId, col }), [])
  useEffect(() => {
    if (!edit) return
    setTimeout(() => editRef.current?.focus(), 0)
  }, [edit])

  const nextCell = useCallback((rowIndex: number, colIdx: number) => {
    let c = colIdx + 1
    let r = rowIndex
    if (c >= colOrder.length) {
      c = 0
      r = Math.min(rowIndex + 1, Math.max(0, pfmeaMiniRows.length - 1))
    }
    return { r, c }
  }, [colOrder, pfmeaMiniRows.length])

  const prevCell = useCallback((rowIndex: number, colIdx: number) => {
    let c = colIdx - 1
    let r = rowIndex
    if (c < 0) {
      c = colOrder.length - 1
      r = Math.max(rowIndex - 1, 0)
    }
    return { r, c }
  }, [colOrder])

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
    [colOrder, nextCell, pfmeaMiniRows, prevCell, stopEdit]
  )

  const pfmeaOpen = Boolean(pfmeaOpenOperationId)
  const flowHeight = pfmeaOpen ? '75vh' : '100vh'
  const panelHeight = pfmeaOpen ? '25vh' : '0px'

  if (moduleAccessState !== 'allowed') {
    return null
  }

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
          background: 'linear-gradient(180deg, rgba(88, 58, 39, 0.58), rgba(23, 31, 51, 0.86))',
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
      <PfdLeftRail
        canStartEdit={Boolean(currentUserId)}
        errorMessage={err}
        hasNodes={Boolean(nodes.length)}
        hasProject={Boolean(projectId)}
        isEditOwner={isEditOwner}
        isLockedByOther={isLockedByOther}
        isReadOnly={isReadOnly}
        lassoEnabled={lassoEnabled}
        loading={loading}
        selectedIsOperation={selectedIsOperation}
        sessionBusy={sessionBusy}
        zoomPct={zoomPct}
        onAddCircle={addCircleNearSelected}
        onAddDecision={addDecisionNearSelected}
        onAddFrame={addFrameNearSelected}
        onAddOperationAfterSelected={addOperationAfterSelected}
        onAddOperationAtEnd={addOperationAtEnd}
        onAddProcessRef={addProcessRefNearSelected}
        onAddStartStop={addStartStopNearSelected}
        onAddTriangle={addTriangleNearSelected}
        onCenterAll={centerAll}
        onDiscardDraft={() =>
          setConfirmDialog({
            title: 'Discard draft and close session',
            body: 'Are you sure? All unsaved draft changes will be permanently lost.',
            dangerNote: 'DRAFT CHANGES WILL BE LOST',
            onConfirm: async () => {
              await discardDraftAndCloseSession()
              return true
            },
          })
        }
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenSave={() => setSaveDialogOpen(true)}
        onResequenceOperations={resequenceOperations}
        onStartEditSession={startEditSession}
        onToggleLasso={() => setLassoEnabled((value) => !value)}
        onZoomStep={setZoomByStep}
      />
      <PfdFlowCanvas
        defaultEdgeOptions={defaultEdgeOptions}
        edges={edgesStyled}
        edgeTypes={edgeTypes}
        flowHeight={flowHeight}
        flowWrapRef={flowWrapRef}
        isEditOwner={isEditOwner}
        lassoEnabled={lassoEnabled}
        nodes={nodesWithHandlers}
        nodeTypes={nodeTypes}
        projectId={projectId}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onEdgeUpdate={onEdgeUpdate}
        onEdgeUpdateEnd={onEdgeUpdateEnd}
        onEdgesChange={onEdgesChange}
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
        onNodeClick={onNodeClick}
        onNodeDrag={onNodeDrag}
        onNodesChange={onNodesChange}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        onWheel={onWheelZoom}
      />

      <PfdMiniPfmeaPanel
        addMiniRow={addMiniRow}
        colIndex={colIndex}
        edit={edit}
        editRef={editRef}
        handleCellKeyDown={handleCellKeyDown}
        onClose={() => setPfmeaOpenOperationId(null)}
        panelHeight={panelHeight}
        pfmeaOpen={pfmeaOpen}
        pfmeaOpenOperationId={pfmeaOpenOperationId}
        projectId={projectId}
        rows={pfmeaMiniRows}
        selectedOperationLabel={selectedOperationLabel}
        startEdit={startEdit}
        stopEdit={stopEdit}
        updateMiniCell={updateMiniCell}
      />

      <PfdConfirmDialog
        busy={confirmBusy}
        dialog={confirmDialog}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={async () => {
          if (!confirmDialog || confirmBusy) return
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
      />

      <PfdDecisionConnectDialog
        dialog={decisionConnectDialog}
        onAdd={() => {
          if (!decisionConnectDialog) return
          const label = decisionConnectDialog.value.trim()
          commitConnection(
            decisionConnectDialog.params,
            decisionConnectDialog.key,
            label ? label : undefined
          )
          setDecisionConnectDialog(null)
        }}
        onCancel={() => setDecisionConnectDialog(null)}
        onValueChange={(value) =>
          setDecisionConnectDialog((cur) => (cur ? { ...cur, value } : cur))
        }
      />

      <PfdSaveDialog
        author={historyAuthor}
        busy={saveBusy}
        currentRevisionLabel={currentRevisionLabel}
        description={saveDesc}
        edgeCount={edges.length}
        nodeCount={nodes.length}
        open={saveDialogOpen}
        onCancel={() => setSaveDialogOpen(false)}
        onDescriptionChange={setSaveDesc}
        onSave={savePfdWithDescription}
      />

      <PfdHistoryDialog
        entries={historyEntries}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

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
