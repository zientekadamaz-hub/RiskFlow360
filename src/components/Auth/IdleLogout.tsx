'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@app/lib/supabaseBrowser'

const IDLE_MINUTES = 10
const IDLE_MS = IDLE_MINUTES * 60 * 1000


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
  const lastPingRef = useRef<number>(Date.now())

  useEffect(() => {
    // nie wylogowuj na publicznych stronach
    if (isPublicPath(pathname)) return

    let mounted = true

    async function schedule() {
      // tylko jeśli jest sesja
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      if (!data.session) return

      const reset = () => {
        lastPingRef.current = Date.now()
        if (timerRef.current) clearTimeout(timerRef.current)

        timerRef.current = setTimeout(async () => {
          // jeśli przez timer nie było aktywności → logout
          const idleFor = Date.now() - lastPingRef.current
          if (idleFor < IDLE_MS) return

          try {
            await supabase.auth.signOut()
          } finally {
            // twardy redirect czyści stan aplikacji
            window.location.assign('/')
          }
        }, IDLE_MS + 500) // mały margines
      }

      // zdarzenia aktywności
      const events: (keyof WindowEventMap)[] = [
        'mousemove',
        'mousedown',
        'keydown',
        'scroll',
        'touchstart',
        'click',
        'focus',
      ]

      const onActivity = () => reset()

      events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
      reset()

      return () => {
        events.forEach((e) => window.removeEventListener(e, onActivity as any))
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }

    let cleanup: (() => void) | undefined
    schedule().then((fn) => {
      cleanup = fn
    })

    return () => {
      mounted = false
      cleanup?.()
    }
  }, [pathname])

  return null
}
