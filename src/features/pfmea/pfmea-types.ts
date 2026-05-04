import type { PfmeaProjectView } from './pfmea-service'

export type ProjectView = PfmeaProjectView

export type Operation = {
  id: string
  project_id: string
  operation_number: number | null
  name: string
  machine: string | null
  operation: string | null
  active?: boolean
}

export type PfmeaRow = {
  id: string
  revision_id?: string | null
  operation_id: string
  row_no?: string | null
  failure_mode_group_id?: string | null
  failure_block_group_id?: string | null
  action_plan_group_id?: string | null

  failure_mode: string
  effect: string
  severity: number | string | null
  characteristic: string
  pcp: boolean | null
  class: string | null
  cause: string
  occurrence: number | string | null
  current_prevention: string
  current_detection: string
  detection: number | string | null

  rpn: number | null
  oxd: number | null

  recommended_action: string
  responsible: string
  target_date: string | null
  action_status: string | null

  occurrence2: number | string | null
  detection2: number | string | null

  rpn2: number | null
  oxd2: number | null

  rpn_current: number | null
  oxd_current: number | null

  created_at: string
  __sortIndex?: number

  operations?: {
    id: string
    operation_number: number | null
    name: string
    machine: string | null
    operation: string | null
    project_id: string
    active?: boolean
  } | null
}

export type NewRowDraft = { operation_id: string }
export type PfmeaEditorElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement

export type SeverityEffectiveRow = {
  level: number
  name?: string | null
  description?: string | null
  active: boolean
}

export type SeverityOption = {
  level: number
  label: string
  examples: string[]
}

export type PfdDiagramRow = {
  nodes?: Array<{ id?: string | null; data?: { kind?: string | null } | null }> | null
}
