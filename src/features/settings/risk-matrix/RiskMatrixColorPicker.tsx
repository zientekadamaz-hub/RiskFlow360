'use client'

import { createPortal } from 'react-dom'
import {
  settingsPopoverPanelStyle,
  settingsRiskMatrixSwatchButtonStyle,
  settingsRiskMatrixSwatchStyle,
} from '@/components/rf-ui'
import { COLOR_ORDER, type RiskColor } from './matrix-colors'
import { legendRows } from './risk-matrix-utils'
import type { RiskMatrixColorPickerState } from './types'

type RiskMatrixColorPickerProps = {
  colorPicker: RiskMatrixColorPickerState
  onClose: () => void
  onSelect: (severity: number, doValue: number, color: RiskColor) => void
}

export function RiskMatrixColorPicker({
  colorPicker,
  onClose,
  onSelect,
}: RiskMatrixColorPickerProps) {
  if (!colorPicker) return null

  return createPortal(
    <div
      style={{ inset: 0, position: 'fixed', zIndex: 90 }}
      onMouseDown={onClose}
    >
      <div
        style={{
          ...settingsPopoverPanelStyle,
          left: colorPicker.left,
          padding: 10,
          position: 'fixed',
          top: colorPicker.top,
          width: 190,
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {COLOR_ORDER.map((color) => {
            const selected = colorPicker.currentColor === color
            const label = legendRows.find((row) => row.color === color)?.title ?? color.toUpperCase()

            return (
              <button
                key={color}
                type="button"
                className="rf-button"
                title={label}
                aria-label={`Set ${label.toLowerCase()} risk color`}
                style={{
                  ...settingsRiskMatrixSwatchButtonStyle,
                  background: selected ? 'rgba(217,168,108,0.16)' : 'rgba(255,255,255,0.08)',
                  borderColor: selected ? 'rgba(217,168,108,0.55)' : 'rgba(255,255,255,0.18)',
                }}
                onClick={() => onSelect(colorPicker.severity, colorPicker.doValue, color)}
              >
                <span aria-hidden="true" style={settingsRiskMatrixSwatchStyle(color)} />
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
