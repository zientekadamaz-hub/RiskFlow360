'use client'

import type { CSSProperties, KeyboardEvent } from 'react'
import {
  settingsCompactInputStyle,
  settingsRiskMatrixComparatorStyle,
  settingsRiskMatrixControlTileStyle,
  settingsRiskMatrixLegendLabelStyle,
  settingsRiskMatrixStepperButtonStyle,
  settingsRiskMatrixThresholdRowStyle,
  settingsRiskMatrixValueControlStyle,
  settingsRiskMatrixValuePillStyle,
} from '@/features/settings/invitation-shell'
import { legendRows } from './risk-matrix-utils'
import type { RiskMatrixMode, RpnInputKey, RpnInputState, RpnThresholds } from './types'

const inputBoxStyle: CSSProperties = {
  ...settingsCompactInputStyle,
  fontWeight: 700,
  textAlign: 'center',
  width: 100,
}

type RiskMatrixSummaryTilesProps = {
  adjustRpnInput: (kind: RpnInputKey, delta: number) => void
  commitRpnInput: (kind: RpnInputKey) => void
  mode: RiskMatrixMode
  rpn: RpnThresholds
  rpnInput: RpnInputState
  setRpnInputValue: (kind: RpnInputKey, value: string) => void
}

export function RiskMatrixSummaryTiles({
  adjustRpnInput,
  commitRpnInput,
  mode,
  rpn,
  rpnInput,
  setRpnInputValue,
}: RiskMatrixSummaryTilesProps) {
  const handleInputKeyDown = (kind: RpnInputKey) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      adjustRpnInput(kind, event.shiftKey ? 10 : 1)
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      adjustRpnInput(kind, event.shiftKey ? -10 : -1)
    }
  }

  const renderRpnInput = (kind: RpnInputKey) => (
    <span
      style={{
        ...settingsRiskMatrixValueControlStyle,
        pointerEvents: mode === 'rpn' ? 'auto' : 'none',
        visibility: mode === 'rpn' ? 'visible' : 'hidden',
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        value={rpnInput[kind]}
        onChange={(event) => setRpnInputValue(kind, event.target.value)}
        onKeyDown={handleInputKeyDown(kind)}
        onBlur={() => commitRpnInput(kind)}
        style={{
          ...inputBoxStyle,
          ...settingsRiskMatrixValuePillStyle,
        }}
      />
      <span style={{ display: 'grid', gap: 2 }}>
        <button
          type="button"
          aria-label="Increase RPN threshold"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => adjustRpnInput(kind, 1)}
          style={settingsRiskMatrixStepperButtonStyle}
        >
          ▲
        </button>
        <button
          type="button"
          aria-label="Decrease RPN threshold"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => adjustRpnInput(kind, -1)}
          style={settingsRiskMatrixStepperButtonStyle}
        >
          ▼
        </button>
      </span>
    </span>
  )

  const renderStaticRpnValue = (value: number) => (
    <span
      style={{
        ...settingsRiskMatrixValueControlStyle,
        visibility: mode === 'rpn' ? 'visible' : 'hidden',
      }}
    >
      <span style={settingsRiskMatrixValuePillStyle}>{value}</span>
      <span aria-hidden="true" style={{ width: 17 }} />
    </span>
  )

  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
      <div style={settingsRiskMatrixControlTileStyle('red')}>
        <div style={settingsRiskMatrixLegendLabelStyle}>{legendRows[3].desc}</div>
        <div style={{ ...settingsRiskMatrixThresholdRowStyle, visibility: mode === 'rpn' ? 'visible' : 'hidden' }}>
          <span style={settingsRiskMatrixComparatorStyle}>RPN &gt;</span>
          {renderStaticRpnValue(rpn.orangeMax)}
        </div>
      </div>
      <div style={settingsRiskMatrixControlTileStyle('orange')}>
        <div style={settingsRiskMatrixLegendLabelStyle}>{legendRows[2].desc}</div>
        <div
          style={{
            ...settingsRiskMatrixThresholdRowStyle,
            pointerEvents: mode === 'rpn' ? 'auto' : 'none',
            visibility: mode === 'rpn' ? 'visible' : 'hidden',
          }}
        >
          <span style={settingsRiskMatrixComparatorStyle}>RPN ≤</span>
          {renderRpnInput('orange')}
        </div>
      </div>
      <div style={settingsRiskMatrixControlTileStyle('yellow')}>
        <div style={settingsRiskMatrixLegendLabelStyle}>{legendRows[1].desc}</div>
        <div
          style={{
            ...settingsRiskMatrixThresholdRowStyle,
            pointerEvents: mode === 'rpn' ? 'auto' : 'none',
            visibility: mode === 'rpn' ? 'visible' : 'hidden',
          }}
        >
          <span style={settingsRiskMatrixComparatorStyle}>RPN ≤</span>
          {renderRpnInput('yellow')}
        </div>
      </div>
      <div style={settingsRiskMatrixControlTileStyle('green')}>
        <div style={settingsRiskMatrixLegendLabelStyle}>{legendRows[0].desc}</div>
        <div
          style={{
            ...settingsRiskMatrixThresholdRowStyle,
            pointerEvents: mode === 'rpn' ? 'auto' : 'none',
            visibility: mode === 'rpn' ? 'visible' : 'hidden',
          }}
        >
          <span style={settingsRiskMatrixComparatorStyle}>RPN ≤</span>
          {renderRpnInput('green')}
        </div>
      </div>
    </div>
  )
}
