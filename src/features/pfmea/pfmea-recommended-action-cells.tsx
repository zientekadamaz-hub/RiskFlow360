import React from 'react'

import type { PfmeaColumnId, PfmeaEditableField } from './pfmea-columns'
import { TdText } from './pfmea-text-cell'
import type { PfmeaEditorElement, PfmeaRow } from './pfmea-types'

type PfmeaEditState = { rowId: string; col: keyof PfmeaRow } | null
type TextSideAction = React.ComponentProps<typeof TdText>['sideAction']

type PfmeaRecommendedActionCellsProps = {
  disabled: boolean
  edit: PfmeaEditState
  editorRef: React.MutableRefObject<PfmeaEditorElement | null>
  effectiveCurrentRow: Pick<PfmeaRow, 'recommended_action'>
  isColumnVisible: (id: PfmeaColumnId) => boolean
  isMissingHighlighted: (key: keyof PfmeaRow) => boolean
  onCellKeyDown: (event: React.KeyboardEvent<HTMLElement>, col: PfmeaEditableField, allowEnterNewline: boolean) => void
  onCommit: (value: string) => void
  onLiveChange: (value: string) => void
  onStart: () => void
  recommendedActionSideAction?: TextSideAction
  rowId: string
  stopEdit: () => void
}

export function PfmeaRecommendedActionCells({
  disabled,
  edit,
  editorRef,
  effectiveCurrentRow,
  isColumnVisible,
  isMissingHighlighted,
  onCellKeyDown,
  onCommit,
  onLiveChange,
  onStart,
  recommendedActionSideAction,
  rowId,
  stopEdit,
}: PfmeaRecommendedActionCellsProps) {
  if (!isColumnVisible('recommended_action')) return null

  return (
    <TdText
      value={effectiveCurrentRow.recommended_action}
      editing={edit?.rowId === rowId && edit?.col === 'recommended_action'}
      onStart={onStart}
      onLiveChange={onLiveChange}
      onCommit={onCommit}
      onKeyDown={(event) => onCellKeyDown(event, 'recommended_action', true)}
      editorRef={editorRef}
      stopEdit={stopEdit}
      sideAction={recommendedActionSideAction}
      disabled={disabled}
      flash={isMissingHighlighted('recommended_action')}
      cellKey="recommended_action"
    />
  )
}
