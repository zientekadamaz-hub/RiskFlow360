import type React from 'react'
import { type RiskColor as RiskMatrixColor } from '../../../app/settings/risk-matrix/_lib/matrixColors'
import {
  SettingsSummaryGrid,
  SettingsSummaryTile,
  getSettingsSummaryGridMaxWidth,
  settingsRiskSummaryTileStyle,
} from '@/components/rf-ui'
import { projectsSummaryValueStyle } from '@/features/projects/view-styles'
import { pfmeaRevisionNumberFromLabel } from './pfmea-revision-utils'

type RiskColor = RiskMatrixColor

export type PfmeaTopSummaryValue = {
  avg: number | null
  color: RiskColor | null
  buckets: Record<RiskColor, number>
}

export const PFMEA_TOP_SUMMARY_MAX_WIDTH = getSettingsSummaryGridMaxWidth(10)

type PfmeaTopSummaryProps = {
  averageRpn: PfmeaTopSummaryValue
  operationsCount: number
  processName: string | null | undefined
  riskCount: number
  revisionLabel: string | null | undefined
}

export function PfmeaTopSummary({
  averageRpn,
  operationsCount,
  processName,
  riskCount,
  revisionLabel,
}: PfmeaTopSummaryProps) {
  const name = processName ?? '-'
  const processNameLength = name.length
  const processSummaryFontSize = processNameLength > 42 ? 13 : processNameLength > 28 ? 15 : processNameLength > 18 ? 18 : 24
  const processSummaryValueStyle: React.CSSProperties = {
    ...projectsSummaryValueStyle,
    alignItems: 'center',
    display: 'flex',
    fontSize: processSummaryFontSize,
    justifyContent: 'center',
    lineHeight: 1.12,
    minHeight: 36,
    overflowWrap: 'anywhere',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  }
  const pfmeaSummaryValueStyle: React.CSSProperties = { ...projectsSummaryValueStyle, color: '#f8fafc' }

  return (
    <div style={{ width: '100%', maxWidth: PFMEA_TOP_SUMMARY_MAX_WIDTH, marginLeft: 'auto', alignSelf: 'flex-start' }}>
      <SettingsSummaryGrid columns={10} maxWidth={PFMEA_TOP_SUMMARY_MAX_WIDTH}>
        <SettingsSummaryTile
          label="Process"
          style={{ gridColumn: 'span 2' }}
          value={name}
          valueStyle={processSummaryValueStyle}
        />
        <SettingsSummaryTile label="Revision" value={pfmeaRevisionNumberFromLabel(revisionLabel ?? '')} valueStyle={pfmeaSummaryValueStyle} />
        <SettingsSummaryTile label="Operations" value={operationsCount} valueStyle={pfmeaSummaryValueStyle} />
        <SettingsSummaryTile label="PFMEA risks" value={riskCount} valueStyle={pfmeaSummaryValueStyle} />
        <SettingsSummaryTile
          label="Average RPN"
          style={averageRpn.color ? settingsRiskSummaryTileStyle(averageRpn.color) : undefined}
          value={averageRpn.avg == null ? '-' : Math.round(averageRpn.avg)}
          valueStyle={pfmeaSummaryValueStyle}
        />
        <SettingsSummaryTile
          label="Actions must be defined"
          style={settingsRiskSummaryTileStyle('red')}
          value={averageRpn.buckets.red}
          valueStyle={pfmeaSummaryValueStyle}
        />
        <SettingsSummaryTile
          label="Action plan required"
          style={settingsRiskSummaryTileStyle('orange')}
          value={averageRpn.buckets.orange}
          valueStyle={pfmeaSummaryValueStyle}
        />
        <SettingsSummaryTile
          label="Actions recommended"
          style={settingsRiskSummaryTileStyle('yellow')}
          value={averageRpn.buckets.yellow}
          valueStyle={pfmeaSummaryValueStyle}
        />
        <SettingsSummaryTile
          label="Acceptable risk"
          style={settingsRiskSummaryTileStyle('green')}
          value={averageRpn.buckets.green}
          valueStyle={pfmeaSummaryValueStyle}
        />
      </SettingsSummaryGrid>
    </div>
  )
}
