'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchProjectRevisionPopupData } from './projects-service'
import type { ProjectRowDb, RevisionPopupData } from './types'
import { emptyRevisionRows, normalizeProjectText } from './utils'

export function useProjectsRevisionPopups({
  projects,
  supabase,
}: {
  projects: ProjectRowDb[]
  supabase: SupabaseClient
}) {
  const [revisionPopupByProject, setRevisionPopupByProject] = useState<Record<string, RevisionPopupData>>({})

  useEffect(() => {
    const projectIds = Array.from(new Set(projects.map((project) => normalizeProjectText(project.id)).filter(Boolean)))
    if (!projectIds.length) {
      queueMicrotask(() => setRevisionPopupByProject({}))
      return
    }

    const loadingState: Record<string, RevisionPopupData> = {}
    for (const projectId of projectIds) {
      loadingState[projectId] = { loading: true, rows: emptyRevisionRows() }
    }
    queueMicrotask(() => setRevisionPopupByProject(loadingState))

    let cancelled = false

    ;(async () => {
      try {
        const next = await fetchProjectRevisionPopupData(supabase, projects)
        if (!cancelled) setRevisionPopupByProject(next)
      } catch {
        if (!cancelled) {
          const fallback: Record<string, RevisionPopupData> = {}
          for (const projectId of projectIds) {
            fallback[projectId] = { loading: false, rows: emptyRevisionRows(), error: true }
          }
          setRevisionPopupByProject(fallback)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projects, supabase])

  return {
    revisionDataFor(projectId: string): RevisionPopupData {
      return revisionPopupByProject[projectId] ?? { loading: true, rows: emptyRevisionRows() }
    },
    revisionPopupByProject,
  }
}
