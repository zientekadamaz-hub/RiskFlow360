'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import {
  fetchOpenRiskSummary,
  fetchRiskMatrixCells,
  fetchRiskMatrixConfig,
} from './projects-service'
import type { Mode, RiskColor, RpnThresholds, UiProjectRow } from './types'

const EMPTY_RISK_COLOR_COUNTS: Record<RiskColor, number> = {
  red: 0,
  orange: 0,
  yellow: 0,
  green: 0,
}

export function useProjectsRiskSummary({
  filtersReady,
  loading,
  orgId,
  openProjects,
}: {
  filtersReady: boolean
  loading: boolean
  orgId: string | null
  openProjects: UiProjectRow[]
}) {
  const [riskCount, setRiskCount] = useState(0)
  const [openRiskAvgRpn, setOpenRiskAvgRpn] = useState<number | null>(null)
  const [rmMode, setRmMode] = useState<Mode>('rpn')
  const [rmRpn, setRmRpn] = useState<RpnThresholds>({ greenMax: 100, yellowMax: 168, orangeMax: 360 })
  const [rmCells, setRmCells] = useState<Record<string, RiskColor>>({})
  const [riskColorCounts, setRiskColorCounts] = useState<Record<RiskColor, number>>(EMPTY_RISK_COLOR_COUNTS)

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        const config = await fetchRiskMatrixConfig(supabase, orgId)
        if (active) {
          setRmMode(config.mode)
          setRmRpn(config.thresholds)
        }
      } catch {}

      try {
        const cells = await fetchRiskMatrixCells(supabase, { orgId })
        if (active) setRmCells(cells)
      } catch {}
    })()

    return () => {
      active = false
    }
  }, [orgId])

  useEffect(() => {
    let cancelled = false

    const loadRiskCount = async () => {
      if (loading || !filtersReady) return
      const revisionIds = openProjects.map((project) => project.currentRevisionId).filter(Boolean)
      if (!revisionIds.length) {
        if (cancelled) return
        setRiskCount(0)
        setOpenRiskAvgRpn(null)
        setRiskColorCounts(EMPTY_RISK_COLOR_COUNTS)
        return
      }

      try {
        const summary = await fetchOpenRiskSummary(supabase, revisionIds, {
          mode: rmMode,
          thresholds: rmRpn,
          cells: rmCells,
        })
        if (cancelled) return
        setRiskCount(summary.riskCount)
        setOpenRiskAvgRpn(summary.openRiskAvgRpn)
        setRiskColorCounts(summary.riskColorCounts)
      } catch {
        if (cancelled) return
        setRiskCount(0)
        setOpenRiskAvgRpn(null)
        setRiskColorCounts(EMPTY_RISK_COLOR_COUNTS)
      }
    }

    void loadRiskCount()

    return () => {
      cancelled = true
    }
  }, [openProjects, loading, filtersReady, rmMode, rmRpn, rmCells])

  return {
    openRiskAvgRpn,
    riskColorCounts,
    riskCount,
    rmRpn,
  }
}
