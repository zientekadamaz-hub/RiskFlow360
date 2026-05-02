import type { CSSProperties } from 'react'

import { settingsCompactActionButtonStyle } from './buttons'
import { settingsRiskSummaryTileStyle } from './summary'
import {
  settingsRiskMatrixCellFill,
  type SettingsRiskColor,
} from './tokens'

export function settingsRiskMatrixControlTileStyle(color: SettingsRiskColor): CSSProperties {
  return {
    ...settingsRiskSummaryTileStyle(color),
    position: 'relative',
    minHeight: 86,
    padding: '10px 12px',
    display: 'block',
    gap: 8,
    textAlign: 'center',
  }
}

export const settingsRiskMatrixLegendLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.35,
  color: 'rgba(248,250,252,0.86)',
  textAlign: 'center',
  width: '100%',
}

export const settingsRiskMatrixThresholdRowStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 12,
  transform: 'translateX(-50%)',
  display: 'grid',
  alignItems: 'center',
  gridTemplateColumns: '42px 83px',
  justifyContent: 'center',
  columnGap: 8,
  width: 133,
}

export const settingsRiskMatrixComparatorStyle: CSSProperties = {
  width: 42,
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

export const settingsRiskMatrixValuePillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 62,
  height: 25,
  minHeight: 25,
  boxSizing: 'border-box',
  padding: '0 8px',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 7,
  background: 'rgba(40,39,47,0.82)',
  color: '#fff',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: '25px',
}

export const settingsRiskMatrixValueControlStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  width: 83,
}

export const settingsRiskMatrixStepperButtonStyle: CSSProperties = {
  width: 17,
  height: 12,
  minHeight: 12,
  padding: 0,
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(40,39,47,0.72)',
  color: 'rgba(255,255,255,0.78)',
  cursor: 'pointer',
  fontSize: 8,
  fontWeight: 800,
  lineHeight: '10px',
}

export const settingsRiskMatrixSwatchButtonStyle: CSSProperties = {
  ...settingsCompactActionButtonStyle,
  width: 36,
  height: 36,
  minHeight: 36,
  padding: 0,
  justifyContent: 'center',
}

export function settingsRiskMatrixSwatchStyle(color: SettingsRiskColor): CSSProperties {
  return {
    width: 14,
    height: 14,
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.24)',
    background: settingsRiskMatrixCellFill(color),
  }
}

