'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import type { AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '@app/lib/supabaseBrowser'
import {
  ACTIVITY_WRITE_THROTTLE_MS,
  clearIdleTimestamp,
  IDLE_LOGOUT_BROADCAST_KEY,
  IDLE_MS,
  LAST_ACTIVITY_KEY,
  readIdleTimestamp,
  writeIdleTimestamp,
} from '@/lib/auth/idle-session'

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/request-access') ||
    pathname.startsWith('/waiting-for-invite')
  )
}

export default function IdleLogout() {
  const pathname = usePathname()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(0)
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
      clearIdleTimestamp(LAST_ACTIVITY_KEY)
    }

    const redirectToLogin = () => {
      window.location.replace('/login?reason=idle')
    }

    const performIdleLogout = async (broadcast: boolean) => {
      if (signingOutRef.current) return
      signingOutRef.current = true

      clearIdleState()

      if (broadcast) {
        writeIdleTimestamp(IDLE_LOGOUT_BROADCAST_KEY, Date.now())
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
        writeIdleTimestamp(LAST_ACTIVITY_KEY, timestamp)
      }
    }

    const checkIdleDeadline = async () => {
      const now = Date.now()
      const storedActivity = readIdleTimestamp(LAST_ACTIVITY_KEY)
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
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      if (!session) {
        signingOutRef.current = false
        clearIdleState()
        return
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        const now = Date.now()
        persistActivity(now, true)
        scheduleIdleTimer()
        return
      }

      if (!timerRef.current) {
        void checkIdleDeadline()
      }
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
      const storedActivity = readIdleTimestamp(LAST_ACTIVITY_KEY)
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
