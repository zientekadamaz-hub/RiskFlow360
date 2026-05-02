import type { CSSProperties, ReactNode } from 'react'

import {
  settingsStatValueStyle,
  type SettingsRiskColor,
} from './tokens'

export const settingsSummaryTileStyle: CSSProperties = {
  minHeight: 82,
  padding: '10px 12px',
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  textAlign: 'center',
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.22)',
}

export const settingsSummaryGridStyle: CSSProperties = {
  width: '100%',
  maxWidth: 920,
  display: 'grid',
  gap: 10,
}

const settingsSummaryGridStandardColumns = 7
const settingsSummaryGridStandardMaxWidth = 920
const settingsSummaryGridGapPx = 10
const settingsSummaryTileStandardWidth =
  (settingsSummaryGridStandardMaxWidth - (settingsSummaryGridStandardColumns - 1) * settingsSummaryGridGapPx) /
  settingsSummaryGridStandardColumns

export function getSettingsSummaryGridMaxWidth(columns: number) {
  return Math.round(settingsSummaryTileStandardWidth * columns + settingsSummaryGridGapPx * Math.max(columns - 1, 0))
}

export function settingsRiskSummaryTileStyle(color: SettingsRiskColor): CSSProperties {
  const byColor: Record<SettingsRiskColor, CSSProperties> = {
    red: {
      background: 'rgba(239,68,68,0.12)',
      border: '1px solid rgba(239,68,68,0.35)',
    },
    orange: {
      background: 'rgba(251,146,60,0.18)',
      border: '1px solid rgba(251,146,60,0.45)',
    },
    yellow: {
      background: 'rgba(250,204,21,0.22)',
      border: '1px solid rgba(250,204,21,0.55)',
    },
    green: {
      background: 'rgba(34,197,94,0.18)',
      border: '1px solid rgba(34,197,94,0.45)',
    },
  }

  return {
    ...settingsSummaryTileStyle,
    ...byColor[color],
  }
}

export function SettingsSummaryGrid({
  children,
  columns = 7,
  maxWidth = settingsSummaryGridStandardMaxWidth,
}: {
  children: ReactNode
  columns?: number
  maxWidth?: number
}) {
  return (
    <div
      style={{
        ...settingsSummaryGridStyle,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        maxWidth,
      }}
    >
      {children}
    </div>
  )
}

export function SettingsSummaryTile({
  label,
  style,
  value,
  valueStyle,
}: {
  label: ReactNode
  style?: CSSProperties
  value: ReactNode
  valueStyle?: CSSProperties
}) {
  return (
    <div style={{ ...settingsSummaryTileStyle, ...style }}>
      <div style={{ fontSize: 12, color: '#f8fafc' }}>{label}</div>
      <div style={{ ...settingsStatValueStyle, ...valueStyle }}>{value}</div>
    </div>
  )
}

export const settingsMutedTileStyle: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.22)',
}

