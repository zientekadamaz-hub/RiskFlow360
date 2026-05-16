import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { hasCustomerModuleAccess, loadOwnCustomerAccessMap } from '@/lib/customer-access'
import {
  fetchPfmeaAuthorName,
  fetchPfmeaEditSession,
  fetchPfmeaProjectRole,
  type PfmeaEditSession,
} from './pfmea-service'
import type { ProjectView } from './pfmea-types'

export type PfmeaModuleAccessState = 'checking' | 'allowed' | 'denied'

export type UsePfmeaSessionControllerParams = {
  draftRevisionIdOverride: string | null
  editLockMs: number
  project: ProjectView | null
  projectId: string
  supabase: SupabaseClient
}

export type PfmeaSessionController = {
  activeDraftRevisionId: string | null
  currentAuthorName: string
  editSession: PfmeaEditSession | null
  isChampion: boolean
  isEditOwner: boolean
  isLockedByOther: boolean
  isObsolete: boolean
  loadEditSession: () => Promise<void>
  loadUserContext: () => Promise<void>
  moduleAccessState: PfmeaModuleAccessState
  readOnly: boolean
  sessionBusy: boolean
  sessionExpired: boolean
  sessionNow: number
  setEditSession: Dispatch<SetStateAction<PfmeaEditSession | null>>
  setSessionBusy: Dispatch<SetStateAction<boolean>>
  setSessionNow: Dispatch<SetStateAction<number>>
  userId: string | null
  workingRevisionId: string | null
  workingRevisionLabel: string | null | undefined
}

export function usePfmeaSessionController(params: UsePfmeaSessionControllerParams): PfmeaSessionController {
  const [userId, setUserId] = useState<string | null>(null)
  const [moduleAccessState, setModuleAccessState] = useState<PfmeaModuleAccessState>('checking')
  const [currentAuthorName, setCurrentAuthorName] = useState('Unknown user')
  const [isChampion, setIsChampion] = useState(false)
  const [editSession, setEditSession] = useState<PfmeaEditSession | null>(null)
  const [sessionNow, setSessionNow] = useState(() => Date.now())
  const [sessionBusy, setSessionBusy] = useState(false)

  const isObsolete = (params.project?.status ?? 'DRAFT') === 'OBSOLETE'
  const sessionExpired = useMemo(() => {
    if (!editSession) return false
    const last = new Date(editSession.lastActivityAt).getTime()
    if (!Number.isFinite(last)) return true
    return sessionNow - last >= params.editLockMs
  }, [editSession, params.editLockMs, sessionNow])
  const isEditOwner = !!userId && !!editSession && editSession.lockedBy === userId && !sessionExpired
  const isLockedByOther = !!editSession && !isEditOwner && !sessionExpired
  const readOnly = isObsolete || !isEditOwner
  const activeDraftRevisionId = params.draftRevisionIdOverride ?? params.project?.current_draft_revision_id ?? null
  const workingRevisionId = isEditOwner
    ? activeDraftRevisionId ?? params.project?.current_open_revision_id ?? null
    : params.project?.current_open_revision_id ?? activeDraftRevisionId
  const workingRevisionLabel = isEditOwner
    ? params.project?.draft_revision_label ?? params.project?.open_revision_label
    : params.project?.open_revision_label ?? params.project?.draft_revision_label

  useEffect(() => {
    let alive = true

    ;(async () => {
      const { data } = await params.supabase.auth.getSession()
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
  }, [params.supabase])

  useEffect(() => {
    let alive = true

    void (async () => {
      if (!params.projectId || !userId) return

      const headerRes = await params.supabase.rpc('get_my_header').maybeSingle()
      const header = (headerRes.data as { org_role?: string | null } | null) ?? null
      const role = (header?.org_role ?? '').toLowerCase()

      if (role !== 'customer') {
        if (alive) setModuleAccessState('allowed')
        return
      }

      try {
        const accessMap = await loadOwnCustomerAccessMap(userId, [params.projectId])
        const canReadPfmea = hasCustomerModuleAccess(accessMap, params.projectId, 'PFMEA')
        if (!alive) return

        if (!canReadPfmea) {
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
  }, [params.projectId, params.supabase, userId])

  useEffect(() => {
    let alive = true
    if (!userId) {
      return () => {
        alive = false
      }
    }

    ;(async () => {
      try {
        const authorName = await fetchPfmeaAuthorName(params.supabase, userId)
        if (!alive) return
        setCurrentAuthorName(authorName)
      } catch {
        if (!alive) return
        setCurrentAuthorName('Unknown user')
      }
    })()

    return () => {
      alive = false
    }
  }, [params.supabase, userId])

  const loadUserContext = useCallback(async () => {
    if (!params.projectId || !userId) {
      setIsChampion(false)
      return
    }
    try {
      const role = (await fetchPfmeaProjectRole(params.supabase, params.projectId, userId) ?? '').toLowerCase()
      setIsChampion(role === 'champion')
    } catch {
      setIsChampion(false)
    }
  }, [params.projectId, params.supabase, userId])

  const loadEditSession = useCallback(async () => {
    if (!params.projectId) {
      setEditSession(null)
      return
    }
    try {
      setEditSession(await fetchPfmeaEditSession(params.supabase, params.projectId))
    } catch {
      setEditSession(null)
    }
  }, [params.projectId, params.supabase])

  useEffect(() => {
    if (!params.projectId) return
    if (moduleAccessState !== 'allowed') return
    const timer = setTimeout(() => {
      void loadUserContext()
      void loadEditSession()
    }, 0)
    return () => clearTimeout(timer)
  }, [params.projectId, loadUserContext, loadEditSession, moduleAccessState])

  useEffect(() => {
    if (!params.projectId) return
    if (moduleAccessState !== 'allowed') return
    const timer = setInterval(() => {
      void loadEditSession()
      setSessionNow(Date.now())
    }, 30_000)
    return () => clearInterval(timer)
  }, [params.projectId, loadEditSession, moduleAccessState])

  useEffect(() => {
    if (!params.projectId || !userId || !isEditOwner) return
    const beat = async () => {
      await params.supabase
        .from('pfmea_edit_sessions')
        .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('project_id', params.projectId)
        .eq('locked_by', userId)
    }
    const timer = setInterval(() => {
      void beat()
    }, 30_000)
    return () => clearInterval(timer)
  }, [isEditOwner, params.projectId, params.supabase, userId])

  return {
    activeDraftRevisionId,
    currentAuthorName,
    editSession,
    isChampion,
    isEditOwner,
    isLockedByOther,
    isObsolete,
    loadEditSession,
    loadUserContext,
    moduleAccessState,
    readOnly,
    sessionBusy,
    sessionExpired,
    sessionNow,
    setEditSession,
    setSessionBusy,
    setSessionNow,
    userId,
    workingRevisionId,
    workingRevisionLabel,
  }
}
