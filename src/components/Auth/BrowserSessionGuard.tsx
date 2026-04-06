'use client'

import { useEffect } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'

const TAB_ID_KEY = '__APP_TAB_ID__'
const TAB_REGISTRY_KEY = '__APP_OPEN_TABS__'
const TAB_HEARTBEAT_MS = 15000
const TAB_STALE_MS = TAB_HEARTBEAT_MS * 3

function hasSupabaseAuthCookie() {
  return document.cookie
    .split(';')
    .map((cookie) => cookie.trim().split('=')[0])
    .some((name) => name.startsWith('sb-') && name.includes('auth-token'))
}

function readRegistry(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(TAB_REGISTRY_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw) as Record<string, number>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function writeRegistry(registry: Record<string, number>) {
  try {
    window.localStorage.setItem(TAB_REGISTRY_KEY, JSON.stringify(registry))
  } catch {}
}

function pruneRegistry(registry: Record<string, number>, now: number) {
  return Object.fromEntries(
    Object.entries(registry).filter(([, ts]) => typeof ts === 'number' && now - ts < TAB_STALE_MS)
  )
}

function createTabId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function BrowserSessionGuard() {
  useEffect(() => {
    const now = Date.now()
    const existingTabId = window.sessionStorage.getItem(TAB_ID_KEY)
    const tabId = existingTabId ?? createTabId()

    if (!existingTabId) {
      window.sessionStorage.setItem(TAB_ID_KEY, tabId)
    }

    const registry = pruneRegistry(readRegistry(), now)
    const otherActiveTabs = Object.keys(registry).filter((id) => id !== tabId)
    const shouldClearRecoveredSession = !existingTabId && otherActiveTabs.length === 0 && hasSupabaseAuthCookie()

    writeRegistry({
      ...registry,
      [tabId]: now,
    })

    const heartbeatId = window.setInterval(() => {
      const ts = Date.now()
      const nextRegistry = pruneRegistry(readRegistry(), ts)
      nextRegistry[tabId] = ts
      writeRegistry(nextRegistry)
    }, TAB_HEARTBEAT_MS)

    const unregisterTab = () => {
      const nextRegistry = readRegistry()
      delete nextRegistry[tabId]
      writeRegistry(nextRegistry)
    }

    window.addEventListener('beforeunload', unregisterTab)

    if (shouldClearRecoveredSession) {
      void supabase.auth.signOut().finally(() => {
        window.location.replace('/login')
      })
    }

    return () => {
      window.clearInterval(heartbeatId)
      window.removeEventListener('beforeunload', unregisterTab)
      unregisterTab()
    }
  }, [])

  return null
}
