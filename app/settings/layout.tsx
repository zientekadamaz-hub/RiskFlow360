'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@app/lib/supabaseBrowser'
import {
  SETTINGS_ACCESS_CACHE_KEY,
  getHeaderContext,
  hasSupabaseAuthCookie,
  isSettingsAllowed,
  readHeaderCache,
  withTimeout,
} from '@/lib/auth/client-session'

const ROLE_RETRY_COUNT = 1
const ROLE_RETRY_DELAY_MS = 0
const AUTH_UNKNOWN_TIMEOUT_MS = 6000
const AUTH_UNKNOWN_RETRY_MS = 1000
const AUTH_UNKNOWN_MAX_RETRIES = 5

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdminOnlyRoute = pathname === '/settings/ui-preview' || pathname.startsWith('/settings/ui-preview/')

  const isRouteAllowed = useCallback(
    (row: { org_role?: string | null; global_role?: string | null } | null) => {
      if (!row) return false
      if (isAdminOnlyRoute) return row.global_role === 'admin'
      return isSettingsAllowed(row)
    },
    [isAdminOnlyRoute]
  )

  const [checking, setChecking] = useState(true)
  const [optimisticRender, setOptimisticRender] = useState(false)
  const [hardBlock, setHardBlock] = useState<boolean>(() => {
    const cached = readHeaderCache()
    return !isRouteAllowed(
      cached
        ? {
            org_role: cached.orgRole ?? null,
            global_role: cached.userRole ?? null,
          }
        : null
    )
  })
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    let redirecting = false
    let retries = 0
    let warmAccess = false
    let warmAccessUserId: string | null = null
    let fallbackId: ReturnType<typeof setTimeout> | null = null
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const redirectTo = (path: string) => {
      if (!alive || redirecting) return
      redirecting = true
      setChecking(false)
      window.location.assign(path)
    }

    try {
      const raw = window.sessionStorage.getItem(SETTINGS_ACCESS_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { userId?: string; ok?: boolean }
        if (parsed && parsed.ok && typeof parsed.userId === 'string') {
          warmAccess = true
          warmAccessUserId = parsed.userId
        }
      }
    } catch {}

    const checkRole = async () => {
      for (let i = 0; i < ROLE_RETRY_COUNT; i += 1) {
        try {
          const headerRes = await withTimeout(getHeaderContext(), 1200)
          if (!alive) return null

          if (headerRes.status === 'error') {
            throw new Error('header-error')
          }

          if (headerRes.status === 'no-org') {
            return { ok: false, role: null, hasOrganization: false, error: false }
          }

          return {
            ok: isRouteAllowed(headerRes.row),
            role: headerRes.row?.org_role ?? headerRes.row?.global_role ?? null,
            hasOrganization: true,
            error: false,
          }
        } catch {
          if (!alive) return null
        }

        if (i < ROLE_RETRY_COUNT - 1) {
          await delay(ROLE_RETRY_DELAY_MS)
        }
      }

      return { ok: false, role: null, hasOrganization: false, error: true }
    }

    const markAccessGranted = (userId: string) => {
      warmAccess = true
      warmAccessUserId = userId
      setOptimisticRender(true)
      try {
        window.sessionStorage.setItem(SETTINGS_ACCESS_CACHE_KEY, JSON.stringify({ userId, ok: true }))
      } catch {}
    }

    const clearAccessGranted = () => {
      warmAccess = false
      warmAccessUserId = null
      setOptimisticRender(false)
      try {
        window.sessionStorage.removeItem(SETTINGS_ACCESS_CACHE_KEY)
      } catch {}
    }

    const clearFallback = () => {
      if (fallbackId) {
        clearTimeout(fallbackId)
        fallbackId = null
      }
    }

    const handleSession = async (session: Session | null) => {
      if (!session?.user) {
        const hasCookie = hasSupabaseAuthCookie()
        if (!hasCookie) {
          clearAccessGranted()
          redirectTo('/')
          return
        }
        return
      }
      clearFallback()
      const cached = readHeaderCache()
      if (cached && cached.userId === session.user.id) {
        const isAllowed = isRouteAllowed({
          org_role: cached.orgRole ?? null,
          global_role: cached.userRole ?? null,
        })
        if (!isAllowed) {
          clearAccessGranted()
          setHardBlock(true)
          redirectTo('/')
          return
        }
        setHardBlock(false)
      }
      if (warmAccessUserId && warmAccessUserId !== session.user.id) {
        clearAccessGranted()
      }
      const canUseWarm =
        warmAccess &&
        warmAccessUserId === session.user.id &&
        (!isAdminOnlyRoute || (cached && cached.userId === session.user.id && cached.userRole === 'admin'))
      if (canUseWarm) {
        setOptimisticRender(true)
        setChecking(false)
        setErrorMsg(null)
      } else {
        setOptimisticRender(false)
        setChecking(true)
        setErrorMsg(null)
      }

      const roleRes = await checkRole()
      if (!alive || !roleRes) return

      if (roleRes.error) {
        if (retries < AUTH_UNKNOWN_MAX_RETRIES) {
          retries += 1
          clearFallback()
          fallbackId = setTimeout(() => {
            void resolveBySession()
          }, AUTH_UNKNOWN_RETRY_MS)
          return
        }
        setChecking(false)
        setErrorMsg('Nie udalo sie zweryfikowac roli. Sprobuj ponownie.')
        return
      }

      if (!roleRes.ok) {
        clearAccessGranted()
        setHardBlock(true)
        if (!roleRes.hasOrganization && !isAdminOnlyRoute) {
          redirectTo('/waiting-for-invite')
        } else {
          redirectTo('/')
        }
        return
      }

      markAccessGranted(session.user.id)
      setHardBlock(false)
      setErrorMsg(null)
      setChecking(false)
    }

    const resolveBySession = async () => {
      if (!alive) return
      const { data } = await supabase.auth.getSession()
      if (!alive) return
      if (data.session?.user) {
        await handleSession(data.session)
        return
      }

      const hasCookie = hasSupabaseAuthCookie()
      if (!hasCookie) {
        clearAccessGranted()
        redirectTo('/')
        return
      }

      if (retries < AUTH_UNKNOWN_MAX_RETRIES) {
        retries += 1
        clearFallback()
        fallbackId = setTimeout(() => {
          void resolveBySession()
        }, AUTH_UNKNOWN_RETRY_MS)
        return
      }

      try {
        await supabase.auth.refreshSession()
      } catch {}
      if (!alive) return
      const { data: afterRefresh } = await supabase.auth.getSession()
      if (!alive) return
      if (afterRefresh.session?.user) {
        await handleSession(afterRefresh.session)
        return
      }
      clearAccessGranted()
      redirectTo('/')
    }

    const cached = readHeaderCache()
    const canWarmRender =
      warmAccess &&
      (!isAdminOnlyRoute || (cached && cached.userId === warmAccessUserId && cached.userRole === 'admin'))

    if (canWarmRender) {
      setChecking(false)
      setErrorMsg(null)
      setOptimisticRender(true)
      setHardBlock(false)
    } else {
      setChecking(true)
      setErrorMsg(null)
      setOptimisticRender(false)
    }

    fallbackId = setTimeout(() => {
      void resolveBySession()
    }, AUTH_UNKNOWN_TIMEOUT_MS)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!alive) return

      if (event === 'SIGNED_OUT') {
        clearAccessGranted()
        setHardBlock(true)
        redirectTo('/')
        return
      }

      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          await handleSession(session)
        } else if (hasSupabaseAuthCookie()) {
          clearFallback()
          fallbackId = setTimeout(() => {
            void resolveBySession()
          }, 200)
        } else {
          clearAccessGranted()
          redirectTo('/')
        }
        return
      }

      if (session?.user) {
        await handleSession(session)
      }
    })

    return () => {
      alive = false
      clearFallback()
      try {
        subscription.unsubscribe()
      } catch {}
    }
  }, [attempt, isAdminOnlyRoute, isRouteAllowed, pathname])

  if (hardBlock) {
    return null
  }

  if (checking && !optimisticRender) {
    return null
  }

  if (errorMsg && !optimisticRender) {
    return (
      <div style={{ width: '80%', margin: '24px auto', color: '#7a1111', fontSize: 13 }}>
        {errorMsg}
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => setAttempt((a) => a + 1)}
            className='rf-button'
            style={{
              fontSize: 13,
              fontWeight: 650,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.10)',
              background: '#fff',
              color: '#111',
              cursor: 'pointer',
            }}
          >
            Sprobuj ponownie
          </button>
        </div>
      </div>
    )
  }

  if (errorMsg && optimisticRender) {
    return (
      <>
        <div style={{ width: '80%', margin: '12px auto 0', color: '#7a1111', fontSize: 12 }}>{errorMsg}</div>
        {children}
      </>
    )
  }

  return <>{children}</>
}
