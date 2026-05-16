import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  PFMEA_CLONE_FIELDS,
  PFMEA_CLONE_FIELDS_LEGACY,
  PFMEA_SELECT_FIELDS,
  PFMEA_SELECT_FIELDS_LEGACY,
  isMissingPfmeaGroupIdColumnError,
  stripPfmeaGroupIdsFromPayload,
} from './pfmea-payload-utils'
import { isPlaceholderRowId } from './pfmea-hierarchy-utils'
import { getOperationNodeIdsFromDiagram } from './pfmea-operation-utils'
import { reindexPfmeaRows } from './pfmea-row-order-utils'
import { hydratePfmeaGroupIds } from './pfmea-row-normalization-utils'
import {
  deletePfmeaRowsByRevision,
  ensurePfmeaProcessDraft,
  fetchPfmeaProjectView,
} from './pfmea-service'
import type { NewRowDraft, Operation, PfdDiagramRow, PfmeaRow, ProjectView } from './pfmea-types'

export type UsePfmeaRevisionControllerParams = {
  clearPfmeaTransientTracking: () => void
  draft: NewRowDraft
  draftRevisionIdOverride: string | null
  forceRefreshExistingDraftFromOpenRef: MutableRefObject<boolean>
  isEditOwner: boolean
  loadRiskMatrix: () => Promise<void>
  loadScaleOptions: () => Promise<void>
  opFromUrl: string
  persistedDirtyDraft: boolean
  pfmeaGroupIdsSupportedRef: MutableRefObject<boolean | null>
  project: ProjectView | null
  projectId: string
  rowsRef: MutableRefObject<PfmeaRow[]>
  setDraft: Dispatch<SetStateAction<NewRowDraft>>
  setDraftRevisionIdOverride: Dispatch<SetStateAction<string | null>>
  setErr: Dispatch<SetStateAction<string>>
  setOps: Dispatch<SetStateAction<Operation[]>>
  setProject: Dispatch<SetStateAction<ProjectView | null>>
  setRows: Dispatch<SetStateAction<PfmeaRow[]>>
  supabase: SupabaseClient
  userId: string | null
  workingRevisionId: string | null
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return String(error)
}

