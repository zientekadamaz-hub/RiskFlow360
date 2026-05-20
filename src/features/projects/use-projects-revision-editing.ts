'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchProjectRevisionEditingStates } from './projects-service'
import type { ProjectRevisionEditingState, ProjectRowDb } from './types'

export function useProjectsRevisionEditing({
  projects,
  supabase,
}: {
  projects: ProjectRowDb[]
  supabase: SupabaseClient
}) {
  const [projectRevisionEditing, setProjectRevisionEditing] = useState<Record<string, ProjectRevisionEditingState>>({})

  useEffect(() => {
    if (!projects.length) {
      queueMicrotask(() => setProjectRevisionEditing({}))
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const next = await fetchProjectRevisionEditingStates(supabase, projects)
        if (!cancelled) setProjectRevisionEditing(next)
      } catch {
        if (!cancelled) setProjectRevisionEditing({})
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projects, supabase])

  return projectRevisionEditing
}
