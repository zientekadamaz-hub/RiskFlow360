'use client'

import React, { useEffect, useState } from 'react'
import {
  SettingsBanner,
  SettingsPageShell,
  SettingsSection,
  settingsFrameStyle,
  settingsProcessAccent,
  settingsSegmentButtonStyle,
} from '@/components/rf-ui'
import type { RiskColor } from '@/features/settings/risk-matrix/matrix-colors'
import { RiskMatrixColorPicker } from '@/features/settings/risk-matrix/RiskMatrixColorPicker'
import { RiskMatrixSummaryTiles } from '@/features/settings/risk-matrix/RiskMatrixSummaryTiles'
import { RiskMatrixTable } from '@/features/settings/risk-matrix/RiskMatrixTable'
import type { RiskMatrixColorPickerState } from '@/features/settings/risk-matrix/types'
import { useRiskMatrixController } from '@/features/settings/risk-matrix/use-risk-matrix-controller'

function modeButtonStyle(active: boolean): React.CSSProperties {
  return {
    ...settingsSegmentButtonStyle(active),
    height: 29,
  }
}

export default function RiskMatrixPage() {
  const {
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
  } = useRiskMatrixController()

  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [colorPicker, setColorPicker] = useState<RiskMatrixColorPickerState>(null)

  useEffect(() => {
    if (!colorPicker) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setColorPicker(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [colorPicker])

  const openColorPicker = (
    event: React.MouseEvent<HTMLTableCellElement>,
    severity: number,
    doValue: number,
    currentColor: RiskColor
  ) => {
    if (mode !== 'manual') return

    const rect = event.currentTarget.getBoundingClientRect()
    setColorPicker({
      currentColor,
      doValue,
      left: Math.min(window.innerWidth - 220, Math.max(12, rect.left + rect.width / 2 - 94)),
      severity,
      top: Math.min(window.innerHeight - 220, rect.bottom + 8),
    })
  }

  const selectColor = (severity: number, doValue: number, color: RiskColor) => {
    applyCellColor(severity, doValue, color)
    setColorPicker(null)
  }

  if (!loading && !context) {
    return (
      <SettingsPageShell
        title="Risk Matrix"
        titleStyle={{ color: settingsProcessAccent }}
        subtitle="Risk Matrix settings are scoped to a selected organization."
      >
        {uiError ? (
          <SettingsBanner tone="neutral">
            <b>Risk Matrix context required:</b> {uiError}
          </SettingsBanner>
        ) : null}
      </SettingsPageShell>
    )
  }

  return (
    <SettingsPageShell
      title="Risk Matrix"
      titleStyle={{ color: settingsProcessAccent }}
      subtitle="Configure risk classification using Manual matrix colors or RPN thresholds."
      summary={
        <RiskMatrixSummaryTiles
          adjustRpnInput={adjustRpnInput}
          commitRpnInput={commitRpnInput}
          mode={mode}
          rpn={rpn}
          rpnInput={rpnInput}
          setRpnInputValue={setRpnInputValue}
        />
      }
    >
      <div style={{ ...settingsFrameStyle, marginTop: 10 }}>
        <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
          <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: 650 }}>{statusText}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
            <button className="rf-button" onClick={() => setModeSafe('manual')} style={modeButtonStyle(mode === 'manual')}>
              MANUAL
            </button>
            <button className="rf-button" onClick={() => setModeSafe('rpn')} style={modeButtonStyle(mode === 'rpn')}>
              RPN
            </button>
          </div>
        </div>
      </div>

      {uiError ? (
        <SettingsBanner tone="error">
          <b>Database error:</b> {uiError}
        </SettingsBanner>
      ) : null}

      <SettingsSection style={{ overflow: 'visible', padding: 0 }}>
        <RiskMatrixTable
          cells={cells}
          hoverKey={hoverKey}
          mode={mode}
          onCellClick={openColorPicker}
          rpn={rpn}
          setHoverKey={setHoverKey}
        />
      </SettingsSection>

      <SettingsSection style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, padding: '10px 12px' }}>
        {context?.notice ?? 'Changes are saved automatically.'}
      </SettingsSection>

      <RiskMatrixColorPicker
        colorPicker={colorPicker}
        onClose={() => setColorPicker(null)}
        onSelect={selectColor}
      />
    </SettingsPageShell>
  )
}
