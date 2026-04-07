'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@app/lib/supabaseBrowser'

const IDLE_MINUTES = 10
const IDLE_MS = IDLE_MINUTES * 60 * 1000
const ACTIVITY_WRITE_THROTTLE_MS = 5000
const LAST_ACTIVITY_KEY = '__APP_LAST_ACTIVITY_AT__'
const IDLE_LOGOUT_BROADCAST_KEY = '__APP_IDLE_LOGOUT_AT__'

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/request-access') ||
    pathname.startsWith('/waiting-for-invite')
  )
}

function readTimestamp(key: string) {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null

    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeTimestamp(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {}
}

function clearTimestamp(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {}
}

export default function IdleLogout() {
  const pathname = usePathname()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const lastPersistedRef = useRef<number>(0)
  const signingOutRef = useRef(false)

  useEffect(() => {
    if (isPublicPath(pathname)) return

    let mounted = true

    const clearIdleTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const clearIdleState = () => {
      clearIdleTimer()
      clearTimestamp(LAST_ACTIVITY_KEY)
    }

    const redirectToLogin = () => {
      window.location.replace('/login?reason=idle')
    }

    const performIdleLogout = async (broadcast: boolean) => {
      if (signingOutRef.current) return
      signingOutRef.current = true

      clearIdleState()

      if (broadcast) {
        writeTimestamp(IDLE_LOGOUT_BROADCAST_KEY, Date.now())
      }

      try {
        await supabase.auth.signOut()
      } finally {
        redirectToLogin()
      }
    }

    const scheduleIdleTimer = () => {
      clearIdleTimer()

      const idleFor = Date.now() - lastActivityRef.current
      const remaining = Math.max(IDLE_MS - idleFor, 0)

      timerRef.current = setTimeout(() => {
        void performIdleLogout(true)
      }, remaining + 250)
    }

    const persistActivity = (timestamp: number, force = false) => {
      lastActivityRef.current = timestamp

      if (force || timestamp - lastPersistedRef.current >= ACTIVITY_WRITE_THROTTLE_MS) {
        lastPersistedRef.current = timestamp
        writeTimestamp(LAST_ACTIVITY_KEY, timestamp)
      }
    }

    const checkIdleDeadline = async () => {
      const now = Date.now()
      const storedActivity = readTimestamp(LAST_ACTIVITY_KEY)
      const effectiveActivity = storedActivity ?? lastActivityRef.current

      if (storedActivity) {
        lastActivityRef.current = storedActivity
        lastPersistedRef.current = storedActivity
      }

      if (now - effectiveActivity >= IDLE_MS) {
        await performIdleLogout(true)
        return false
      }

      scheduleIdleTimer()
      return true
    }

    const activityEvents: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ]

    const onActivity = () => {
      const now = Date.now()
      persistActivity(now)
      scheduleIdleTimer()
    }

    const onFocusLikeEvent = () => {
      if (document.visibilityState === 'hidden') return
      void checkIdleDeadline()
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY && event.newValue) {
        const timestamp = Number(event.newValue)
        if (Number.isFinite(timestamp) && timestamp > lastActivityRef.current) {
          lastActivityRef.current = timestamp
          lastPersistedRef.current = timestamp
          scheduleIdleTimer()
        }
      }

      if (event.key === IDLE_LOGOUT_BROADCAST_KEY && event.newValue) {
        void performIdleLogout(false)
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        signingOutRef.current = false
        clearIdleState()
        return
      }

      const now = Date.now()
      persistActivity(now, true)
      scheduleIdleTimer()
    })

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true })
    })
    window.addEventListener('focus', onFocusLikeEvent)
    document.addEventListener('visibilitychange', onFocusLikeEvent)
    window.addEventListener('storage', onStorage)

    async function init() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      if (!data.session) return

      const now = Date.now()
      const storedActivity = readTimestamp(LAST_ACTIVITY_KEY)
      const initialActivity = storedActivity ?? now

      lastActivityRef.current = initialActivity
      lastPersistedRef.current = storedActivity ?? 0

      if (!storedActivity) {
        persistActivity(now, true)
      }

      await checkIdleDeadline()
    }

    void init()

    return () => {
      mounted = false
      clearIdleTimer()
      subscription.unsubscribe()
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity)
      })
      window.removeEventListener('focus', onFocusLikeEvent)
      document.removeEventListener('visibilitychange', onFocusLikeEvent)
      window.removeEventListener('storage', onStorage)
    }
  }, [pathname])

  return null
}
