'use client'

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@app/lib/supabaseBrowser'
import { IDLE_MS, LAST_ACTIVITY_KEY, readIdleTimestamp } from '@/lib/auth/idle-session'
import { HeaderLogo } from './HeaderLogo'
import { HeaderPublicActions } from './HeaderPublicActions'
import { HeaderDropdownMenu } from './HeaderDropdownMenu'
import { HeaderNavigation, HeaderNavSkeleton, type HoverKey, type MenuKey } from './HeaderNavigation'
import { HeaderUserControls, HeaderUserSkeleton } from './HeaderUserControls'
import {
  type HeaderAppRole,
  type HeaderAuthState,
  canSeeAdminFor,
  canSeeSettingsFor,
  displayFullNameFor,
  displayOrgNameFor,
  displayRoleFor,
  isNoOrgAllowedPath,
  shouldShowAuthedHeader,
} from './app-header-model'

type AppRole = HeaderAppRole

const AUTH_UNKNOWN_TIMEOUT_MS = 4000
const AUTH_UNKNOWN_RETRY_MS = 1000
const AUTH_UNKNOWN_MAX_RETRIES = 5
const HEADER_CACHE_KEY = '__APP_HEADER_CACHE__'
const HEADER_CACHE_TTL_MS = 30 * 60 * 1000

type MyHeaderRpcRow = {
  first_name?: string | null
  last_name?: string | null
  org_name?: string | null
  org_role?: string | null
  global_role?: AppRole | null
}

type HeaderCacheEntry = {
  ts: number
  userId: string
  firstName: string | null
  lastName: string | null
  orgName: string | null
  orgRole: string | null
  userRole: AppRole | null
}

