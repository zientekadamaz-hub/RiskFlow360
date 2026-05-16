import React from 'react'

import type { PfmeaColumnId, PfmeaEditableField } from './pfmea-columns'
import { TdDate } from './pfmea-date-cell'
import { TdSelect } from './pfmea-status-select-cell'
import { TdText } from './pfmea-text-cell'
import type { PfmeaEditorElement, PfmeaRow } from './pfmea-types'

type PfmeaEditState = { rowId: string; col: keyof PfmeaRow } | null

type PfmeaActionClosureCellsProps = {
  disabled: boolean
  edit: PfmeaEditState
  editorRef: React.MutableRefObject<PfmeaEditorElement | null>
  effectiveCurrentRow: Pick<PfmeaRow, 'responsible' | 'target_date'>
  isColumnVisible: (id: PfmeaColumnId) => boolean
  isMissingHighlighted: (key: keyof PfmeaRow) => boolean
  latestRowForHighlights: Pick<PfmeaRow, 'action_status'>
  onCellKeyDown: (event: React.KeyboardEvent<HTMLElement>, col: PfmeaEditableField, allowEnterNewline: boolean) => void
  onCommit: (patch: Partial<PfmeaRow>) => void
  onLiveChange: (col: keyof PfmeaRow, value: string | null) => void
  onStart: (col: keyof PfmeaRow) => void
  rowId: string
  stopEdit: () => void
}

const ACTION_STATUS_OPTIONS = ['', 'OPEN', 'CLOSED', 'CANCELED']

export function PfmeaActionClosureCells({
  disabled,
  edit,
  editorRef,
  effectiveCurrentRow,
  isColumnVisible,
  isMissingHighlighted,
  latestRowForHighlights,
  onCellKeyDown,
  onCommit,
  onLiveChange,
  onStart,
  rowId,
  stopEdit,
}: PfmeaActionClosureCellsProps) {
  return (
    <>
      {isColumnVisible('responsible') ? (
        <TdText
          value={effectiveCurrentRow.responsible}
          editing={edit?.rowId === rowId && edit?.col === 'responsible'}
          onStart={() => onStart('responsible')}
          onLiveChange={(value) => onLiveChange('responsible', value)}
          onCommit={(value) => onCommit({ responsible: value })}
          onKeyDown={(event) => onCellKeyDown(event, 'responsible', false)}
          editorRef={editorRef}
          stopEdit={stopEdit}
          singleLine
          disabled={disabled}
          flash={isMissingHighlighted('responsible')}
          cellKey="responsible"
        />
      ) : null}

      {isColumnVisible('target_date') ? (
        <TdDate
          value={effectiveCurrentRow.target_date}
          editing={edit?.rowId === rowId && edit?.col === 'target_date'}
          onStart={() => onStart('target_date')}
          onLiveChange={(value) => onLiveChange('target_date', value)}
          onCommit={(value) => onCommit({ target_date: value })}
          onKeyDown={(event) => onCellKeyDown(event, 'target_date', false)}
          editorRef={editorRef}
          stopEdit={stopEdit}
          disabled={disabled}
          flash={isMissingHighlighted('target_date')}
          cellKey="target_date"
        />
      ) : null}

      {isColumnVisible('action_status') ? (
        <TdSelect
          value={latestRowForHighlights.action_status}
          editing={edit?.rowId === rowId && edit?.col === 'action_status'}
          onStart={() => onStart('action_status')}
          onLiveChange={(value) => onLiveChange('action_status', value)}
          onCommit={(value) => onCommit({ action_status: value })}
          onKeyDown={(event) => onCellKeyDown(event, 'action_status', false)}
          stopEdit={stopEdit}
          options={ACTION_STATUS_OPTIONS}
          disabled={disabled}
          flash={isMissingHighlighted('action_status')}
          cellKey="action_status"
        />
      ) : null}
    </>
  )
}
