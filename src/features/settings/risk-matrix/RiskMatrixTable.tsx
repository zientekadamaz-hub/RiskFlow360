'use client'

import type { Dispatch, SetStateAction } from 'react'
import { projectsProcessCellStyle } from '@/features/projects/view-styles'
import {
  settingsProcessAccent,
  settingsRiskMatrixCellFill,
  settingsTableCellStyle,
  settingsTableHeaderStyle,
  settingsTableScrollerStyle,
  settingsTableWrapStyle,
} from '@/features/settings/invitation-shell'
import { DO_VALUES, SEVERITIES, cellKey, defaultColor } from './matrix-config'
import type { RiskColor } from './matrix-colors'
import { colorFromRpn } from './risk-matrix-utils'
import type { RiskMatrixMode, RpnThresholds } from './types'

const hairline = 0.5
const thinBorderColor = 'rgba(255,255,255,0.14)'

const tableHeaderStyle: React.CSSProperties = {
  ...settingsTableHeaderStyle,
  padding: '5px 6px',
  position: 'sticky',
  textAlign: 'center',
  top: 0,
  zIndex: 3,
}

const severityHeaderStyle: React.CSSProperties = {
  ...settingsTableHeaderStyle,
  borderBottomColor: thinBorderColor,
  borderBottomStyle: 'solid',
  borderBottomWidth: hairline,
  borderRightColor: thinBorderColor,
  borderRightStyle: 'solid',
  borderRightWidth: hairline,
  left: 0,
  minWidth: 88,
  padding: '5px 8px',
  position: 'sticky',
  textAlign: 'center',
  width: 88,
  zIndex: 4,
}

const matrixCellStyle: React.CSSProperties = {
  ...settingsTableCellStyle,
  aspectRatio: '1 / 1',
  borderColor: thinBorderColor,
  borderStyle: 'solid',
  borderWidth: hairline,
  color: 'rgba(0,0,0,0.65)',
  fontSize: 12,
  fontWeight: 800,
  padding: 0,
  textAlign: 'center',
  userSelect: 'none',
  verticalAlign: 'middle',
  width: 'auto',
}

const axisLabelStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.78)',
  fontSize: 12.5,
  fontWeight: 700,
  marginTop: 8,
  textAlign: 'center',
  whiteSpace: 'nowrap',
}

type RiskMatrixTableProps = {
  cells: Record<string, RiskColor>
  hoverKey: string | null
  mode: RiskMatrixMode
  onCellClick: (event: React.MouseEvent<HTMLTableCellElement>, severity: number, doValue: number, color: RiskColor) => void
  rpn: RpnThresholds
  setHoverKey: Dispatch<SetStateAction<string | null>>
}

export function RiskMatrixTable({
  cells,
  hoverKey,
  mode,
  onCellClick,
  rpn,
  setHoverKey,
}: RiskMatrixTableProps) {
  return (
    <div style={{ ...settingsTableWrapStyle, border: 'none' }}>
      <div style={{ ...settingsTableScrollerStyle, padding: 10 }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...severityHeaderStyle, color: settingsProcessAccent }}>Severity</th>
              {DO_VALUES.map((value) => (
                <th key={value} style={tableHeaderStyle}>
                  {value}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {SEVERITIES.map((severity) => (
              <tr key={severity}>
                <th style={{ ...severityHeaderStyle, top: 'auto' }}>
                  <div style={{ ...projectsProcessCellStyle, justifyContent: 'center' }}>{severity}</div>
                </th>

                {DO_VALUES.map((doValue) => {
                  const key = cellKey(severity, doValue)
                  const cellColor =
                    mode === 'manual'
                      ? (cells[key] ?? defaultColor(severity, doValue))
                      : colorFromRpn(severity, doValue, rpn)
                  const rpnValue = severity * doValue
                  const isHover = hoverKey === key

                  return (
                    <td
                      key={doValue}
                      onMouseEnter={() => setHoverKey(key)}
                      onMouseLeave={() => setHoverKey((current) => (current === key ? null : current))}
                      onClick={(event) => onCellClick(event, severity, doValue, cellColor)}
                      title={`Severity: ${severity} | Occurrence × Detection: ${doValue} | RPN: ${rpnValue}`}
                      style={{
                        ...matrixCellStyle,
                        background: settingsRiskMatrixCellFill(cellColor),
                        cursor: mode === 'manual' ? 'pointer' : 'default',
                      }}
                    >
                      {isHover ? rpnValue : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div style={axisLabelStyle}>Occurrence × Detection</div>
      </div>
    </div>
  )
}
