
'use client'

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@app/lib/supabaseBrowser'
import { hasCustomerModuleAccess, loadOwnCustomerAccessMap } from '@/lib/customer-access'
import {
  asInt1to10,
  buildPcpRowPayload,
  getComparableTime,
  isEquivalentPcpRow,
  isPfmeaSeedSelectedForPcp,
  isPlaceholderPcpRowId,
  nextPcpRevisionLabel,
  normalizeClassValue,
  normalizeText,
} from '@/features/pcp/pcp-utils'
import {
  EDIT_LOCK_MS,
  PCP_COLUMNS_BY_ID,
  PCP_COLUMN_FILTER_GROUPS,
  SURFACE_BG,
  SURFACE_BG_STRONG,
  SURFACE_BORDER,
  SURFACE_MUTED,
  SURFACE_PANEL_BG,
  SURFACE_RADIUS,
  SURFACE_TEXT,
  formatDateTimePL,
  formatPcpLockRemainingText,
  getPcpEditState,
  getPcpWorkingRevision,
  makePcpPlaceholderRow,
  sortPcpRows,
} from '@/features/pcp/pcp-page-model'
import { SummaryCard, TdClassPopup, TdRead, TdText, Th } from '@/features/pcp/pcp-table-cells'
import { usePcpEditSessionActions } from '@/features/pcp/use-pcp-edit-session-actions'
import { usePcpVisibleColumns } from '@/features/pcp/use-pcp-visible-columns'
import {
  backfillPcpRowsFromPfmea,
  deletePcpEditSession,
  ensurePcpProcessDraft,
  fetchLatestPfmeaRevisionIdForPcp,
  fetchPcpEditSession,
  fetchPcpOperations,
  fetchPcpProjectView,
  fetchPcpRevisionHistory,
  fetchPcpRowsForRevision,
  fetchPcpSelectionThreshold,
  fetchPcpUserProjectRole,
  fetchPfmeaPcpSeedRows,
  findEquivalentPcpRowInRevision,
  hydratePcpDraftRows,
  insertPcpRow,
  publishPcpRevision,
  touchPcpEditSession,
  updatePcpRow,
  type PcpEditSession,
  type PcpHistoryEntry,
  type PcpProjectView as ProjectView,
  type PcpRow,
  type PfmeaPcpSeedRow,
} from '@/features/pcp/pcp-service'

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
  const [err, setErr] = useState('')

  const [userId, setUserId] = useState<string | null>(null)
  const [moduleAccessState, setModuleAccessState] = useState<'checking' | 'allowed' | 'denied'>('checking')
  const [currentAuthorName, setCurrentAuthorName] = useState('Unknown user')
  const [isChampion, setIsChampion] = useState(false)

  const [project, setProject] = useState<ProjectView | null>(null)
  const [draftRevisionIdOverride, setDraftRevisionIdOverride] = useState<string | null>(null)
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

  const [pcpYellowMax, setPcpYellowMax] = useState(168)

  const [edit, setEdit] = useState<{ rowId: string; col: keyof PcpRow } | null>(null)

  const isDirty = dirtyIds.length > 0 || deletedIds.length > 0
  const {
    isObsolete,
    isEditOwner,
    isLockedByOther,
    readOnly,
  } = useMemo(() => getPcpEditState({
    editSession,
    now: sessionNow,
    projectStatus: project?.status,
    userId,
  }), [editSession, project?.status, sessionNow, userId])

  const lockRemainingText = useMemo(
    () => (isLockedByOther ? formatPcpLockRemainingText(editSession, sessionNow) : ''),
    [editSession, isLockedByOther, sessionNow]
  )

  const markDirty = useCallback((id: string) => {
    setDirtyIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const { workingRevisionId, workingRevisionLabel } = useMemo(
    () => getPcpWorkingRevision(project, draftRevisionIdOverride),
    [draftRevisionIdOverride, project]
  )

  const {
    clearColumnGroup,
    columnFiltersOpen,
    isColumnVisible,
    setColumnFiltersOpen,
    toggleColumnVisibility,
    uncheckColumnGroup,
    visibleColumnDefs,
    visibleTableWidth,
    widthOf,
  } = usePcpVisibleColumns(userId)

  const rowsSorted = useMemo(() => sortPcpRows(rows), [rows])

  const loadProjectView = useCallback(async () => {
    const view = await fetchPcpProjectView(supabase, projectId)
    setProject(view)
    if (view.current_draft_revision_id) setDraftRevisionIdOverride(view.current_draft_revision_id)
    return view
  }, [projectId])

  const loadEditSession = useCallback(async () => {
    if (!projectId) {
      setEditSession(null)
      return
    }
    setEditSession(await fetchPcpEditSession(supabase, projectId))
  }, [projectId])

  const loadPcpSelectionThreshold = useCallback(async () => {
    if (!projectId) return 168
    return fetchPcpSelectionThreshold(supabase, projectId)
  }, [projectId])

  const ensureDraftRowsHydrated = useCallback(async (draftRevisionId: string | null | undefined, sourceRevisionId: string | null | undefined) => {
    await hydratePcpDraftRows(supabase, draftRevisionId, sourceRevisionId)
  }, [])

  const findEquivalentRowInRevision = useCallback(async (row: PcpRow, revisionId: string) => {
    return findEquivalentPcpRowInRevision(supabase, row, revisionId)
  }, [])

  const loadUserContext = useCallback(async () => {
    if (!projectId || !userId) {
      setIsChampion(false)
      return
    }
    const role = (await fetchPcpUserProjectRole(supabase, projectId, userId) ?? '').toLowerCase()
    setIsChampion(role === 'champion')
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

    const ensuredDraftId = await ensurePcpProcessDraft(supabase, projectId, userId)

    const pv = await loadProjectView()
    const ensured = pv.current_draft_revision_id ?? ensuredDraftId
    if (ensured) setDraftRevisionIdOverride(ensured)
    await ensureDraftRowsHydrated(ensured, pv.current_open_revision_id ?? workingRevisionId)
    return ensured
  }, [projectId, userId, isEditOwner, draftRevisionIdOverride, project?.current_draft_revision_id, project?.current_open_revision_id, project?.status, loadProjectView, ensureDraftRowsHydrated, workingRevisionId])

  const loadAll = useCallback(async (forceRevisionId?: string | null) => {
    if (!projectId) return
    setErr('')
    try {
      const pv = await loadProjectView()
      const pcpYellowMax = await loadPcpSelectionThreshold()
      setPcpYellowMax(pcpYellowMax)
      const operations = await fetchPcpOperations(supabase, projectId)

      const openRevId = pv.current_open_revision_id ?? null
      const draftRevId = draftRevisionIdOverride ?? pv.current_draft_revision_id ?? null
      let revId = forceRevisionId ?? null
      if (!revId) revId = isEditOwner ? draftRevId ?? openRevId : openRevId ?? draftRevId

      if (!revId) {
        setRows([])
        return
      }

      const normalizedRows = await fetchPcpRowsForRevision(supabase, projectId, revId)
      const loadPfmeaSeeds = async (seedRevisionId: string) => {
        return fetchPfmeaPcpSeedRows(supabase, projectId, seedRevisionId)
      }

      const loadLatestPfmeaRevisionId = async () => {
        return fetchLatestPfmeaRevisionIdForPcp(supabase, projectId)
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

      const seedRowsByOperation = new Map<string, PfmeaPcpSeedRow[]>()
      const seedRowsFiltered = pfmeaSeedRows.filter((row) => isPfmeaSeedSelectedForPcp(row, pcpYellowMax))
      for (const row of seedRowsFiltered) {
        const items = seedRowsByOperation.get(row.operation_id) ?? []
        items.push(row)
        seedRowsByOperation.set(row.operation_id, items)
      }

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
                characteristic: seed.characteristic ?? '',
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
        await backfillPcpRowsFromPfmea(supabase, pfmeaBackfillCandidates)

        setDirtyIds((prev) => {
          const next = new Set(prev)
          pfmeaBackfillCandidates.forEach((candidate) => next.add(candidate.id))
          return Array.from(next)
        })
      }

      setRows(mergedRows)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }, [projectId, loadProjectView, loadPcpSelectionThreshold, draftRevisionIdOverride, isEditOwner])
  const loadRevisionHistory = useCallback(async () => {
    if (!projectId) {
      setHistoryEntries([])
      return
    }
    setHistoryLoading(true)
    try {
      setHistoryEntries(await fetchPcpRevisionHistory(supabase, projectId))
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setHistoryEntries([])
    } finally {
      setHistoryLoading(false)
    }
  }, [projectId])

  const {
    discardDraftAndCloseSession,
    startEditSession,
  } = usePcpEditSessionActions({
    draftRevisionIdOverride,
    editLockMs: EDIT_LOCK_MS,
    isChampion,
    isEditOwner,
    isObsolete,
    loadAll,
    loadEditSession,
    projectId,
    sessionNow,
    setDeletedIds,
    setDirtyIds,
    setDraftRevisionIdOverride,
    setError: setErr,
    setSessionBusy,
    setSessionMsg,
    supabase,
    userId,
  })

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
        const rowSource = {
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
        }
        const insertPayload = buildPcpRowPayload(rowSource)
        const ins = await insertPcpRow(supabase, rowSource)
        const newId = ins.id
        markDirty(newId)
        setRows((prev) =>
          prev.map((x) =>
            x.id === row.id
              ? ({
                  ...row,
                  ...insertPayload,
                  id: newId,
                  created_at: ins.created_at ?? new Date().toISOString(),
                  updated_at: ins.updated_at ?? new Date().toISOString(),
                  revision_id: finalRev,
                  __placeholder: false,
                } as PcpRow)
              : x
          )
        )
      } else {
        await updatePcpRow(supabase, targetRow.id, finalRev, payload)
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

  const handleSaveRevision = useCallback(async (descInput?: string) => {
    if (saveBusy) return false
    if (!isDirty) {
      return false
    }
    const desc = (descInput ?? '').trim()
    if (!desc) {
      setErr('Change description is required.')
      return false
    }
    try {
      setSaveBusy(true)
      setErr('')
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess?.session?.user?.id
      if (!uid) throw new Error('Not authenticated.')

      await publishPcpRevision(supabase, {
        authorId: uid,
        authorName: currentAuthorName || 'Unknown user',
        changeDescription: desc,
        controlCount: rowsSorted.length,
        projectId,
      })

      setDirtyIds([])
      setDeletedIds([])
      setDraftRevisionIdOverride(null)
      if (projectId && userId) await deletePcpEditSession(supabase, projectId, userId)
      await loadAll()
      await loadRevisionHistory()
      await loadEditSession()
      return true
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      return false
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
    let alive = true

    void (async () => {
      if (!projectId || !userId) return

      const headerRes = await supabase.rpc('get_my_header').maybeSingle()
      const header = (headerRes.data as { org_role?: string | null } | null) ?? null
      const role = (header?.org_role ?? '').toLowerCase()

      if (role !== 'customer') {
        if (alive) setModuleAccessState('allowed')
        return
      }

      try {
        const accessMap = await loadOwnCustomerAccessMap(userId, [projectId])
        const canReadPcp = hasCustomerModuleAccess(accessMap, projectId, 'PCP')
        if (!alive) return

        if (!canReadPcp) {
          setModuleAccessState('denied')
          window.location.assign('/projects')
          return
        }

        setModuleAccessState('allowed')
      } catch {
        if (!alive) return
        setModuleAccessState('denied')
        window.location.assign('/projects')
      }
    })()

    return () => {
      alive = false
    }
  }, [projectId, userId])

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
    if (moduleAccessState !== 'allowed') return
    void loadUserContext()
    void loadEditSession()
  }, [projectId, userId, loadUserContext, loadEditSession, moduleAccessState])

  useEffect(() => {
    if (!projectId) return
    if (moduleAccessState !== 'allowed') return
    loadAll()
  }, [projectId, isEditOwner, draftRevisionIdOverride, loadAll, moduleAccessState])

  useEffect(() => {
    if (!projectId) return
    if (moduleAccessState !== 'allowed') return
    const t = setInterval(() => {
      void loadEditSession()
      setSessionNow(Date.now())
    }, 30_000)
    return () => clearInterval(t)
  }, [projectId, loadEditSession, moduleAccessState])

  useEffect(() => {
    if (!projectId || !userId || !isEditOwner) return
    const beat = setInterval(() => {
      void touchPcpEditSession(supabase, projectId, userId, new Date().toISOString())
    }, 30_000)
    return () => clearInterval(beat)
  }, [projectId, userId, isEditOwner])

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

  if (moduleAccessState !== 'allowed') {
    return null
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
          background: 'linear-gradient(180deg, rgba(88, 58, 39, 0.58), rgba(23, 31, 51, 0.86))',
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
              <button className="rf-button" style={{ ...actionBtn, padding: '8px 12px', height: 29 }} onClick={() => { void handleSaveRevision(saveDescription).then((saved) => { if (!saved) return; setShowSave(false); setSaveDescription('') }) }} disabled={saveBusy || !saveDescription.trim()}>{saveBusy ? 'Saving...' : 'Save'}</button>
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

