export const PFMEA_REPORT_RISK_FIELDS =
  'id,operation_id,row_no,created_at,failure_mode_group_id,failure_block_group_id,action_plan_group_id,action_status,severity,occurrence,detection,occurrence2,detection2,oxd2,rpn2,oxd_current,rpn_current,rpn'

// Reports read saved revision rows. Do not filter by the current operation active flag here:
// PFMEA may still show historical revision rows even when the linked operation was later deactivated.
export const PFMEA_REPORT_RISK_SELECT = `${PFMEA_REPORT_RISK_FIELDS},operations!inner(project_id)`
export const PFMEA_REPORT_RISK_SELECT_WITH_REVISION = `revision_id,${PFMEA_REPORT_RISK_SELECT}`
