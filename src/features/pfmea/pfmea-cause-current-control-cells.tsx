import React from 'react'

import type { PfmeaColumnId, PfmeaEditableField } from './pfmea-columns'
import { asInt1to10 } from './pfmea-risk-utils'
import { TdScaleSelect } from './pfmea-scale-select-cell'
import { TdText } from './pfmea-text-cell'
import type { PfmeaEditorElement, PfmeaRow } from './pfmea-types'

type PfmeaEditState = { rowId: string; col: keyof PfmeaRow } | null
type ScaleOptions = React.ComponentProps<typeof TdScaleSelect>['options']
type TextSideAction = React.ComponentProps<typeof TdText>['sideAction']

type PfmeaCauseCurrentControlCellsProps = {
  actionPlanBlockSpan: number
  causeSideAction?: TextSideAction
  detectionOptions: ScaleOptions
  disabled: boolean
  edit: PfmeaEditState
  editorRef: React.MutableRefObject<PfmeaEditorElement | null>
  effectiveActionPlanOwnerRow: Pick<
    PfmeaRow,
    'cause' | 'occurrence' | 'current_prevention' | 'current_detection' | 'detection'
  >
  isColumnVisible: (id: PfmeaColumnId) => boolean
  isMissingHighlighted: (key: keyof PfmeaRow) => boolean
  occurrenceOptions: ScaleOptions
  onCellKeyDown: (event: React.KeyboardEvent<HTMLElement>, col: PfmeaEditableField, allowEnterNewline: boolean) => void
  onCommit: (patch: Partial<PfmeaRow>) => void
  onLiveChange: (col: keyof PfmeaRow, value: string | number | null) => void
  onStart: (col: keyof PfmeaRow) => void
  rowId: string
  stopEdit: () => void
}

export function PfmeaCauseCurrentControlCells({
  actionPlanBlockSpan,
  causeSideAction,
  detectionOptions,
  disabled,
  edit,
  editorRef,
  effectiveActionPlanOwnerRow,
  isColumnVisible,
  isMissingHighlighted,
  occurrenceOptions,
  onCellKeyDown,
  onCommit,
  onLiveChange,
  onStart,
  rowId,
  stopEdit,
}: PfmeaCauseCurrentControlCellsProps) {
  if (actionPlanBlockSpan <= 0) return null

  return (
    <>
      {isColumnVisible('cause') ? (
        <TdText
          value={effectiveActionPlanOwnerRow.cause}
          editing={edit?.rowId === rowId && edit?.col === 'cause'}
          onStart={() => onStart('cause')}
          onLiveChange={(value) => onLiveChange('cause', value)}
          onCommit={(value) => onCommit({ cause: value })}
          onKeyDown={(event) => onCellKeyDown(event, 'cause', true)}
          editorRef={editorRef}
          stopEdit={stopEdit}
          sideAction={causeSideAction}
          disabled={disabled}
          flash={isMissingHighlighted('cause')}
          rowSpan={actionPlanBlockSpan}
          cellKey="cause"
        />
      ) : null}

      {isColumnVisible('occ') ? (
        <TdScaleSelect
          value={asInt1to10(effectiveActionPlanOwnerRow.occurrence)}
          editing={edit?.rowId === rowId && edit?.col === 'occurrence'}
          onStart={() => onStart('occurrence')}
          onLiveChange={(value) => onLiveChange('occurrence', value)}
          onCommit={(value) => onCommit({ occurrence: value })}
          onKeyDown={(event) => onCellKeyDown(event, 'occurrence', false)}
          stopEdit={stopEdit}
          options={occurrenceOptions}
          rowSpan={actionPlanBlockSpan}
          disabled={disabled}
          flash={isMissingHighlighted('occurrence')}
          cellKey="occurrence"
        />
      ) : null}

      {isColumnVisible('current_prev') ? (
        <TdText
          value={effectiveActionPlanOwnerRow.current_prevention}
          editing={edit?.rowId === rowId && edit?.col === 'current_prevention'}
          onStart={() => onStart('current_prevention')}
          onLiveChange={(value) => onLiveChange('current_prevention', value)}
          onCommit={(value) => onCommit({ current_prevention: value })}
          onKeyDown={(event) => onCellKeyDown(event, 'current_prevention', true)}
          editorRef={editorRef}
          stopEdit={stopEdit}
          rowSpan={actionPlanBlockSpan}
          disabled={disabled}
          flash={isMissingHighlighted('current_prevention')}
          cellKey="current_prevention"
        />
      ) : null}

      {isColumnVisible('current_det') ? (
        <TdText
          value={effectiveActionPlanOwnerRow.current_detection}
          editing={edit?.rowId === rowId && edit?.col === 'current_detection'}
          onStart={() => onStart('current_detection')}
          onLiveChange={(value) => onLiveChange('current_detection', value)}
          onCommit={(value) => onCommit({ current_detection: value })}
          onKeyDown={(event) => onCellKeyDown(event, 'current_detection', true)}
          editorRef={editorRef}
          stopEdit={stopEdit}
          rowSpan={actionPlanBlockSpan}
          disabled={disabled}
          flash={isMissingHighlighted('current_detection')}
          cellKey="current_detection"
        />
      ) : null}

      {isColumnVisible('det') ? (
        <TdScaleSelect
          value={asInt1to10(effectiveActionPlanOwnerRow.detection)}
          editing={edit?.rowId === rowId && edit?.col === 'detection'}
          onStart={() => onStart('detection')}
          onLiveChange={(value) => onLiveChange('detection', value)}
          onCommit={(value) => onCommit({ detection: value })}
          onKeyDown={(event) => onCellKeyDown(event, 'detection', false)}
          stopEdit={stopEdit}
          options={detectionOptions}
          rowSpan={actionPlanBlockSpan}
          disabled={disabled}
          flash={isMissingHighlighted('detection')}
          cellKey="detection"
        />
      ) : null}
    </>
  )
}