export function usePfmeaRevisionController(params: UsePfmeaRevisionControllerParams) {
  const {
    clearPfmeaTransientTracking,
    draft,
    draftRevisionIdOverride,
    forceRefreshExistingDraftFromOpenRef,
    isEditOwner,
    loadRiskMatrix,
    loadScaleOptions,
    opFromUrl,
    persistedDirtyDraft,
    pfmeaGroupIdsSupportedRef,
    project,
    projectId,
    rowsRef,
    setDraft,
    setDraftRevisionIdOverride,
    setErr,
    setOps,
    setProject,
    setRows,
    supabase,
    userId,
    workingRevisionId,
  } = params

  const loadProjectView = useCallback(async (options?: { syncDraftOverride?: boolean }) => {
    const view = await fetchPfmeaProjectView(supabase, projectId)
    setProject(view as ProjectView)
    if (options?.syncDraftOverride === true && view.current_draft_revision_id) {
      setDraftRevisionIdOverride(view.current_draft_revision_id)
    }
    return view
  }, [projectId, setDraftRevisionIdOverride, setProject, supabase])

  const ensureDraftIfNeeded = useCallback(async () => {
    if (!projectId) return null
    if (!userId) throw new Error('Not authenticated.')
    if (!isEditOwner) throw new Error('Click "Edit PFMEA" to start an edit session.')
    const sourceRevisionIdBeforeDraft = project?.current_open_revision_id ?? workingRevisionId ?? null

    const ensureDraftRowsHydrated = async (
      draftRevisionId: string | null,
      sourceRevisionId: string | null,
      options?: { replaceExisting?: boolean }
    ) => {
      if (!draftRevisionId || !sourceRevisionId || draftRevisionId === sourceRevisionId) return

      const existingDraftRowsRes = await supabase
        .from('pfmea_rows')
        .select('id')
        .eq('revision_id', draftRevisionId)
        .limit(1)

      if (existingDraftRowsRes.error) throw existingDraftRowsRes.error
      const hasExistingDraftRows = (existingDraftRowsRes.data?.length ?? 0) > 0
      if (hasExistingDraftRows && !options?.replaceExisting) return
      if (hasExistingDraftRows && options?.replaceExisting) {
        await deletePfmeaRowsByRevision(supabase, draftRevisionId)
      }

      const openRowsRes = await supabase
        .from('pfmea_rows')
        .select((pfmeaGroupIdsSupportedRef.current === false ? PFMEA_CLONE_FIELDS_LEGACY : PFMEA_CLONE_FIELDS).join(','))
        .eq('revision_id', sourceRevisionId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      let sourceRows: Array<Partial<PfmeaRow>> = []
      if (openRowsRes.error && isMissingPfmeaGroupIdColumnError(openRowsRes.error)) {
        pfmeaGroupIdsSupportedRef.current = false
        const legacyOpenRowsRes = await supabase
          .from('pfmea_rows')
          .select(PFMEA_CLONE_FIELDS_LEGACY.join(','))
          .eq('revision_id', sourceRevisionId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
        if (legacyOpenRowsRes.error) throw legacyOpenRowsRes.error
        sourceRows = (legacyOpenRowsRes.data ?? []) as Array<Partial<PfmeaRow>>
      } else {
        if (openRowsRes.error) throw openRowsRes.error
        pfmeaGroupIdsSupportedRef.current = true
        sourceRows = (openRowsRes.data ?? []) as Array<Partial<PfmeaRow>>
      }
      if (sourceRows.length === 0) {
        sourceRows = rowsRef.current.map((row) => {
          const sourceRow = {} as Partial<PfmeaRow>
          for (const field of PFMEA_CLONE_FIELDS) {
            sourceRow[field] = row[field] as never
          }
          return sourceRow
        })
      }
      if (sourceRows.length === 0) return

      const clonePayload = sourceRows.map((sourceRow) => {
        const clonedRow = { revision_id: draftRevisionId } as Partial<PfmeaRow> & { revision_id: string }
        for (const field of PFMEA_CLONE_FIELDS) {
          ;(clonedRow as Record<string, unknown>)[field] = sourceRow[field]
        }
        return clonedRow
      })

      const insertClonePayload =
        pfmeaGroupIdsSupportedRef.current === false
          ? clonePayload.map((row) => stripPfmeaGroupIdsFromPayload(row as Record<string, unknown>))
          : clonePayload

      const insertCloneRes = await supabase.from('pfmea_rows').insert(insertClonePayload)
      if (insertCloneRes.error) throw insertCloneRes.error
    }

    const hasVisibleRowsFromCurrentDraft =
      !!(project?.current_draft_revision_id || draftRevisionIdOverride) &&
      rowsRef.current.some(
        (row) =>
          !isPlaceholderRowId(row.id) &&
          row.revision_id === (draftRevisionIdOverride ?? project?.current_draft_revision_id ?? null)
      )
    const shouldRefreshExistingDraftFromOpen =
      !!project?.current_open_revision_id &&
      !!(draftRevisionIdOverride ?? project?.current_draft_revision_id) &&
      (
        forceRefreshExistingDraftFromOpenRef.current ||
        (!persistedDirtyDraft && !hasVisibleRowsFromCurrentDraft)
      )

    if (draftRevisionIdOverride) {
      await ensureDraftRowsHydrated(draftRevisionIdOverride, project?.current_open_revision_id ?? sourceRevisionIdBeforeDraft, {
        replaceExisting: shouldRefreshExistingDraftFromOpen,
      })
      forceRefreshExistingDraftFromOpenRef.current = false
      return draftRevisionIdOverride
    }
    if (project?.current_draft_revision_id) {
      await ensureDraftRowsHydrated(project.current_draft_revision_id, project.current_open_revision_id ?? sourceRevisionIdBeforeDraft, {
        replaceExisting: shouldRefreshExistingDraftFromOpen,
      })
      forceRefreshExistingDraftFromOpenRef.current = false
      return project.current_draft_revision_id
    }

    if ((project?.status ?? 'DRAFT') === 'OBSOLETE') throw new Error('Process is OBSOLETE (read-only).')

    const ensuredDraftId = await ensurePfmeaProcessDraft(supabase, projectId, userId)
    const pv = await loadProjectView({ syncDraftOverride: false })
    const ensured = pv.current_draft_revision_id ?? ensuredDraftId
    await ensureDraftRowsHydrated(ensured, pv.current_open_revision_id ?? sourceRevisionIdBeforeDraft)
    forceRefreshExistingDraftFromOpenRef.current = false
    if (ensured) setDraftRevisionIdOverride(ensured)
    return ensured
  }, [
    draftRevisionIdOverride,
    forceRefreshExistingDraftFromOpenRef,
    isEditOwner,
    loadProjectView,
    persistedDirtyDraft,
    pfmeaGroupIdsSupportedRef,
    project,
    projectId,
    rowsRef,
    setDraftRevisionIdOverride,
    supabase,
    userId,
    workingRevisionId,
  ])

  const loadAll = useCallback(async (forceRevisionId?: string | null) => {
    if (!projectId) return
    setErr('')

    try {
      const fetchPfmeaRowsForRevision = async (revisionId: string) => {
        const selectFields = pfmeaGroupIdsSupportedRef.current === false ? PFMEA_SELECT_FIELDS_LEGACY : PFMEA_SELECT_FIELDS
        let response = await supabase
          .from('pfmea_rows')
          .select(selectFields)
          .eq('operations.project_id', projectId)
          .eq('revision_id', revisionId)
          .order('operation_number', { foreignTable: 'operations', ascending: true })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })

        if (response.error && isMissingPfmeaGroupIdColumnError(response.error)) {
          pfmeaGroupIdsSupportedRef.current = false
          response = await supabase
            .from('pfmea_rows')
            .select(PFMEA_SELECT_FIELDS_LEGACY)
            .eq('operations.project_id', projectId)
            .eq('revision_id', revisionId)
            .order('operation_number', { foreignTable: 'operations', ascending: true })
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
        } else if (!response.error && pfmeaGroupIdsSupportedRef.current !== false) {
          pfmeaGroupIdsSupportedRef.current = true
        }

        if (response.error) throw response.error
        return (response.data ?? []) as unknown as PfmeaRow[]
      }

      const [pv, pfdDiagRes] = await Promise.all([
        loadProjectView(),
        supabase.from('pfd_diagrams').select('nodes').eq('project_id', projectId).maybeSingle(),
        loadRiskMatrix(),
        loadScaleOptions(),
      ])

      const diagramOperationIds =
        pfdDiagRes.error ? new Set<string>() : getOperationNodeIdsFromDiagram((pfdDiagRes.data ?? null) as PfdDiagramRow | null)
      const useDiagramOperationFilter = diagramOperationIds.size > 0

      const opsRes = await supabase
        .from('operations')
        .select('id,project_id,operation_number,name,machine,operation,active')
        .eq('project_id', projectId)
        .eq('active', true)
        .order('operation_number', { ascending: true })

      if (opsRes.error) throw opsRes.error

      const operations = ((opsRes.data ?? []) as Operation[]).filter((op) => !useDiagramOperationFilter || diagramOperationIds.has(op.id))
      setOps(operations)
      if (!isEditOwner && !forceRevisionId && draftRevisionIdOverride && pv.current_open_revision_id) {
        setDraftRevisionIdOverride(null)
      }

      const openRevId = pv.current_open_revision_id ?? null
      const draftRevId = draftRevisionIdOverride ?? pv.current_draft_revision_id ?? null
      let revId = forceRevisionId ?? null
      if (!revId) {
        revId = isEditOwner ? draftRevId ?? openRevId : openRevId ?? draftRevId
      }

      if (!revId) {
        clearPfmeaTransientTracking()
        rowsRef.current = []
        setRows([])
        return
      }

      let pfmeaRows = await fetchPfmeaRowsForRevision(revId)
      if (useDiagramOperationFilter) {
        pfmeaRows = pfmeaRows.filter((row) => {
          const opId = row.operation_id || row.operations?.id || ''
          return !!opId && diagramOperationIds.has(opId)
        })
      }

      if (pfmeaRows.length === 0 && isEditOwner && draftRevId && revId === draftRevId && openRevId && openRevId !== draftRevId) {
        try {
          pfmeaRows = await fetchPfmeaRowsForRevision(openRevId)
          if (useDiagramOperationFilter) {
            pfmeaRows = pfmeaRows.filter((row) => {
              const opId = row.operation_id || row.operations?.id || ''
              return !!opId && diagramOperationIds.has(opId)
            })
          }
        } catch {}
      }

      if (pfmeaRows.length === 0) {
        const latestRevRes = await supabase
          .from('pfmea_rows')
          .select('revision_id,created_at,operations!inner(project_id,active)')
          .eq('operations.project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1)

        if (!latestRevRes.error) {
          const fallbackRevisionId =
            (((latestRevRes.data ?? [])[0] as { revision_id?: string | null } | undefined)?.revision_id ?? '').trim() || null

          if (fallbackRevisionId && fallbackRevisionId !== revId) {
            try {
              pfmeaRows = await fetchPfmeaRowsForRevision(fallbackRevisionId)
              if (useDiagramOperationFilter) {
                pfmeaRows = pfmeaRows.filter((row) => {
                  const opId = row.operation_id || row.operations?.id || ''
                  return !!opId && diagramOperationIds.has(opId)
                })
              }
              if (pfmeaRows.length > 0 && isEditOwner) {
                setDraftRevisionIdOverride(fallbackRevisionId)
              }
            } catch {}
          }
        }
      }

      clearPfmeaTransientTracking()
      const nextRows = reindexPfmeaRows(hydratePfmeaGroupIds(pfmeaRows))
      rowsRef.current = nextRows
      setRows(nextRows)

      if (opFromUrl) {
        const exists = operations.some((o) => o.id === opFromUrl)
        if (exists) {
          setDraft({ operation_id: opFromUrl })
          return
        }
      }

      if (!draft.operation_id && operations.length > 0) {
        setDraft({ operation_id: operations[0].id })
      }
    } catch (error: unknown) {
      setErr(errorMessage(error))
    }
  }, [
    clearPfmeaTransientTracking,
    draft.operation_id,
    draftRevisionIdOverride,
    isEditOwner,
    loadProjectView,
    loadRiskMatrix,
    loadScaleOptions,
    opFromUrl,
    pfmeaGroupIdsSupportedRef,
    projectId,
    rowsRef,
    setDraft,
    setDraftRevisionIdOverride,
    setErr,
    setOps,
    setRows,
    supabase,
  ])

  return {
    ensureDraftIfNeeded,
    loadAll,
    loadProjectView,
  }
}
