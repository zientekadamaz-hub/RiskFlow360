import type React from 'react'

import {
  SettingsSummaryGrid,
  SettingsSummaryTile,
  getSettingsSummaryGridMaxWidth,
} from '@/components/rf-ui'
import { projectsSummaryValueStyle } from '@/features/projects/view-styles'

export const PCP_TOP_SUMMARY_MAX_WIDTH = getSettingsSummaryGridMaxWidth(4)

type PcpTopSummaryProps = {
  processName: string | null | undefined
  revisionLabel: string | null | undefined
  rowCount: number
}

export function PcpTopSummary({
  processName,
  revisionLabel,
  rowCount,
}: PcpTopSummaryProps) {
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
  const pcpSummaryValueStyle: React.CSSProperties = { ...projectsSummaryValueStyle, color: '#f8fafc' }

  return (
    <div style={{ width: '100%', maxWidth: PCP_TOP_SUMMARY_MAX_WIDTH, marginLeft: 'auto', alignSelf: 'flex-start' }}>
      <SettingsSummaryGrid columns={4} maxWidth={PCP_TOP_SUMMARY_MAX_WIDTH}>
        <SettingsSummaryTile
          label="Process"
          style={{ gridColumn: 'span 2' }}
          value={name}
          valueStyle={processSummaryValueStyle}
        />
        <SettingsSummaryTile
          label="Revision"
          value={(revisionLabel ?? '-').split('.').at(-1) ?? '-'}
          valueStyle={pcpSummaryValueStyle}
        />
        <SettingsSummaryTile label="PCP rows" value={rowCount} valueStyle={pcpSummaryValueStyle} />
      </SettingsSummaryGrid>
    </div>
  )
}
