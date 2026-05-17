import type { CSSProperties } from 'react'
import React from 'react'

import type { PfmeaColumnId, PfmeaEditableField } from './pfmea-columns'
import { TdRead } from './pfmea-merged-cell'
import { asInt1to10 } from './pfmea-risk-utils'
import { TdScaleSelect } from './pfmea-scale-select-cell'
import type { PfmeaRow } from './pfmea-types'

type ScaleOptions = React.ComponentProps<typeof TdScaleSelect>['options']
type PfmeaEditState = { rowId: string; col: keyof PfmeaRow } | null

type PfmeaResidualRiskCellsProps = {
  detectionOptions: ScaleOptions
  disabled: boolean
  edit: PfmeaEditState
  isColumnVisible: (id: PfmeaColumnId) => boolean
  isMissingHighlighted: (key: keyof PfmeaRow) => boolean
  latestRowForHighlights: Pick<PfmeaRow, 'occurrence2' | 'detection2'>
  onCellKeyDown: (event: React.KeyboardEvent<HTMLElement>, col: PfmeaEditableField, allowEnterNewline: boolean) => void
  onCommit: (patch: Partial<PfmeaRow>) => void
  onExpandOperation: (operationId: string | null) => void
  onLiveChange: (col: keyof PfmeaRow, value: number | null) => void
  onStart: (col: keyof PfmeaRow) => void
  operationId: string | null
  occurrenceOptions: ScaleOptions
  residualRiskMuted?: boolean
  residualRpn: number | null
  riskRpn2Style: CSSProperties
  rowId: string
  stopEdit: () => void
}

export function PfmeaResidualRiskCells({
  detectionOptions,
  disabled,
  edit,
  isColumnVisible,
  isMissingHighlighted,
  latestRowForHighlights,
  onCellKeyDown,
  onCommit,
  onExpandOperation,
  onLiveChange,
  onStart,
  operationId,
  occurrenceOptions,
  residualRiskMuted = false,
  residualRpn,
  riskRpn2Style,
  rowId,
  stopEdit,
}: PfmeaResidualRiskCellsProps) {
  const expandOperation = () => onExpandOperation(operationId)

  return (
    <>
      {isColumnVisible('o2') ? (
        <TdScaleSelect
          value={asInt1to10(latestRowForHighlights.occurrence2)}
          editing={edit?.rowId === rowId && edit?.col === 'occurrence2'}
          onStart={() => onStart('occurrence2')}
          onLiveChange={(value) => onLiveChange('occurrence2', value)}
          onCommit={(value) => onCommit({ occurrence2: value })}
          onKeyDown={(event) => onCellKeyDown(event, 'occurrence2', false)}
          stopEdit={stopEdit}
          options={occurrenceOptions}
          disabled={disabled}
          flash={isMissingHighlighted('occurrence2')}
          cellKey="occurrence2"
          muted={residualRiskMuted}
        />
      ) : null}

      {isColumnVisible('d2') ? (
        <TdScaleSelect
          value={asInt1to10(latestRowForHighlights.detection2)}
          editing={edit?.rowId === rowId && edit?.col === 'detection2'}
          onStart={() => onStart('detection2')}
          onLiveChange={(value) => onLiveChange('detection2', value)}
          onCommit={(value) => onCommit({ detection2: value })}
          onKeyDown={(event) => onCellKeyDown(event, 'detection2', false)}
          stopEdit={stopEdit}
          options={detectionOptions}
          disabled={disabled}
          flash={isMissingHighlighted('detection2')}
          cellKey="detection2"
          muted={residualRiskMuted}
        />
      ) : null}

      {isColumnVisible('rpn2') ? (
        <TdRead
          value={residualRpn == null ? '' : String(residualRpn)}
          className="pfmeaTd rpnCell center gray singleLine"
          style={riskRpn2Style}
          onClick={expandOperation}
        />
      ) : null}
    </>
  )
}
