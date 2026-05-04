import { useCallback, useState } from 'react'

import { supabase } from '@app/lib/supabaseBrowser'

import { parseExamples, shortSeverityLabel } from './pfmea-display-utils'
import type { SeverityEffectiveRow, SeverityOption } from './pfmea-types'

export function usePfmeaScaleOptions(projectId: string) {
  const [severityOptions, setSeverityOptions] = useState<SeverityOption[]>([])
  const [occurrenceOptions, setOccurrenceOptions] = useState<SeverityOption[]>([])
  const [detectionOptions, setDetectionOptions] = useState<SeverityOption[]>([])

  const clearScaleOptions = useCallback(() => {
    setSeverityOptions([])
    setOccurrenceOptions([])
    setDetectionOptions([])
  }, [])

  const loadScaleOptions = useCallback(async () => {
    if (!projectId) {
      clearScaleOptions()
      return
    }

    const projectRes = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .maybeSingle()

    if (projectRes.error) throw projectRes.error

    const orgId = (projectRes.data as { organization_id?: string | null } | null)?.organization_id ?? null
    if (!orgId) {
      clearScaleOptions()
      return
    }

    const [sevRes, occRes, detRes] = await Promise.all([
      supabase.rpc('get_severity_effective', { p_org: orgId }),
      supabase.rpc('get_occurrence_effective', { p_org: orgId }),
      supabase.rpc('get_detection_effective', { p_org: orgId }),
    ])

    if (sevRes.error) throw sevRes.error
    if (occRes.error) throw occRes.error
    if (detRes.error) throw detRes.error

    const toOptions = (rowsRaw: SeverityEffectiveRow[]) =>
      rowsRaw
        .filter((row) => row.active !== false && Number.isFinite(row.level))
        .sort((a, b) => b.level - a.level)
        .map((row) => ({
          level: row.level,
          label: shortSeverityLabel(row.name ?? null, row.description ?? null),
          examples: parseExamples(row.description ?? null),
        }))

    setSeverityOptions(toOptions((sevRes.data ?? []) as SeverityEffectiveRow[]))
    setOccurrenceOptions(toOptions((occRes.data ?? []) as SeverityEffectiveRow[]))
    setDetectionOptions(toOptions((detRes.data ?? []) as SeverityEffectiveRow[]))
  }, [clearScaleOptions, projectId])

  return {
    detectionOptions,
    loadScaleOptions,
    occurrenceOptions,
    severityOptions,
  }
}
