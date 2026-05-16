import React from 'react'

import { CLASS_OPTIONS, TdClassSelect } from './pfmea-class-select-cell'
import type { PfmeaColumnId, PfmeaEditableField } from './pfmea-columns'
import { TdText } from './pfmea-text-cell'
import type { PfmeaEditorElement, PfmeaRow } from './pfmea-types'
import { normalizeClassValue } from './pfmea-value-utils'

type PfmeaEditState = { rowId: string; col: keyof PfmeaRow } | null
type TextSideAction = React.ComponentProps<typeof TdText>['sideAction']

type PfmeaFailureModeCellsProps = {
  disabled: boolean
  edit: PfmeaEditState
  editorRef: React.MutableRefObject<PfmeaEditorElement | null>
  effectiveFailureModeOwnerRow: Pick<PfmeaRow, 'failure_mode' | 'characteristic' | 'class'>
  failureModeSideAction?: TextSideAction
  failureModeSpan: number
  isColumnVisible: (id: PfmeaColumnId) => boolean
  isMissingHighlighted: (key: keyof PfmeaRow) => boolean
  onCellKeyDown: (event: React.KeyboardEvent<HTMLElement>, col: PfmeaEditableField, allowEnterNewline: boolean) => void
  onCommit: (patch: Partial<PfmeaRow>) => void
  onLiveChange: (col: keyof PfmeaRow, value: string) => void
  onStart: (col: keyof PfmeaRow) => void
  rowId: string
  stopEdit: () => void
}

const failureModeTextStyle: React.CSSProperties = {
  fontFamily: 'Calibri, Arial, sans-serif',
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.45,
  textAlign: 'center',
  paddingTop: 14,
  paddingBottom: 14,
  color: '#d7dbe3',
}

const characteristicTextStyle: React.CSSProperties = {
  fontFamily: 'Calibri, Arial, sans-serif',
  fontSize: 16,
  color: '#d7dbe3',
}

export function PfmeaFailureModeCells({
  disabled,
  edit,
  editorRef,
  effectiveFailureModeOwnerRow,
  failureModeSideAction,
  failureModeSpan,
  isColumnVisible,
  isMissingHighlighted,
  onCellKeyDown,
  onCommit,
  onLiveChange,
  onStart,
  rowId,
  stopEdit,
}: PfmeaFailureModeCellsProps) {
  if (failureModeSpan <= 0) return null

  return (
    <>
      {isColumnVisible('failure_mode') ? (
        <TdText
          value={effectiveFailureModeOwnerRow.failure_mode}
          editing={edit?.rowId === rowId && edit?.col === 'failure_mode'}
          onStart={() => onStart('failure_mode')}
          onLiveChange={(value) => onLiveChange('failure_mode', value)}
          onCommit={(value) => onCommit({ failure_mode: value })}
          onKeyDown={(event) => onCellKeyDown(event, 'failure_mode', true)}
          editorRef={editorRef}
          stopEdit={stopEdit}
          rowSpan={failureModeSpan}
          sideAction={failureModeSideAction}
          disabled={disabled}
          flash={isMissingHighlighted('failure_mode')}
          cellKey="failure_mode"
          style={failureModeTextStyle}
        />
      ) : null}

      {isColumnVisible('characteristic') ? (
        <TdText
          value={effectiveFailureModeOwnerRow.characteristic}
          editing={edit?.rowId === rowId && edit?.col === 'characteristic'}
          onStart={() => onStart('characteristic')}
          onLiveChange={(value) => onLiveChange('characteristic', value)}
          onCommit={(value) => onCommit({ characteristic: value })}
          onKeyDown={(event) => onCellKeyDown(event, 'characteristic', true)}
          editorRef={editorRef}
          stopEdit={stopEdit}
          rowSpan={failureModeSpan}
          disabled={disabled}
          cellKey="characteristic"
          style={characteristicTextStyle}
        />
      ) : null}

      {isColumnVisible('class') ? (
        <TdClassSelect
          value={normalizeClassValue(effectiveFailureModeOwnerRow.class)}
          editing={edit?.rowId === rowId && edit?.col === 'class'}
          onStart={() => onStart('class')}
          onCommit={(value) => onCommit({ class: value || null })}
          onKeyDown={(event) => onCellKeyDown(event, 'class', false)}
          stopEdit={stopEdit}
          options={CLASS_OPTIONS}
          rowSpan={failureModeSpan}
          disabled={disabled}
          cellKey="class"
        />
      ) : null}
    </>
  )
}
