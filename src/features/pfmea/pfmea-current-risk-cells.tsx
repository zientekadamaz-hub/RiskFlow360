import type { CSSProperties } from 'react'

import type { PfmeaColumnId } from './pfmea-columns'
import { TdRead } from './pfmea-merged-cell'
import { TdPcpToggle } from './pfmea-pcp-toggle-cell'

type PfmeaCurrentRiskCellsProps = {
  actionPlanBlockSpan: number
  currentRpn: number | null
  isColumnVisible: (id: PfmeaColumnId) => boolean
  onExpandOperation: (operationId: string | null) => void
  onTogglePcp: () => void
  operationId: string | null
  pcpAutoReasons: string[]
  pcpChecked: boolean
  pcpDisabled: boolean
  riskRpnStyle: CSSProperties
}

export function PfmeaCurrentRiskCells({
  actionPlanBlockSpan,
  currentRpn,
  isColumnVisible,
  onExpandOperation,
  onTogglePcp,
  operationId,
  pcpAutoReasons,
  pcpChecked,
  pcpDisabled,
  riskRpnStyle,
}: PfmeaCurrentRiskCellsProps) {
  const expandOperation = () => onExpandOperation(operationId)

  return (
    <>
      {isColumnVisible('rpn') && actionPlanBlockSpan > 0 ? (
        <TdRead
          value={currentRpn == null ? '' : String(currentRpn)}
          className="pfmeaTd rpnCell center gray singleLine"
          style={riskRpnStyle}
          rowSpan={actionPlanBlockSpan}
          sticky={false}
          onClick={expandOperation}
        />
      ) : null}

      {isColumnVisible('pcp') && actionPlanBlockSpan > 0 ? (
        <TdPcpToggle
          checked={pcpChecked}
          reasons={pcpAutoReasons}
          disabled={pcpDisabled}
          onToggle={onTogglePcp}
          cellKey="pcp"
          rowSpan={actionPlanBlockSpan}
        />
      ) : null}
    </>
  )
}
