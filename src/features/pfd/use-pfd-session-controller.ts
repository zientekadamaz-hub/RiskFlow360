import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchPfdEditSession,
  fetchPfdModuleAccess,
  fetchPfdUserContext,
  fetchUnreadPfdSessionNotice,
  heartbeatPfdEditSession,
} from './pfd-service'
import type { PfdEditSession } from './types'

const EDIT_LOCK_HOURS = 48
const EDIT_LOCK_MS = EDIT_LOCK_HOURS * 60 * 60 * 1000

export function usePfdSessionController({
  projectId,
  supabase,
}: {
  projectId: string
  supabase: SupabaseClient
}) {
  const [canOpenPfmeaPanel, setCanOpenPfmeaPanel] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [editSession, setEditSession] = useState<PfdEditSession | null>(null)
  const [historyAuthor, setHistoryAuthor] = useState('Unknown user')
  const [moduleAccessState, setModuleAccessState] = useState<'checking' | 'allowed' | 'denied'>('checking')
  const [sessionBusy, setSessionBusy] = useState(false)
  const [sessionMsg, setSessionMsg] = useState('')
  const [sessionNow, setSessionNow] = useState(() => Date.now())

  const sessionExpired = useMemo(() => {
    if (!editSession) return false
    const last = new Date(editSession.lastActivityAt).getTime()
    if (!Number.isFinite(last)) return true
    return sessionNow - last >= EDIT_LOCK_MS
  }, [editSession, sessionNow])

  const isEditOwner = !!currentUserId && !!editSession && editSession.lockedBy === currentUserId && !sessionExpired
  const isLockedByOther = !!editSession && !isEditOwner && !sessionExpired
  const isReadOnly = !isEditOwner

  const loadUserContext = useCallback(async () => {
    if (!projectId) return
    try {
      const ctx = await fetchPfdUserContext(supabase)
      setCurrentUserId(ctx.currentUserId)
      setHistoryAuthor(ctx.historyAuthor)
    } catch {}
  }, [projectId, supabase])

  const loadEditSession = useCallback(async () => {
    try {
      const next = await fetchPfdEditSession(supabase, projectId)
      setEditSession(next)
    } catch {
      setEditSession(null)
    }
  }, [projectId, supabase])

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
  }, [projectId, supabase])

  useEffect(() => {
    if (!projectId) return
    if (moduleAccessState !== 'allowed') return
    const timer = window.setTimeout(() => {
      void loadUserContext()
      void loadEditSession()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadEditSession, loadUserContext, moduleAccessState, projectId])

  useEffect(() => {
    if (!projectId) return
    if (moduleAccessState !== 'allowed') return
    const timer = window.setInterval(() => {
      void loadEditSession()
      setSessionNow(Date.now())
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [loadEditSession, moduleAccessState, projectId])

  useEffect(() => {
    if (!projectId || !currentUserId) return
    let alive = true

    void (async () => {
      try {
        const message = await fetchUnreadPfdSessionNotice(supabase, projectId, currentUserId)
        if (alive && message) setSessionMsg(message)
      } catch {}
    })()

    return () => {
      alive = false
    }
  }, [currentUserId, projectId, supabase])

  useEffect(() => {
    if (!projectId || !currentUserId || !isEditOwner) return
    const timer = window.setInterval(async () => {
      await heartbeatPfdEditSession(supabase, { projectId, currentUserId })
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [currentUserId, isEditOwner, projectId, supabase])

  return {
    canOpenPfmeaPanel,
    currentUserId,
    editLockMs: EDIT_LOCK_MS,
    editSession,
    historyAuthor,
    isEditOwner,
    isLockedByOther,
    isReadOnly,
    loadEditSession,
    moduleAccessState,
    sessionBusy,
    sessionMsg,
    setSessionBusy,
    setSessionMsg,
  }
}
