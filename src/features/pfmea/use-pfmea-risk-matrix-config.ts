import { useCallback, useState } from 'react'

import { supabase } from '@app/lib/supabaseBrowser'

import {
  GLOBAL_PROJECT_ID,
  cellKey,
  clampInt,
  type DbCell,
  type DbConfig,
  type Mode,
  type RiskColor,
  type RpnThresholds,
} from './pfmea-risk-matrix-config'
import { riskColorForMatrixCell, riskColorFromRpnValue } from '@/lib/risk-engine'

export function usePfmeaRiskMatrixConfig(projectId: string) {
  const [rmMode, setRmMode] = useState<Mode>('rpn')
  const [rmRpn, setRmRpn] = useState<RpnThresholds>({ greenMax: 100, yellowMax: 168, orangeMax: 360 })
  const [rmCells, setRmCells] = useState<Record<string, RiskColor>>({})

  const loadRiskMatrix = useCallback(async () => {
    const normalizeId = (value: unknown) => (value ?? '').toString().trim()
    let organizationId = ''

    if (projectId) {
      const projectRes = await supabase
        .from('projects')
        .select('organization_id')
        .eq('id', projectId)
        .maybeSingle()

      if (!projectRes.error) {
        organizationId = normalizeId((projectRes.data as { organization_id?: string | null } | null)?.organization_id)
      }
    }

    const cfg = organizationId
      ? await supabase
          .from('risk_matrix_config')
          .select('id,mode,rpn_green_max,rpn_yellow_max,rpn_orange_max,organization_id')
          .eq('organization_id', organizationId)
          .maybeSingle()
      : { data: null, error: null }

    const fallbackCfg = cfg.error || !cfg.data
      ? await supabase
          .from('risk_matrix_config')
          .select('id,mode,rpn_green_max,rpn_yellow_max,rpn_orange_max')
          .eq('id', 1)
          .maybeSingle()
      : cfg

    if (!fallbackCfg.error && fallbackCfg.data) {
      const c = fallbackCfg.data as DbConfig
      setRmMode(c.mode)
      setRmRpn({
        greenMax: clampInt(c.rpn_green_max, 1, 1000),
        yellowMax: clampInt(c.rpn_yellow_max, 1, 1000),
        orangeMax: clampInt(c.rpn_orange_max, 1, 1000),
      })
    }

    let cellsRes: {
      data: unknown[] | null
      error: unknown
    } = organizationId
      ? await supabase
          .from('risk_matrix_cells')
          .select('organization_id,severity,do_value,color')
          .eq('organization_id', organizationId)
      : { data: null, error: null }

    if (cellsRes.error || !cellsRes.data?.length) {
      cellsRes = await supabase
        .from('risk_matrix_cells')
        .select('project_id,severity,do_value,color')
        .eq('project_id', GLOBAL_PROJECT_ID)
    }

    if (!cellsRes.error) {
      const map: Record<string, RiskColor> = {}
      for (const row of (cellsRes.data ?? []) as unknown as DbCell[]) {
        map[cellKey(row.severity, row.do_value)] = row.color
      }
      setRmCells(map)
    }
  }, [projectId])

  const getRiskColorFor = useCallback((sev: number | null, doVal: number | null): RiskColor | null => {
    return riskColorForMatrixCell(sev, doVal, rmMode, rmRpn, rmCells) as RiskColor | null
  }, [rmCells, rmMode, rmRpn])

  const getRiskColorForAverageRpn = useCallback((value: number | null): RiskColor | null => {
    if (value == null || !Number.isFinite(value)) return null
    return riskColorFromRpnValue(value, rmRpn)
  }, [rmRpn])

  return {
    getRiskColorFor,
    getRiskColorForAverageRpn,
    loadRiskMatrix,
    rmCells,
    rmMode,
    rmRpn,
  }
}
