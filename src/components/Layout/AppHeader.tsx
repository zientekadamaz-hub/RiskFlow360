'use client'

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@app/lib/supabaseBrowser'
import { IDLE_MS, LAST_ACTIVITY_KEY, readIdleTimestamp } from '@/lib/auth/idle-session'

type MenuKey = null | 'reports' | 'settings' | 'admin'
type HoverKey = null | 'projects' | 'reports' | 'tasks' | 'settings' | 'admin'
type AppRole = 'admin' | 'champion' | 'engineer' | 'viewer' | 'customer' | string

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
  const asset = (p: string) => {
    if (!p.startsWith('/')) p = `/${p}`
    if (!BASE_PATH) return p
    const bp = BASE_PATH.startsWith('/') ? BASE_PATH : `/${BASE_PATH}`
    return `${bp.replace(/\/+$/, '')}${p}`
  }

  const [hoverNav, setHoverNav] = useState<HoverKey>(null)
  const [openMenu, setOpenMenu] = useState<MenuKey>(null)
  const [hoverDrop, setHoverDrop] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reportsRef = useRef<HTMLSpanElement | null>(null)
  const settingsRef = useRef<HTMLSpanElement | null>(null)
  const adminRef = useRef<HTMLSpanElement | null>(null)
  const [submenuPosition, setSubmenuPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 })

  const [authState, setAuthState] = useState<'unknown' | 'authed' | 'unauthed'>('unknown')
  const [mounted, setMounted] = useState(false)
  const [idleLeftSec, setIdleLeftSec] = useState<number | null>(null)

  const [orgName, setOrgName] = useState<string | null>(null)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [lastName, setLastName] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<AppRole | null>(null)
  const [orgRole, setOrgRole] = useState<string | null>(null)

  const isAuthed = authState === 'authed'
  const showAuthed = mounted && isAuthed

  const canSeeSettings =
    isAuthed && (userRole === 'admin' || orgRole === 'champion')
  const canSeeAdmin = isAuthed && userRole === 'admin'

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
    const normalizedUserRole = (userRole ?? '').trim().toLowerCase()
    const normalizedOrgRole = (orgRole ?? '').trim().toLowerCase()
    const preferredRole = normalizedUserRole === 'admin' ? normalizedUserRole : normalizedOrgRole || normalizedUserRole
    if (!preferredRole) return ''
    return preferredRole.charAt(0).toUpperCase() + preferredRole.slice(1)
  }, [orgRole, userRole])

  const displayFullName = useMemo(() => {
    const fn = (firstName ?? '').trim()
    const ln = (lastName ?? '').trim()
    const full = `${fn} ${ln}`.trim()
    return full || null
  }, [firstName, lastName])

  const displayOrgName = useMemo(() => {
    if ((userRole ?? '').toString().trim().toLowerCase() === 'admin') return null
    const value = (orgName ?? '').trim()
    return value || null
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
    const allowNoOrg =
      currentPath === '/waiting-for-invite' ||
      currentPath.startsWith('/waiting-for-invite/') ||
      currentPath === '/request-access' ||
      currentPath.startsWith('/request-access/') ||
      currentPath === '/login' ||
      currentPath.startsWith('/login/') ||
      currentPath === '/signup' ||
      currentPath.startsWith('/signup/')

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

  const formatMmSs = (sec: number | null) => {
    if (sec === null) return ''
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

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

  const dropLinkStyle = (key: string): React.CSSProperties => ({
    display: 'block',
    fontSize: 14,
    fontWeight: 650,
    color: '#fff',
    textDecoration: hoverDrop === key ? 'underline' : 'none',
    textUnderlineOffset: 6,
    textDecorationThickness: 2,
    padding: '8px 10px',
    whiteSpace: 'nowrap',
    background: 'transparent',
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
          <Link
            href="/"
            onClick={closeAll}
            style={{ display: 'inline-flex', alignItems: 'center', height: navHeight, textDecoration: 'none' }}
            aria-label="RiskFlow 360"
            title="RiskFlow 360"
          >
            <Image
              src={asset('/logo-riskflow-360.png')}
              alt="RiskFlow 360"
              width={250}
              height={56}
              style={{
                height: 56,
                width: 'auto',
                maxWidth: 250,
                display: 'block',
                objectFit: 'contain',
              }}
            />
          </Link>

          {showAuthed ? (
            <nav
              aria-label="Primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 18,
                fontSize: 14,
                fontWeight: 550,
                minHeight: 32,
              }}
            >
              <Link
                href="/projects"
                style={navLinkStyle('projects')}
                onMouseEnter={() => {
                  setHoverNav('projects')
                  scheduleCloseMenu()
                }}
                onMouseLeave={() => setHoverNav(null)}
                onClick={closeAll}
              >
                Projects
              </Link>

              <span
                ref={reportsRef}
                role="button"
                tabIndex={0}
                aria-haspopup="menu"
                aria-expanded={openMenu === 'reports'}
                style={navLinkStyle('reports')}
                onMouseEnter={() => {
                  setHoverNav('reports')
                  openMenuNow('reports')
                }}
                onMouseLeave={() => setHoverNav(null)}
                onClick={() => (openMenu === 'reports' ? closeAll() : openMenuNow('reports'))}
              >
                Reports
              </span>

              <Link
                href="/task-management"
                style={navLinkStyle('tasks')}
                onMouseEnter={() => {
                  setHoverNav('tasks')
                  scheduleCloseMenu()
                }}
                onMouseLeave={() => setHoverNav(null)}
                onClick={closeAll}
              >
                Tasks
              </Link>

              {canSeeSettings ? (
                <span
                  ref={settingsRef}
                  role="button"
                  tabIndex={0}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === 'settings'}
                  style={navLinkStyle('settings')}
                  onMouseEnter={() => {
                    setHoverNav('settings')
                    openMenuNow('settings')
                  }}
                  onMouseLeave={() => setHoverNav(null)}
                  onClick={() => (openMenu === 'settings' ? closeAll() : openMenuNow('settings'))}
                >
                  Settings
                </span>
              ) : null}

              {canSeeAdmin ? (
                <span
                  ref={adminRef}
                  role="button"
                  tabIndex={0}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === 'admin'}
                  style={navLinkStyle('admin')}
                  onMouseEnter={() => {
                    setHoverNav('admin')
                    openMenuNow('admin')
                  }}
                  onMouseLeave={() => setHoverNav(null)}
                  onClick={() => (openMenu === 'admin' ? closeAll() : openMenuNow('admin'))}
                >
                  Admin
                </span>
              ) : null}
            </nav>
          ) : (
            <div
              aria-hidden
              style={{
                minHeight: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 18,
                visibility: !mounted || authState === 'unknown' ? 'visible' : 'hidden',
              }}
            >
              <div style={{ width: 72, height: 14 }} />
              <div style={{ width: 70, height: 14 }} />
              <div style={{ width: 52, height: 14 }} />
              <div style={{ width: 68, height: 14 }} />
            </div>
          )}

          {showAuthed ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.05 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  {displayOrgName ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 400,
                        color: 'rgba(0,0,0,0.55)',
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                        maxWidth: 240,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={displayOrgName}
                    >
                      {displayOrgName}
                    </span>
                  ) : null}

                  <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{displayFullName ?? '—'}</span>

                  {displayRole ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'rgba(0,0,0,0.45)',
                        padding: '4px 8px',
                        borderRadius: 999,
                        border: '1px solid rgba(0,0,0,0.10)',
                        background: 'rgba(0,0,0,0.02)',
                        lineHeight: 1,
                      }}
                      title="Your role"
                    >
                      {displayRole}
                    </span>
                  ) : null}
                </div>
              </div>

              {idleLeftSec !== null ? (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#111',
                    padding: '7px 10px',
                    borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.10)',
                    background: '#fff',
                    minWidth: 72,
                    textAlign: 'center',
                  }}
                  title="Auto-logout timer"
                >
                  {formatMmSs(idleLeftSec)}
                </span>
              ) : null}

              <button
                onClick={() => void handleLogout()}
                className="rf-button"
                style={{
                  fontSize: 13,
                  fontWeight: 650,
                  padding: '6px 10px',
                  borderRadius: 10,
                  border: '1px solid #ddd',
                  background: '#fff',
                  color: '#111',
                  cursor: 'pointer',
                }}
              >
                Log out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
              <div
                aria-hidden
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  visibility: !mounted || authState === 'unknown' ? 'visible' : 'hidden',
                }}
              >
                <div style={{ width: 120, height: 10 }} />
                <div style={{ width: 90, height: 12 }} />
                <div style={{ width: 54, height: 20, borderRadius: 999 }} />
              </div>
              {authState === 'unauthed' ? (
                <>
                  <Link
                    href="/signup"
                    className="rf-button"
                    style={{
                      fontSize: 13,
                      fontWeight: 650,
                      padding: '6px 10px',
                      borderRadius: 10,
                      border: '1px solid #ddd',
                      background: '#fff',
                      color: '#111',
                      textDecoration: 'none',
                      textAlign: 'center',
                    }}
                    onClick={closeAll}
                  >
                    Create account
                  </Link>
                  <Link
                    href="/login"
                    className="rf-button"
                    style={{
                      fontSize: 13,
                      fontWeight: 650,
                      padding: '6px 10px',
                      borderRadius: 10,
                      border: '1px solid #ddd',
                      background: '#fff',
                      color: '#111',
                      textDecoration: 'none',
                      textAlign: 'center',
                    }}
                    onClick={closeAll}
                  >
                    Log in
                  </Link>
                </>
              ) : (
                <div style={{ width: 86, height: 34 }} />
              )}
            </div>
          )}
        </div>
      </header>

      {showAuthed && openMenu && (
        <div
          role="menu"
          aria-label={openMenu === 'reports' ? 'Reports menu' : openMenu === 'admin' ? 'Admin menu' : 'Settings menu'}
          style={{
            position: 'fixed',
            left: submenuPosition.left,
            top: submenuPosition.top,
            zIndex: 55,
            background: sharedOverlayBg,
            border: `1px solid ${sharedOverlayBorder}`,
            boxShadow: '0 14px 28px rgba(0,0,0,0.10)',
            padding: '8px',
            width: 'max-content',
            minWidth: 220,
            maxWidth: 'min(320px, calc(100vw - 24px))',
          }}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleCloseMenu}
        >
          <div style={{ display: 'grid', gap: 2, width: 'max-content' }}>
            {openMenu === 'reports' && (
              <>
                <Link
                  href="/reports/rpn-matrix"
                  style={dropLinkStyle('rpn')}
                  onMouseEnter={() => setHoverDrop('rpn')}
                  onMouseLeave={() => setHoverDrop(null)}
                  onClick={closeAll}
                >
                  RPN Matrix
                </Link>

                <Link
                  href="/reports/progress-chart"
                  style={dropLinkStyle('progress')}
                  onMouseEnter={() => setHoverDrop('progress')}
                  onMouseLeave={() => setHoverDrop(null)}
                  onClick={closeAll}
                >
                  Progress Chart
                </Link>
              </>
            )}

            {openMenu === 'settings' && canSeeSettings && (
              <>
                <Link
                  href="/settings/risk-matrix"
                  style={dropLinkStyle('risk')}
                  onMouseEnter={() => setHoverDrop('risk')}
                  onMouseLeave={() => setHoverDrop(null)}
                  onClick={closeAll}
                >
                  Risk Matrix
                </Link>

                <Link
                  href="/settings/severity"
                  style={dropLinkStyle('severity')}
                  onMouseEnter={() => setHoverDrop('severity')}
                  onMouseLeave={() => setHoverDrop(null)}
                  onClick={closeAll}
                >
                  Severity
                </Link>
                <Link
                  href="/settings/occurrence"
                  style={dropLinkStyle('occurrence')}
                  onMouseEnter={() => setHoverDrop('occurrence')}
                  onMouseLeave={() => setHoverDrop(null)}
                  onClick={closeAll}
                >
                  Occurrence
                </Link>
                <Link
                  href="/settings/detection"
                  style={dropLinkStyle('detection')}
                  onMouseEnter={() => setHoverDrop('detection')}
                  onMouseLeave={() => setHoverDrop(null)}
                  onClick={closeAll}
                >
                  Detection
                </Link>

                <Link
                  href="/settings/sites-departments"
                  style={dropLinkStyle('sites-departments')}
                  onMouseEnter={() => setHoverDrop('sites-departments')}
                  onMouseLeave={() => setHoverDrop(null)}
                  onClick={closeAll}
                >
                  Sites & Departments
                </Link>

                <Link
                  href="/settings/invitations"
                  style={dropLinkStyle('invitations')}
                  onMouseEnter={() => setHoverDrop('invitations')}
                  onMouseLeave={() => setHoverDrop(null)}
                  onClick={closeAll}
                >
                  Invitations
                </Link>

                <Link
                  href="/settings/customer-access"
                  style={dropLinkStyle('customer-access')}
                  onMouseEnter={() => setHoverDrop('customer-access')}
                  onMouseLeave={() => setHoverDrop(null)}
                  onClick={closeAll}
                >
                  Customer Access
                </Link>
              </>
            )}

            {openMenu === 'admin' && canSeeAdmin && (
              <>
                <Link
                  href="/settings/organizations"
                  style={dropLinkStyle('organizations')}
                  onMouseEnter={() => setHoverDrop('organizations')}
                  onMouseLeave={() => setHoverDrop(null)}
                  onClick={closeAll}
                >
                  Organizations
                </Link>

                <Link
                  href="/settings/ui-preview"
                  style={dropLinkStyle('ui-preview')}
                  onMouseEnter={() => setHoverDrop('ui-preview')}
                  onMouseLeave={() => setHoverDrop(null)}
                  onClick={closeAll}
                >
                  UI Preview
                </Link>
              </>
            )}
          </div>
        </div>
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
