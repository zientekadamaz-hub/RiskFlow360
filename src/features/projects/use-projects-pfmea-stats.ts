'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchProjectPfmeaStats } from './projects-service'
import type { ProjectPfmeaStat, ProjectRowDb } from './types'
import { normalizeProjectText } from './utils'

export function useProjectsPfmeaStats({
  projects,
  supabase,
}: {
  projects: ProjectRowDb[]
  supabase: SupabaseClient
}) {
  const [projectPfmeaStats, setProjectPfmeaStats] = useState<Record<string, ProjectPfmeaStat>>({})

  useEffect(() => {
    if (!projects.length) {
      queueMicrotask(() => setProjectPfmeaStats({}))
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const next = await fetchProjectPfmeaStats(supabase, projects)
        if (!cancelled) setProjectPfmeaStats(next)
      } catch {
        if (!cancelled) {
          const projectIds = Array.from(new Set(projects.map((project) => normalizeProjectText(project.id)).filter(Boolean)))
          const fallback: Record<string, ProjectPfmeaStat> = {}
          for (const projectId of projectIds) fallback[projectId] = { avgRpn: null, riskCount: 0 }
          setProjectPfmeaStats(fallback)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projects, supabase])

  return projectPfmeaStats
}