export default function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()

  const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').trim()

  const [hoverNav, setHoverNav] = useState<HoverKey>(null)
  const [openMenu, setOpenMenu] = useState<MenuKey>(null)
  const [hoverDrop, setHoverDrop] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reportsRef = useRef<HTMLSpanElement | null>(null)
  const settingsRef = useRef<HTMLSpanElement | null>(null)
  const adminRef = useRef<HTMLSpanElement | null>(null)
  const [submenuPosition, setSubmenuPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 })

  const [authState, setAuthState] = useState<HeaderAuthState>('unknown')
  const [mounted, setMounted] = useState(false)
  const [idleLeftSec, setIdleLeftSec] = useState<number | null>(null)

  const [orgName, setOrgName] = useState<string | null>(null)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [lastName, setLastName] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<AppRole | null>(null)
  const [orgRole, setOrgRole] = useState<string | null>(null)

  const isAuthed = authState === 'authed'
  const showAuthed = shouldShowAuthedHeader(mounted, authState)

  const canSeeSettings = canSeeSettingsFor(isAuthed, userRole, orgRole)
  const canSeeAdmin = canSeeAdminFor(isAuthed, userRole)

  const navHeight = 56
  const frameStyle: React.CSSProperties = { width: '80%', marginLeft: 'auto', marginRight: 'auto' }
  const sharedOverlayBg = 'rgb(40, 39, 47)'
  const sharedOverlayBorder = 'rgba(255,255,255,0.16)'

  const applyHeaderSnapshot = (snapshot: {
    firstName: string | null
    lastName: string | null
    orgName: string | null
    orgRole: string | null
    userRole: AppRole | null
  }) => {
    setFirstName(snapshot.firstName)
    setLastName(snapshot.lastName)
    setOrgName(snapshot.orgName)
    setOrgRole(snapshot.orgRole)
    setUserRole(snapshot.userRole)
  }

  const readHeaderCache = (): HeaderCacheEntry | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.sessionStorage.getItem(HEADER_CACHE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as HeaderCacheEntry
      if (!parsed || typeof parsed !== 'object') return null
      if (typeof parsed.ts !== 'number' || typeof parsed.userId !== 'string') return null
      if (Date.now() - parsed.ts > HEADER_CACHE_TTL_MS) return null
      return parsed
    } catch {
      return null
    }
  }

  const hydrateHeaderFromCache = (userId: string) => {
    const cached = readHeaderCache()
    if (!cached || cached.userId !== userId) return false
    applyHeaderSnapshot({
      firstName: cached.firstName,
      lastName: cached.lastName,
      orgName: cached.orgName,
      orgRole: cached.orgRole,
      userRole: cached.userRole,
    })
    return true
  }

  const writeHeaderCache = (entry: Omit<HeaderCacheEntry, 'ts'>) => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(HEADER_CACHE_KEY, JSON.stringify({ ...entry, ts: Date.now() }))
    } catch {}
  }

  const clearHeaderCache = () => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.removeItem(HEADER_CACHE_KEY)
    } catch {}
  }

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const closeAll = useCallback(() => {
    clearCloseTimer()
    setOpenMenu(null)
    setHoverDrop(null)
  }, [clearCloseTimer])

  const scheduleCloseMenu = useCallback(() => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => {
      setOpenMenu(null)
      setHoverDrop(null)
    }, 130)
  }, [clearCloseTimer])

  const openMenuNow = useCallback((m: Exclude<MenuKey, null>) => {
    clearCloseTimer()
    setOpenMenu(m)
  }, [clearCloseTimer])

  const displayRole = useMemo(() => {
    return displayRoleFor(userRole, orgRole)
  }, [orgRole, userRole])

  const displayFullName = useMemo(() => {
    return displayFullNameFor(firstName, lastName)
  }, [firstName, lastName])

  const displayOrgName = useMemo(() => {
    return displayOrgNameFor(orgName, userRole)
  }, [orgName, userRole])

  const withTimeout = async <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    try {
      return await Promise.race([
        p,
        new Promise<T>((resolve) => {
          timeoutId = setTimeout(() => resolve(fallback), ms)
        }),
      ])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  async function loadHeaderViaRpc(): Promise<{
    status: 'ok' | 'no-org' | 'error'
    row: MyHeaderRpcRow | null
  }> {
    const { data, error } = await supabase.rpc('get_my_header').maybeSingle()
    if (error) {
      return { status: 'error', row: null }
    }
    if (!data) {
      setOrgName(null)
      setOrgRole(null)
      return { status: 'no-org', row: null }
    }

    const row = data as MyHeaderRpcRow
    setFirstName(row.first_name ?? null)
    setLastName(row.last_name ?? null)
    setOrgName(row.org_name ?? null)
    setOrgRole(row.org_role ?? null)
    if (row.global_role !== undefined) setUserRole(row.global_role ?? null)

    if ((row.global_role ?? '').toString().toLowerCase() === 'admin') {
      return { status: 'ok', row }
    }

    return { status: row.org_name && row.org_role ? 'ok' : 'no-org', row }
  }

  async function syncHeaderForSession(session: Session | null): Promise<boolean> {
    const u = session?.user ?? null
    if (!u) {
      setOrgName(null)
      setFirstName(null)
      setLastName(null)
      setUserRole(null)
      setOrgRole(null)
      clearHeaderCache()
      return false
    }

    const headerResult = await withTimeout(
      loadHeaderViaRpc(),
      3500,
      { status: 'error', row: null } as { status: 'ok' | 'no-org' | 'error'; row: MyHeaderRpcRow | null }
    )
    const headerStatus = headerResult.status
    if (headerStatus !== 'error') {
      const row = headerResult.row
      writeHeaderCache({
        userId: u.id,
        firstName: row?.first_name ?? null,
        lastName: row?.last_name ?? null,
        orgName: row?.org_name ?? null,
        orgRole: row?.org_role ?? null,
        userRole: row?.global_role ?? null,
      })
    }

    const currentPath =
      typeof window !== 'undefined' ? window.location.pathname : pathname
    const allowNoOrg = isNoOrgAllowedPath(currentPath)

    if (headerStatus === 'no-org' && !allowNoOrg) {
      router.replace('/waiting-for-invite')
      return true
    }

    if (
      headerStatus === 'ok' &&
      (currentPath === '/waiting-for-invite' || currentPath.startsWith('/waiting-for-invite/'))
    ) {
      router.replace('/')
      return true
    }
    return true
  }

  useEffect(() => {
    let alive = true
    let initialResolved = false
    let resolvedState: 'unknown' | 'authed' | 'unauthed' = 'unknown'
    let fallbackId: ReturnType<typeof setTimeout> | null = null
    let retries = 0

    const clearFallback = () => {
      if (fallbackId) {
        clearTimeout(fallbackId)
        fallbackId = null
      }
    }

    const setAuthed = () => {
      if (!alive) return
      initialResolved = true
      resolvedState = 'authed'
      clearFallback()
      setAuthState('authed')
    }

    const setUnAuthed = (force = false) => {
      if (!alive) return
      if (!force && resolvedState === 'authed') {
        return
      }
      initialResolved = true
      resolvedState = 'unauthed'
      clearFallback()
      setAuthState('unauthed')
    }

    const hasAuthCookie = () => {
      if (typeof document === 'undefined') return false
      return document.cookie
        .split(';')
        .map((c) => c.trim().split('=')[0])
        .some((n) => n.startsWith('sb-') && n.includes('auth-token'))
    }

    const tryResolveFromSession = async () => {
      if (!alive || initialResolved) return
      const { data } = await supabase.auth.getSession()
      if (!alive || initialResolved) return
      if (data.session?.user) {
        hydrateHeaderFromCache(data.session.user.id)
        setAuthed()
        void syncHeaderForSession(data.session)
        return
      }
      const hasCookie = hasAuthCookie()
      if (!hasCookie) {
        setUnAuthed()
        return
      }
      if (retries < AUTH_UNKNOWN_MAX_RETRIES) {
        retries += 1
        fallbackId = setTimeout(tryResolveFromSession, AUTH_UNKNOWN_RETRY_MS)
      } else {
        try {
          await supabase.auth.refreshSession()
        } catch {}
        if (!alive || initialResolved) return
        const { data: afterRefresh } = await supabase.auth.getSession()
        if (!alive || initialResolved) return
        if (afterRefresh.session?.user) {
          hydrateHeaderFromCache(afterRefresh.session.user.id)
          setAuthed()
          void syncHeaderForSession(afterRefresh.session)
          return
        }
        setUnAuthed()
      }
    }

    fallbackId = setTimeout(tryResolveFromSession, AUTH_UNKNOWN_TIMEOUT_MS)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!alive) return

      if (event === 'SIGNED_OUT') {
        setOrgName(null)
        setFirstName(null)
        setLastName(null)
        setUserRole(null)
        setOrgRole(null)
        clearHeaderCache()
        closeAll()
        setUnAuthed(true)
        window.location.assign('/')
        return
      }

      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          hydrateHeaderFromCache(session.user.id)
          setAuthed()
          void syncHeaderForSession(session)
        } else {
          if (!hasAuthCookie()) {
            setUnAuthed()
          } else {
            clearFallback()
            fallbackId = setTimeout(tryResolveFromSession, 200)
          }
        }
        return
      }

      if (session?.user) {
        hydrateHeaderFromCache(session.user.id)
        setAuthed()
        void syncHeaderForSession(session)
      }
    })

    return () => {
      alive = false
      if (fallbackId) clearTimeout(fallbackId)
      try {
        subscription.unsubscribe()
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isAuthed) closeAll()
  }, [closeAll, isAuthed])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isAuthed) {
      setIdleLeftSec(null)
      return
    }

    let mounted = true
    let lastActivity = readIdleTimestamp(LAST_ACTIVITY_KEY) ?? Date.now()

    const update = () => {
      const leftMs = Math.max(0, IDLE_MS - (Date.now() - lastActivity))
      setIdleLeftSec(Math.ceil(leftMs / 1000))
    }

    const onActivity: EventListener = () => {
      lastActivity = Date.now()
      update()
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== LAST_ACTIVITY_KEY || !event.newValue) return
      const timestamp = Number(event.newValue)
      if (!Number.isFinite(timestamp)) return
      lastActivity = timestamp
      update()
    }

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'focus',
    ]

    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    window.addEventListener('storage', onStorage)
    update()

    const id = setInterval(() => {
      if (!mounted) return
      update()
    }, 1000)

    return () => {
      mounted = false
      clearInterval(id)
      events.forEach((e) => window.removeEventListener(e, onActivity))
      window.removeEventListener('storage', onStorage)
    }
  }, [isAuthed])

  const recomputeSubmenuPosition = useCallback(() => {
    if (!openMenu) return
    const targetEl =
      openMenu === 'reports'
        ? reportsRef.current
        : openMenu === 'admin'
          ? adminRef.current
          : settingsRef.current
    if (!targetEl) return
    const targetRect = targetEl.getBoundingClientRect()
    setSubmenuPosition({
      left: Math.round(targetRect.left),
      top: Math.round(targetRect.bottom + 6),
    })
  }, [openMenu])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeAll])

  useLayoutEffect(() => {
    if (!openMenu) return
    const id = requestAnimationFrame(() => recomputeSubmenuPosition())
    return () => cancelAnimationFrame(id)
  }, [openMenu, recomputeSubmenuPosition])

  useEffect(() => {
    if (!openMenu) return
    const onResize = () => recomputeSubmenuPosition()
    const onScroll = () => recomputeSubmenuPosition()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [openMenu, recomputeSubmenuPosition])

  const navLinkStyle = (key: Exclude<HoverKey, null>): React.CSSProperties => ({
    color: '#111',
    textDecoration: hoverNav === key ? 'underline' : 'none',
    textUnderlineOffset: 6,
    textDecorationThickness: 2,
    padding: '10px 4px',
    cursor: 'pointer',
  })

  async function handleLogout() {
    closeAll()
    await supabase.auth.signOut()
    window.location.assign('/')
  }

  return (
    <>
      <header
        style={{
          background: '#fff',
          height: navHeight,
          display: 'flex',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 60,
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        }}
        onMouseLeave={() => {
          if (showAuthed) scheduleCloseMenu()
        }}
      >
        <div
          style={{
            ...frameStyle,
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <HeaderLogo basePath={BASE_PATH} navHeight={navHeight} onClick={closeAll} />

          {showAuthed ? (
            <HeaderNavigation
              adminRef={adminRef}
              canSeeAdmin={canSeeAdmin}
              canSeeSettings={canSeeSettings}
              closeAll={closeAll}
              openMenu={openMenu}
              openMenuNow={openMenuNow}
              reportsRef={reportsRef}
              scheduleCloseMenu={scheduleCloseMenu}
              setHoverNav={setHoverNav}
              settingsRef={settingsRef}
              styleFor={navLinkStyle}
            />
          ) : (
            <HeaderNavSkeleton visible={!mounted || authState === 'unknown'} />
          )}

          {showAuthed ? (
            <HeaderUserControls
              displayFullName={displayFullName}
              displayOrgName={displayOrgName}
              displayRole={displayRole}
              idleLeftSec={idleLeftSec}
              onLogout={() => void handleLogout()}
            />
          ) : (
            <HeaderUserSkeleton
              authState={authState}
              mounted={mounted}
              publicActions={<HeaderPublicActions onNavigate={closeAll} />}
            />
          )}
        </div>
      </header>

      {showAuthed && openMenu && (
        <HeaderDropdownMenu
          canSeeAdmin={canSeeAdmin}
          canSeeSettings={canSeeSettings}
          clearCloseTimer={clearCloseTimer}
          closeAll={closeAll}
          hoverDrop={hoverDrop}
          openMenu={openMenu}
          scheduleCloseMenu={scheduleCloseMenu}
          setHoverDrop={setHoverDrop}
          sharedOverlayBg={sharedOverlayBg}
          sharedOverlayBorder={sharedOverlayBorder}
          submenuPosition={submenuPosition}
        />
      )}

      <style jsx global>{`
        .rf-button {
          background: #fff;
          color: #111;
          font-family: inherit;
          font-weight: 650;
          transition: background 120ms ease;
        }
        .rf-button:hover {
          background: rgba(59, 130, 246, 0.18) !important;
          border-color: rgba(96, 165, 250, 0.45) !important;
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.18) !important;
        }
        .rf-button:disabled {
          background: #fff;
          color: rgba(0, 0, 0, 0.35);
        }
      `}</style>
    </>
  )
}
