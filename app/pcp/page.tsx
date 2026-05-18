
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
  isPlaceholderPcpRowId,
  normalizeClassValue,
  normalizeText,
  uniqueSelectedPfmeaPcpSeedRowsWithRiskColor,
} from '@/features/pcp/pcp-utils'
import {
  EDIT_LOCK_MS,
  PCP_COLUMNS_BY_ID,
  PCP_COLUMN_FILTER_GROUPS,
  SURFACE_BG,
  SURFACE_BG_STRONG,
  SURFACE_BORDER,
  SURFACE_MUTED,
  SURFACE_RADIUS,
  SURFACE_TEXT,
  formatPcpLockRemainingText,
  getPcpEditState,
  getPcpWorkingRevision,
  makePcpPlaceholderRow,
  sortPcpRows,
} from '@/features/pcp/pcp-page-model'
import { PcpHistoryDialog, PcpSaveDialog } from '@/features/pcp/pcp-dialogs'
import { PcpTable } from '@/features/pcp/pcp-table'
import { usePcpEditSessionActions } from '@/features/pcp/use-pcp-edit-session-actions'
import { usePcpSaveRevision } from '@/features/pcp/use-pcp-save-revision'
import { usePcpVisibleColumns } from '@/features/pcp/use-pcp-visible-columns'
import {
  SettingsPageShell,
  SettingsSummaryGrid,
  SettingsSummaryTile,
  settingsCardStyle,
  settingsFrameStyle,
  settingsProcessAccent,
  settingsStatValueStyle,
} from '@/components/rf-ui'
import {
  backfillPcpRowsFromPfmea,
  ensurePcpProcessDraft,
  fetchLatestPfmeaRevisionIdForPcp,
  fetchPcpEditSession,
  fetchPcpOperations,
  fetchPcpProjectView,
  fetchPcpRevisionHistory,
  fetchPcpRiskMatrixContext,
  fetchPcpRowsForRevision,
  fetchPcpUserProjectRole,
  fetchPfmeaPcpSeedRows,
  findEquivalentPcpRowInRevision,
  getPcpSeedRiskColor,
  hydratePcpDraftRows,
  insertPcpRow,
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

  const loadPcpRiskMatrixContext = useCallback(async () => {
    if (!projectId) return null
    return fetchPcpRiskMatrixContext(supabase, projectId)
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
      const pcpRiskContext = await loadPcpRiskMatrixContext()
      const pcpYellowMax = pcpRiskContext?.thresholds.yellowMax ?? 168
      setPcpYellowMax(pcpYellowMax)
      const getSeedRiskColor = (seed: PfmeaPcpSeedRow) => pcpRiskContext ? getPcpSeedRiskColor(seed, pcpRiskContext) : null
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
      if (uniqueSelectedPfmeaPcpSeedRowsWithRiskColor(pfmeaSeedRows, pcpYellowMax, getSeedRiskColor).length === 0) {
        const fallbackRevisionIds = [
          pv.current_open_revision_id,
          await loadLatestPfmeaRevisionId(),
        ].filter((candidate, index, arr): candidate is string => !!candidate && arr.indexOf(candidate) === index && candidate !== revId)

        for (const fallbackRevisionId of fallbackRevisionIds) {
          pfmeaSeedRows = await loadPfmeaSeeds(fallbackRevisionId)
          if (uniqueSelectedPfmeaPcpSeedRowsWithRiskColor(pfmeaSeedRows, pcpYellowMax, getSeedRiskColor).length > 0) break
        }
      }

      const allSeedRowsByOperation = new Map<string, PfmeaPcpSeedRow[]>()
      for (const row of pfmeaSeedRows) {
        const items = allSeedRowsByOperation.get(row.operation_id) ?? []
        items.push(row)
        allSeedRowsByOperation.set(row.operation_id, items)
      }

      const seedRowsByOperation = new Map<string, PfmeaPcpSeedRow[]>()
      const seedRowsFiltered = uniqueSelectedPfmeaPcpSeedRowsWithRiskColor(pfmeaSeedRows, pcpYellowMax, getSeedRiskColor)
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
        const allPfmeaSeedIds = new Set((allSeedRowsByOperation.get(op.id) ?? []).map((seed) => seed.id))
        const pfmeaSeeds = seedRowsByOperation.get(op.id) ?? []
        const selectedPfmeaSeedIds = new Set(pfmeaSeeds.map((seed) => seed.id))
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
        const existingSorted = existing.filter((row) => {
          const linkedPfmeaRowId = normalizeText(row.pfmea_row_id)
          if (!linkedPfmeaRowId || !allPfmeaSeedIds.has(linkedPfmeaRowId)) return true
          return selectedPfmeaSeedIds.has(linkedPfmeaRowId)
        }).sort((a, b) => {
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
  }, [projectId, loadProjectView, loadPcpRiskMatrixContext, draftRevisionIdOverride, isEditOwner])
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

  const {
    handleSaveRevision,
    saveBusy,
  } = usePcpSaveRevision({
    currentAuthorName,
    isDirty,
    loadAll,
    loadEditSession,
    loadRevisionHistory,
    projectId,
    rowCount: rowsSorted.length,
    setDeletedIds,
    setDirtyIds,
    setDraftRevisionIdOverride,
    setError: setErr,
    supabase,
    userId,
  })

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

  const card: React.CSSProperties = { ...settingsCardStyle, color: SURFACE_TEXT }
  const frame: React.CSSProperties = settingsFrameStyle
  const summaryValue: React.CSSProperties = { ...settingsStatValueStyle, marginTop: 0, lineHeight: 1 }
  const processSummaryValue: React.CSSProperties = {
    ...summaryValue,
    alignItems: 'center',
    display: 'flex',
    fontSize: 22,
    justifyContent: 'center',
    lineHeight: 1.08,
    minHeight: 34,
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    textAlign: 'center',
    whiteSpace: 'normal',
  }

  if (moduleAccessState !== 'allowed') {
    return null
  }

  return (
    <SettingsPageShell
      title="PCP"
      titleStyle={{ color: settingsProcessAccent }}
      subtitle="Manage the Production Control Plan for the selected process and publish PCP revisions."
      summary={
        <SettingsSummaryGrid columns={3} maxWidth={390}>
          <SettingsSummaryTile label="Process" value={project?.name ?? '-'} valueStyle={processSummaryValue} />
          <SettingsSummaryTile label="Revision" value={(workingRevisionLabel ?? '-').split('.').at(-1) ?? '-'} valueStyle={summaryValue} />
          <SettingsSummaryTile label="PCP rows" value={rowsSorted.length} valueStyle={summaryValue} />
        </SettingsSummaryGrid>
      }
    >
      <style jsx global>{`
        .pcpTable ::selection,
        .pcpTable .pfmeaEditor::selection {
          background: rgba(148, 163, 184, 0.38);
          color: #f8fafc;
        }
        .pcpTable ::-moz-selection,
        .pcpTable .pfmeaEditor::-moz-selection {
          background: rgba(148, 163, 184, 0.38);
          color: #f8fafc;
        }
        .pcpTable .pfmeaEditor,
        .pcpTable .pfmeaEditor:focus {
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
        .pcpTable input.pfmeaEditor {
          height: 1.25em !important;
        }
        .pcpTable textarea.pfmeaEditor {
          white-space: pre-wrap !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          resize: none !important;
          overflow: hidden !important;
          min-height: 1.25em !important;
          height: 1.25em !important;
        }
        .pcpTd.singleLine.editable {
          height: 45px;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
        }
        .pcpTd.singleLine { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pcpTd.center { text-align: center; }
        .pcpTd.editable { cursor: text; position: relative; transition: background 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease; }
        .pcpTd.editable:hover,
        .pcpTd.editable:focus-within { background: rgba(255,255,255,0.065) !important; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18); border-radius: 0; }
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

      <div style={{ ...frame, marginTop: 10, marginBottom: 16 }}>
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

      <PcpTable
        cardStyle={card}
        edit={edit}
        isColumnVisible={isColumnVisible}
        pcpYellowMax={pcpYellowMax}
        readOnly={readOnly}
        rows={rowsSorted}
        setEdit={setEdit}
        updateRow={updateRow}
        visibleColumnDefs={visibleColumnDefs}
        visibleTableWidth={visibleTableWidth}
        widthOf={widthOf}
      />
      </div>

      {showSave ? (
        <PcpSaveDialog
          actionButtonStyle={actionBtn}
          currentAuthorName={currentAuthorName}
          onClose={() => setShowSave(false)}
          onSaveClick={() => {
            void handleSaveRevision(saveDescription).then((saved) => {
              if (!saved) return
              setShowSave(false)
              setSaveDescription('')
            })
          }}
          rowCount={rowsSorted.length}
          saveBusy={saveBusy}
          saveDescription={saveDescription}
          setSaveDescription={setSaveDescription}
          workingRevisionLabel={workingRevisionLabel}
        />
      ) : null}

      {historyOpen ? (
        <PcpHistoryDialog
          actionButtonStyle={actionBtn}
          entries={historyEntries}
          loading={historyLoading}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
    </SettingsPageShell>
  )
}

const smallBtn: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, border: `1px solid ${SURFACE_BORDER}`, fontSize: 11, height: 24 }
const actionBtn: React.CSSProperties = { padding: '6px 10px', borderRadius: SURFACE_RADIUS, border: `1px solid ${SURFACE_BORDER}`, fontWeight: 650, fontSize: 12, color: SURFACE_TEXT, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', background: SURFACE_BG }

function PcpPageFallback() {
  return (
    <div style={{ padding: 24, color: '#666', fontSize: 14, fontWeight: 700 }}>
      Loading PCP...
    </div>
  )
}

