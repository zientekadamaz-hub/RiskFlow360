'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@app/lib/supabaseBrowser'

const ROLE_RETRY_COUNT = 1
const ROLE_RETRY_DELAY_MS = 0
const AUTH_UNKNOWN_TIMEOUT_MS = 6000
const AUTH_UNKNOWN_RETRY_MS = 1000
const AUTH_UNKNOWN_MAX_RETRIES = 5
const SETTINGS_ACCESS_CACHE_KEY = '__SETTINGS_ACCESS_OK__'
const HEADER_CACHE_KEY = '__APP_HEADER_CACHE__'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const [checking, setChecking] = useState(true)
  const [optimisticRender, setOptimisticRender] = useState(false)
  const [hardBlock, setHardBlock] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const raw = window.sessionStorage.getItem(HEADER_CACHE_KEY)
      if (!raw) return false
      const parsed = JSON.parse(raw) as {
        userId?: string
        orgRole?: string | null
        userRole?: string | null
      }
      if (!parsed || typeof parsed.userId !== 'string') return false
      const allowed =
        parsed.userRole === 'admin' || parsed.orgRole === 'admin' || parsed.orgRole === 'champion'
      return !allowed
    } catch {
      return false
    }
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

    const checkRole = async (userId: string) => {
      const withTimeout = async <T,>(p: PromiseLike<T>, ms: number): Promise<T> => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        try {
          return await Promise.race([
            p,
            new Promise<T>((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error('timeout')), ms)
            }),
          ])
        } finally {
          if (timeoutId) clearTimeout(timeoutId)
        }
      }

      for (let i = 0; i < ROLE_RETRY_COUNT; i += 1) {
        let memRes: any = null
        try {
          memRes = await withTimeout(
            supabase
              .from('organization_members')
              .select('role')
              .eq('user_id', userId)
              .limit(1)
              .maybeSingle(),
            1200
          )
        } catch {
          memRes = { error: new Error('timeout'), data: null }
        }

        if (!alive) return null

        if (!memRes.error) {
          const role = (memRes.data as any)?.role as string | undefined
          const ok = role === 'admin' || role === 'champion'
          return { ok, role: role ?? null, error: false }
        }

        if (i < ROLE_RETRY_COUNT - 1) {
          await delay(ROLE_RETRY_DELAY_MS)
        }
      }

      return { ok: false, role: null, error: true }
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

    const hasAuthCookie = () => {
      if (typeof document === 'undefined') return false
      return document.cookie
        .split(';')
        .map((c) => c.trim().split('=')[0])
        .some((n) => n.startsWith('sb-') && n.includes('auth-token'))
    }
    const readHeaderCache = () => {
      if (typeof window === 'undefined') return null
      try {
        const raw = window.sessionStorage.getItem(HEADER_CACHE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as {
          userId?: string
          orgRole?: string | null
          userRole?: string | null
        }
        if (!parsed || typeof parsed.userId !== 'string') return null
        return parsed
      } catch {
        return null
      }
    }

    const handleSession = async (session: any | null) => {
      if (!session?.user) {
        const hasCookie = hasAuthCookie()
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
        const isAllowed =
          cached.userRole === 'admin' || cached.orgRole === 'admin' || cached.orgRole === 'champion'
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
      const canUseWarm = warmAccess && warmAccessUserId === session.user.id
      // Only show settings optimistically when access was verified recently for this user.
      if (canUseWarm) {
        setOptimisticRender(true)
        setChecking(false)
        setErrorMsg(null)
      } else {
        setOptimisticRender(false)
        setChecking(true)
        setErrorMsg(null)
      }

      const roleRes = await checkRole(session.user.id)
      if (!alive || !roleRes) return

      if (roleRes.error) {
        if (retries < AUTH_UNKNOWN_MAX_RETRIES) {
          retries += 1
          clearFallback()
          fallbackId = setTimeout(() => {
            void resolveBySession('role-error-retry')
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
        if (!roleRes.role) {
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

    const resolveBySession = async (source: string) => {
      if (!alive) return
      const { data } = await supabase.auth.getSession()
      if (!alive) return
      if (data.session?.user) {
        await handleSession(data.session)
        return
      }

      const hasCookie = hasAuthCookie()
      if (!hasCookie) {
        clearAccessGranted()
        redirectTo('/')
        return
      }

      if (retries < AUTH_UNKNOWN_MAX_RETRIES) {
        retries += 1
        clearFallback()
        fallbackId = setTimeout(() => {
          void resolveBySession('retry')
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

    if (warmAccess) {
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
      void resolveBySession('timeout')
    }, AUTH_UNKNOWN_TIMEOUT_MS)

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
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
        } else if (hasAuthCookie()) {
          clearFallback()
          fallbackId = setTimeout(() => {
            void resolveBySession('initial-empty-cookie')
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
        // @ts-ignore
        sub?.subscription?.unsubscribe?.()
      } catch {}
    }
  }, [pathname, attempt])

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
