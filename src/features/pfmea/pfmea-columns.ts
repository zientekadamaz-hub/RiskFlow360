export type PfmeaColumnId =
  | 'id'
  | 'station'
  | 'operation'
  | 'process_step'
  | 'row_no'
  | 'failure_mode'
  | 'effect'
  | 'sev'
  | 'characteristic'
  | 'pcp'
  | 'class'
  | 'cause'
  | 'occ'
  | 'current_prev'
  | 'current_det'
  | 'det'
  | 'rpn'
  | 'recommended_action'
  | 'responsible'
  | 'target_date'
  | 'action_status'
  | 'o2'
  | 'd2'
  | 'rpn2'
  | 'delete'

export type PfmeaEditableField =
  | 'failure_mode'
  | 'effect'
  | 'severity'
  | 'characteristic'
  | 'class'
  | 'cause'
  | 'occurrence'
  | 'current_prevention'
  | 'current_detection'
  | 'detection'
  | 'recommended_action'
  | 'responsible'
  | 'target_date'
  | 'action_status'
  | 'occurrence2'
  | 'detection2'

export const PFMEA_COLUMNS: Array<{ id: PfmeaColumnId; label: string; width: number }> = [
  { id: 'id', label: 'ID#', width: 50 },
  { id: 'station', label: 'STATION', width: 150 },
  { id: 'operation', label: 'OPERATION', width: 150 },
  { id: 'process_step', label: 'PROCESS STEP', width: 150 },
  { id: 'failure_mode', label: 'FAILURE MODE', width: 180 },
  { id: 'characteristic', label: 'CHARACTERISTIC', width: 180 },
  { id: 'class', label: 'CLASS', width: 70 },
  { id: 'effect', label: 'EFFECT', width: 180 },
  { id: 'sev', label: 'SEV', width: 50 },
  { id: 'cause', label: 'CAUSE', width: 180 },
  { id: 'occ', label: 'OCC', width: 50 },
  { id: 'current_prev', label: 'CURRENT CONTROLS (PREV)', width: 180 },
  { id: 'current_det', label: 'CURRENT CONTROLS (DET)', width: 180 },
  { id: 'det', label: 'DET', width: 50 },
  { id: 'rpn', label: 'RPN', width: 60 },
  { id: 'pcp', label: 'PCP', width: 72 },
  { id: 'recommended_action', label: 'RECOMMENDED ACTION', width: 180 },
  { id: 'responsible', label: 'RESPONSIBLE', width: 120 },
  { id: 'target_date', label: 'TARGET DATE', width: 120 },
  { id: 'action_status', label: 'ACTION STATUS', width: 120 },
  { id: 'o2', label: 'OCC (AFTER)', width: 60 },
  { id: 'd2', label: 'DET (AFTER)', width: 60 },
  { id: 'rpn2', label: 'RPN (AFTER)', width: 60 },
  { id: 'delete', label: 'DELETE', width: 50 },
]

export const PFMEA_COLUMNS_BY_ID: Record<PfmeaColumnId, { id: PfmeaColumnId; label: string; width: number }> = PFMEA_COLUMNS.reduce(
  (acc, col) => {
    acc[col.id] = col
    return acc
  },
  {} as Record<PfmeaColumnId, { id: PfmeaColumnId; label: string; width: number }>
)

export const PFMEA_COLUMN_FILTER_GROUPS: Array<{ title: string; ids: PfmeaColumnId[] }> = [
  {
    title: 'Process Context',
    ids: ['id', 'station', 'operation', 'process_step'],
  },
  {
    title: 'Current Risk Analysis',
    ids: ['failure_mode', 'characteristic', 'class', 'effect', 'sev', 'cause', 'occ', 'current_prev', 'current_det', 'det', 'rpn', 'pcp'],
  },
  {
    title: 'Action Plan & Residual Risk',
    ids: ['recommended_action', 'responsible', 'target_date', 'action_status', 'o2', 'd2', 'rpn2'],
  },
]

export const DEFAULT_VISIBLE_COLUMNS: Record<PfmeaColumnId, boolean> = {
  id: true,
  station: true,
  operation: true,
  process_step: true,
  row_no: false,
  failure_mode: true,
  effect: true,
  sev: true,
  characteristic: true,
  pcp: true,
  class: true,
  cause: true,
  occ: true,
  current_prev: true,
  current_det: true,
  det: true,
  rpn: true,
  recommended_action: true,
  responsible: true,
  target_date: true,
  action_status: true,
  o2: true,
  d2: true,
  rpn2: true,
  delete: true,
}

export const PFMEA_EDITABLE_COLUMN_VISIBILITY: Record<PfmeaEditableField, PfmeaColumnId> = {
  failure_mode: 'failure_mode',
  effect: 'effect',
  severity: 'sev',
  characteristic: 'characteristic',
  class: 'class',
  cause: 'cause',
  occurrence: 'occ',
  current_prevention: 'current_prev',
  current_detection: 'current_det',
  detection: 'det',
  recommended_action: 'recommended_action',
  responsible: 'responsible',
  target_date: 'target_date',
  action_status: 'action_status',
  occurrence2: 'o2',
  detection2: 'd2',
}

export const PFMEA_EDITABLE_FIELDS: PfmeaEditableField[] = [
  'failure_mode',
  'effect',
  'severity',
  'characteristic',
  'class',
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
