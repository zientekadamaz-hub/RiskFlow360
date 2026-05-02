'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import { cellKey } from './matrix-config'
import type { RiskColor } from './matrix-colors'
import type { RiskMatrixContext, RiskMatrixMode, RpnInputKey, RpnInputState, RpnThresholds } from './types'
import { clearRiskMatrixCache, readRiskMatrixCache, writeRiskMatrixCache } from './risk-matrix-cache'
import {
  DEFAULT_RPN,
  buildDefaultCells,
  clampInt,
  normalizeRpnThresholds,
} from './risk-matrix-utils'
import {
  loadRiskMatrixContext,
  loadRiskMatrixCells,
  loadRiskMatrixConfig,
  saveRiskMatrixCells,
  saveRiskMatrixConfig,
} from './risk-matrix-service'

function toInputState(rpn: RpnThresholds): RpnInputState {
  return {
    green: String(rpn.greenMax),
    orange: String(rpn.orangeMax),
    yellow: String(rpn.yellowMax),
  }
}

function valueForInputKind(rpn: RpnThresholds, kind: RpnInputKey) {
  if (kind === 'green') return rpn.greenMax
  if (kind === 'yellow') return rpn.yellowMax
  return rpn.orangeMax
}

function patchForInputKind(kind: RpnInputKey, value: number): Partial<RpnThresholds> {
  if (kind === 'green') return { greenMax: value }
  if (kind === 'yellow') return { yellowMax: value }
  return { orangeMax: value }
}

