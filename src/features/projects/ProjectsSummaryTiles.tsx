'use client'

import React from 'react'
import {
  SettingsSummaryGrid,
  SettingsSummaryTile,
  settingsRiskSummaryTileStyle,
  settingsSummaryTileStyle,
} from '@/components/rf-ui'
import type { RpnThresholds } from './types'
import { projectsSummaryValueStyle } from './view-styles'
import { riskColorFromRpnValue } from '@/lib/risk-engine'

function avgRpnTileStyle(value: number | null, thresholds: RpnThresholds) {
  if (value == null || !Number.isFinite(value)) return settingsSummaryTileStyle
  return settingsRiskSummaryTileStyle(riskColorFromRpnValue(value, thresholds))
}

export function ProjectsSummaryTiles({
  openProjectsCount,
  riskCount,
  averageRpnValue,
  averageRpn,
  averageRpnThresholds,
  riskColorCounts,
}: {
  openProjectsCount: number
  riskCount: number
  averageRpnValue: number | null
  averageRpn: string
  averageRpnThresholds: RpnThresholds
  riskColorCounts: { red: number; orange: number; yellow: number; green: number }
}) {
  return (
    <SettingsSummaryGrid columns={7}>
      <SettingsSummaryTile label="Open projects" value={openProjectsCount} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="Open risks" value={riskCount} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="Open Average RPN" value={averageRpn} style={avgRpnTileStyle(averageRpnValue, averageRpnThresholds)} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="Actions must be defined" value={riskColorCounts.red} style={settingsRiskSummaryTileStyle('red')} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="Action plan required" value={riskColorCounts.orange} style={settingsRiskSummaryTileStyle('orange')} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="Actions recommended" value={riskColorCounts.yellow} style={settingsRiskSummaryTileStyle('yellow')} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="Acceptable risk" value={riskColorCounts.green} style={settingsRiskSummaryTileStyle('green')} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
    </SettingsSummaryGrid>
  )
}
