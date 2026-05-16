import React from 'react'

import type { PfmeaColumnId, PfmeaEditableField } from './pfmea-columns'
import { asInt1to10 } from './pfmea-risk-utils'
import { TdScaleSelect } from './pfmea-scale-select-cell'
import { TdText } from './pfmea-text-cell'
import type { PfmeaEditorElement, PfmeaRow } from './pfmea-types'

type PfmeaEditState = { rowId: string; col: keyof PfmeaRow } | null
type ScaleOptions = React.ComponentProps<typeof TdScaleSelect>['options']
type TextSideAction = React.ComponentProps<typeof TdText>['sideAction']

type PfmeaFailureEffectCellsProps = {
  disabled: boolean
  edit: PfmeaEditState
  editorRef: React.MutableRefObject<PfmeaEditorElement | null>
  effectRowId: string
  effectSideAction?: TextSideAction
  effectiveFailureBlockOwnerRow: Pick<PfmeaRow, 'effect' | 'severity'>
  failureBlockSpan: number
  isColumnVisible: (id: PfmeaColumnId) => boolean
  isMissingHighlighted: (key: keyof PfmeaRow) => boolean
  onCellKeyDown: (event: React.KeyboardEvent<HTMLElement>, col: PfmeaEditableField, allowEnterNewline: boolean) => void
  onEffectCommit: (value: string) => void
  onEffectLiveChange: (value: string) => void
  onEffectStart: () => void
  onSeverityCommit: (value: number | null) => void
  onSeverityLiveChange: (value: number | null) => void
  onSeverityStart: () => void
  severityOptions: ScaleOptions
  severityRowId: string
  stopEdit: () => void
}

const effectTextStyle: React.CSSProperties = {
  fontFamily: 'Calibri, Arial, sans-serif',
  fontSize: 16,
  color: '#d7dbe3',
}

export function PfmeaFailureEffectCells({
  disabled,
  edit,
  editorRef,
  effectRowId,
  effectSideAction,
  effectiveFailureBlockOwnerRow,
  failureBlockSpan,
  isColumnVisible,
  isMissingHighlighted,
  onCellKeyDown,
  onEffectCommit,
  onEffectLiveChange,
  onEffectStart,
  onSeverityCommit,
  onSeverityLiveChange,
  onSeverityStart,
  severityOptions,
  severityRowId,
  stopEdit,
}: PfmeaFailureEffectCellsProps) {
  if (failureBlockSpan <= 0) return null

  return (
    <>
      {isColumnVisible('effect') ? (
        <TdText
          value={effectiveFailureBlockOwnerRow.effect}
          editing={edit?.rowId === effectRowId && edit?.col === 'effect'}
          onStart={onEffectStart}
          onLiveChange={onEffectLiveChange}
          onCommit={onEffectCommit}
          onKeyDown={(event) => onCellKeyDown(event, 'effect', true)}
          editorRef={editorRef}
          stopEdit={stopEdit}
          rowSpan={failureBlockSpan}
          sideAction={effectSideAction}
          disabled={disabled}
          flash={isMissingHighlighted('effect')}
          cellKey="effect"
          style={effectTextStyle}
        />
      ) : null}

      {isColumnVisible('sev') ? (
        <TdScaleSelect
          value={asInt1to10(effectiveFailureBlockOwnerRow.severity)}
          editing={edit?.rowId === severityRowId && edit?.col === 'severity'}
          onStart={onSeverityStart}
          onLiveChange={onSeverityLiveChange}
          onCommit={onSeverityCommit}
          onKeyDown={(event) => onCellKeyDown(event, 'severity', false)}
          stopEdit={stopEdit}
          options={severityOptions}
          rowSpan={failureBlockSpan}
          disabled={disabled}
          flash={isMissingHighlighted('severity')}
          cellKey="severity"
        />
      ) : null}
    </>
  )
}
