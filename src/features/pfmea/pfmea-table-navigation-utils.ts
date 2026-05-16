import {
  PFMEA_EDITABLE_COLUMN_VISIBILITY,
  type PfmeaColumnId,
  type PfmeaEditableField,
} from './pfmea-columns'

export type PfmeaCellPosition = {
  r: number
  c: number
}

const PFMEA_TABLE_EDITABLE_FIELD_ORDER: PfmeaEditableField[] = [
  'failure_mode',
  'characteristic',
  'class',
  'effect',
  'severity',
  'cause',
  'occurrence',
  'current_prevention',
  'current_detection',
  'detection',
  'recommended_action',
  'responsible',
  'target_date',
  'action_status',
  'occurrence2',
  'detection2',
]

export function buildPfmeaEditableColumnOrder(isColumnVisible: (id: PfmeaColumnId) => boolean) {
  return PFMEA_TABLE_EDITABLE_FIELD_ORDER.filter((field) => isColumnVisible(PFMEA_EDITABLE_COLUMN_VISIBILITY[field]))
}

export function getNextPfmeaCellPosition(
  rowIndex: number,
  colIdx: number,
  columnOrder: PfmeaEditableField[],
  rowCount: number
): PfmeaCellPosition {
  if (columnOrder.length === 0) return { r: rowIndex, c: 0 }

  let c = colIdx + 1
  let r = rowIndex
  if (c >= columnOrder.length) {
    c = 0
    r = Math.min(rowIndex + 1, Math.max(rowCount - 1, 0))
  }

  return { r, c }
}

export function getPreviousPfmeaCellPosition(
  rowIndex: number,
  colIdx: number,
  columnOrder: PfmeaEditableField[]
): PfmeaCellPosition {
  if (columnOrder.length === 0) return { r: rowIndex, c: 0 }

  let c = colIdx - 1
  let r = rowIndex
  if (c < 0) {
    c = columnOrder.length - 1
    r = Math.max(rowIndex - 1, 0)
  }

  return { r, c }
}
