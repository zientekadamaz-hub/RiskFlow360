'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import { getSessionUserWithRetries } from '@/lib/auth/client-session'
import { loadOwnCustomerAccessMap, type CustomerProjectAccessMap } from '@/lib/customer-access'
import {
  fetchProjectSiteDepartments,
  fetchProjectsUserContext,
  fetchProjectsWithRevision,
} from './projects-service'
import type { ProjectRowDb, SiteDepartmentOption, UserCtx } from './types'
import { errText } from './utils'

const INITIAL_USER_CONTEXT: UserCtx = {
  userId: '',
  orgId: null,
  globalRole: null,
  orgRole: null,
  canDelete: false,
  isChampion: false,
  isCustomer: false,
  canManageProjects: false,
}

export function useProjectsData() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [userCtx, setUserCtx] = useState<UserCtx>(INITIAL_USER_CONTEXT)
  const [rawProjects, setRawProjects] = useState<ProjectRowDb[]>([])
  const [customerAccessMap, setCustomerAccessMap] = useState<CustomerProjectAccessMap>({})
  const [siteDeptRows, setSiteDeptRows] = useState<SiteDepartmentOption[]>([])
  const [siteDeptMap, setSiteDeptMap] = useState<Record<string, { site: string; department: string }>>({})
  const [siteOptions, setSiteOptions] = useState<string[]>([])

  const loadSiteAndDeptLists = useCallback(async (orgId: string | null) => {
    try {
      const next = await fetchProjectSiteDepartments(supabase, orgId)
      setSiteOptions(next.siteOptions)
      setSiteDeptRows(next.siteDeptRows)
      setSiteDeptMap(next.siteDeptMap)
    } catch {
      setSiteOptions([])
      setSiteDeptRows([])
      setSiteDeptMap({})
    }
  }, [])

  const loadProjectsForContext = useCallback(async (ctx: UserCtx, opts?: { soft?: boolean }) => {
    const soft = !!opts?.soft
    if (soft) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const rows = await fetchProjectsWithRevision(supabase, ctx.orgId)
      setRawProjects(rows)

      if (ctx.isCustomer) {
        try {
          const accessMap = await loadOwnCustomerAccessMap(
            ctx.userId,
            rows.map((row) => row.id).filter(Boolean)
          )
          setCustomerAccessMap(accessMap)
        } catch {
          setCustomerAccessMap({})
        }
      } else {
        setCustomerAccessMap({})
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load projects.')
      setRawProjects([])
      setCustomerAccessMap({})
      if (soft) setRefreshing(false)
      else setLoading(false)
      return
    }

    if (soft) setRefreshing(false)
    else setLoading(false)
  }, [])

  const refreshProjects = useCallback(
    async (opts?: { soft?: boolean }) => {
      await loadProjectsForContext(userCtx, opts)
    },
    [loadProjectsForContext, userCtx]
  )

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        const user = await getSessionUserWithRetries()
        if (!active) return
        if (!user) throw new Error('Cannot read user: Not authenticated.')

        const ctx = await fetchProjectsUserContext(supabase, user.id)
        if (!active) return

        setUserCtx(ctx)
        await Promise.all([loadProjectsForContext(ctx), loadSiteAndDeptLists(ctx.orgId)])
      } catch (loadError) {
        if (!active) return
        setError(errText(loadError))
        setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [loadProjectsForContext, loadSiteAndDeptLists])

  return {
    customerAccessMap,
    error,
    loading,
    rawProjects,
    refreshProjects,
    refreshing,
    setError,
    siteDeptMap,
    siteDeptRows,
    siteOptions,
    userCtx,
  }
}