export function useRiskMatrixController() {
  const [loading, setLoading] = useState(true)
  const [uiError, setUiError] = useState<string | null>(null)
  const [context, setContext] = useState<RiskMatrixContext | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [mode, setMode] = useState<RiskMatrixMode>('manual')
  const [rpn, setRpn] = useState<RpnThresholds>(DEFAULT_RPN)
  const [rpnInput, setRpnInput] = useState<RpnInputState>(() => toInputState(DEFAULT_RPN))
  const [cells, setCells] = useState<Record<string, RiskColor>>({})

  const cfgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef<Record<string, RiskColor>>({})
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const statusText = useMemo(() => {
    if (loading) return 'Loading...'
    return mode === 'manual' ? 'Manual: click cells to set colors.' : 'RPN: colors are calculated from thresholds.'
  }, [loading, mode])

  const queueSaveConfig = useCallback((riskContext: RiskMatrixContext, nextMode: RiskMatrixMode, nextRpn: RpnThresholds) => {
    if (cfgTimer.current) clearTimeout(cfgTimer.current)
    cfgTimer.current = setTimeout(async () => {
      const error = await saveRiskMatrixConfig(riskContext, nextMode, nextRpn)
      if (error) setUiError(error)
    }, 250)
  }, [])

  const loadAll = useCallback(async (foreground = true) => {
    if (foreground) setLoading(true)
    setUiError(null)

    try {
      const contextResult = await loadRiskMatrixContext()
      setUserId(contextResult.userId)
      let nextContext = contextResult.context

      if (!nextContext && contextResult.timeout) {
        const cached = readRiskMatrixCache()
        if (cached?.userId === contextResult.userId) {
          nextContext = {
            globalRole: cached.globalRole,
            id: cached.scopeId,
            kind: cached.scopeKind,
            notice: cached.scopeKind === 'system_default'
              ? 'You are editing system defaults. These values are saved as the fallback Risk Matrix configuration.'
              : 'Changes are saved automatically for the active organization.',
            userId: cached.userId,
          }
        }
      }

      if (!nextContext) {
        if (cfgTimer.current) clearTimeout(cfgTimer.current)
        if (flushTimer.current) clearTimeout(flushTimer.current)
        dirtyRef.current = {}
        setContext(null)
        setCells({})
        clearRiskMatrixCache()
        if (contextResult.error) setUiError(contextResult.error)
        return
      }

      setContext(nextContext)
      setCells(buildDefaultCells())

      const [configResult, cellsResult] = await Promise.all([
        loadRiskMatrixConfig(nextContext),
        loadRiskMatrixCells(nextContext),
      ])

      if (configResult.error) setUiError(configResult.error)
      if (cellsResult.error) setUiError(cellsResult.error)

      if (configResult.config) {
        setMode(configResult.config.mode)
        setRpn(configResult.config.rpn)
      }

      if (cellsResult.cells) {
        setCells(cellsResult.cells)
      }

      if (configResult.config && cellsResult.cells && contextResult.userId) {
        writeRiskMatrixCache({
          cells: cellsResult.cells,
          globalRole: nextContext.globalRole,
          mode: configResult.config.mode,
          rpn: configResult.config.rpn,
          scopeId: nextContext.id,
          scopeKind: nextContext.kind,
          userId: contextResult.userId,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll(true)
  }, [loadAll])

  useEffect(() => {
    if (!context || !userId) return
    writeRiskMatrixCache({
      cells,
      globalRole: context.globalRole,
      mode,
      rpn,
      scopeId: context.id,
      scopeKind: context.kind,
      userId,
    })
  }, [cells, context, mode, rpn, userId])

  useEffect(() => {
    setRpnInput(toInputState(rpn))
  }, [rpn])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') clearRiskMatrixCache()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const flushDirty = useCallback(async () => {
    if (!context) return

    const snapshot = dirtyRef.current
    if (!Object.keys(snapshot).length) return

    dirtyRef.current = {}
    const result = await saveRiskMatrixCells(context, snapshot)
    if (result) {
      setUiError(result.message)
      dirtyRef.current = result.restoredChanges
    }
  }, [context])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void flushDirty()
    }
    const onPageHide = () => void flushDirty()

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [flushDirty])

  useEffect(() => {
    return () => {
      if (cfgTimer.current) clearTimeout(cfgTimer.current)
      if (flushTimer.current) clearTimeout(flushTimer.current)
    }
  }, [])

  const queueManualChange = useCallback((severity: number, doValue: number, color: RiskColor) => {
    const key = cellKey(severity, doValue)
    dirtyRef.current = { ...dirtyRef.current, [key]: color }

    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(() => void flushDirty(), 250)
  }, [flushDirty])

  const setModeSafe = useCallback((nextMode: RiskMatrixMode) => {
    if (!context) return
    setUiError(null)
    setMode(nextMode)
    queueSaveConfig(context, nextMode, rpn)
  }, [context, queueSaveConfig, rpn])

  const updateRpn = useCallback((patch: Partial<RpnThresholds>) => {
    if (!context) return

    const next = normalizeRpnThresholds({
      greenMax: patch.greenMax ?? rpn.greenMax,
      orangeMax: patch.orangeMax ?? rpn.orangeMax,
      yellowMax: patch.yellowMax ?? rpn.yellowMax,
    })

    setRpn(next)
    queueSaveConfig(context, mode, next)
  }, [context, mode, queueSaveConfig, rpn.greenMax, rpn.orangeMax, rpn.yellowMax])

  const setRpnInputValue = useCallback((kind: RpnInputKey, value: string) => {
    const next = value.replace(/\D/g, '')
    setRpnInput((prev) => ({ ...prev, [kind]: next }))
  }, [])

  const commitRpnInput = useCallback((kind: RpnInputKey) => {
    const raw = rpnInput[kind].trim()
    if (!raw) {
      setRpnInput((prev) => ({ ...prev, [kind]: String(valueForInputKind(rpn, kind)) }))
      return
    }

    const numeric = Number(raw.replace(',', '.'))
    if (!Number.isFinite(numeric)) {
      setRpnInput((prev) => ({ ...prev, [kind]: String(valueForInputKind(rpn, kind)) }))
      return
    }

    const nextRpn = normalizeRpnThresholds({
      greenMax: kind === 'green' ? numeric : rpn.greenMax,
      orangeMax: kind === 'orange' ? numeric : rpn.orangeMax,
      yellowMax: kind === 'yellow' ? numeric : rpn.yellowMax,
    })

    setRpnInput(toInputState(nextRpn))
    updateRpn(patchForInputKind(kind, numeric))
  }, [rpn, rpnInput, updateRpn])

  const adjustRpnInput = useCallback((kind: RpnInputKey, delta: number) => {
    const raw = rpnInput[kind].trim()
    const base = Number(raw.replace(',', '.'))
    const current = Number.isFinite(base) ? base : valueForInputKind(rpn, kind)
    const next = clampInt(current + delta, 1, 1000)

    setRpnInput((prev) => ({ ...prev, [kind]: String(next) }))
    updateRpn(patchForInputKind(kind, next))
  }, [rpn, rpnInput, updateRpn])

  const applyCellColor = useCallback((severity: number, doValue: number, color: RiskColor) => {
    const key = cellKey(severity, doValue)
    setCells((prev) => ({ ...prev, [key]: color }))
    queueManualChange(severity, doValue, color)
  }, [queueManualChange])

  return {
    adjustRpnInput,
    applyCellColor,
    cells,
    commitRpnInput,
    context,
    loading,
    mode,
    rpn,
    rpnInput,
    setModeSafe,
    setRpnInputValue,
    statusText,
    uiError,
  }
}
